# SubHalt — Feature Inventory

Written 2026-10-19 against the live `landing-wip` branch (commit `c5e402e`).
Every item below was read out of the code, not from marketing copy.

**Legend**
- **Live** — working now, in production.
- **Plus** — real, but behind the paid plan.
- **Gated** — built, hidden behind a feature flag.
- **Partial** — works, with a known limitation noted inline.

---

## 1. Subscription tracking — Live

The core object. One row per recurring charge the user is paying for.

| Field | Detail |
| --- | --- |
| Name | Provider or service name, normalised on import |
| Price + currency | Amount and the currency it bills in |
| Billing cycle | `monthly`, `yearly`, `weekly`, `quarterly`, `custom` |
| Category | `Streaming`, `Software`, `Utilities`, `Fitness`, `Finance`, `Education`, `Gaming`, `Other` — plus user-created categories |
| Status | `active`, `paused`, `canceled`, `trial` |
| Next billing date | The renewal anchor the whole reminder engine keys off |
| Payment method | Free text (`card`, `bank transfer`, …) |
| Provider URL | Link to the provider's account/management page |
| Notes | Free text, with account links embedded |
| Account links | Multiple provider accounts per subscription — **1 on Free, unlimited on Plus** |

**Actions:** add, edit, pause, resume, cancel, archive, soft-delete, restore, duplicate detection, filter by status/category, search, sort, list + table + card views.

**Also live:**
- **Overdue detection** — a subscription past its billing date while still active is flagged everywhere consistently (dashboard banner, renewals page, insights).
- **Trial tracking** — `trial` status with its own insight, so a free trial that is about to convert gets warned about.
- **Upcoming renewals spotlight** — the next charges, surfaced on the subscriptions screen.
- **Multi-currency** — 31 currencies (NGN, USD, EUR, GBP, KES, GHS, ZAR, INR, …), live rates from `open.er-api.com` with a baked-in USD fallback table, and a per-user display currency so a NGN bill reads in the currency the user thinks in.
- **Category manager** — create and edit custom categories.

---

## 2. Automatic discovery — Live / Plus

SubHalt can find subscriptions you never typed in.

### Gmail Connect — Plus
- OAuth 2.0 with `gmail.readonly` scope only (read-only, never send or delete).
- Tokens encrypted at rest (`gmail-token-crypto.ts`), stored per user with a state cookie that is checked against the user id.
- **Automatic rescan daily** at 06:00 UTC (`/api/cron/gmail-rescan`), plus a manual scan on demand.
- Finds receipt-shaped messages, parses them, and proposes new subscriptions.
- **Dedupe** against subscriptions you already have, so a rescan never re-suggests what you know.
- "You're all caught up" state when a scan finds nothing new.
- **Expired-grant handling:** a revoked or expired token returns HTTP 401 `gmail_token_expired`; the app marks the grant expired, records the failure, and shows a **Reconnect Gmail** panel with the Google "unverified app" instruction. The `invalid_grant` case is classified narrowly so unrelated errors are not misreported.
- Manual disconnect.

### Email forwarding — Plus
- You get a personal forwarding address; forward any receipt to it.
- Inbound mail arrives via a Mailgun webhook with **signature verification** and webhook auth check.
- The receipt is parsed and turned into a subscription draft for you to confirm.

### Receipt scan (upload or paste)
- **Images** (JPEG/PNG/WebP) go to a Groq **vision** model for transcription, with a fallback list of candidate models because Groq retires models on a rolling schedule; a clear error is returned if every candidate is gone, and the user is told to paste the text instead.
- **PDFs and text files** are extracted locally with pdfjs — no model call, no data leaving the server.
- The parser extracts provider, amount, currency, billing cycle and category, each with a confidence level, and builds a draft the user confirms.
- **Monthly quotas:** Free 3 scans/month, Plus 50, Pro unlimited.

### Receipt attachments
- Attach a receipt to a subscription; receipts are stored in Supabase Storage under per-user policies.

---

## 3. Reminders & notifications — Live

The engine that decides *what* to send, *when*, and *on which channel*.

### Automatic stages (always on, per subscription)
- **Monthly subscriptions:** push at 10 days, 2 days, 1 day, and 12 hours before renewal.
- **Annual subscriptions:** push at 7 days, 1 day, and 12 hours before renewal.
- **Email: exactly one automatic send**, at the earliest stage (2 days for monthly, 7 days for annual). Two automatic emails for one charge read as duplicate and burned the sending quota for no extra warning.
- The 10-day nudge is push-only on purpose — an email ten days out only trains people to archive mail from the address.
- The 12-hour "second call" is push-only and actionable, and is **withheld if the subscription is no longer active** — there is nothing to warn about any more.

### Your own reminders
- Per-subscription opt-in from the Payment Reminder sheet: pick an offset (3 days, 5 days, or any custom value up to 30 days) and one or both channels (push, email).
- Offsets are stored in **minutes** anchored to midnight UTC of the renewal date, so a custom offset can express part of a day.

### Channels
- **Web push** (VAPID, `lib/push`) — server sends to registered device subscriptions.
- **Email** (Resend) — templates for welcome, subscription added, renewal reminder, account deletion code, account deleted, test notification, verification code, sign-in link.
- **In-app inbox** — reminder messages, renewal notices and discovery notices land as inbox items with read/unread state.

### Reliability
- **Idempotency:** every reminder has a delivery key `subscription|renewal|lead|channel`, so a retried or overlapping cron run can never double-send, and a missed run is caught up rather than lost.
- **No bursts:** if a run falls behind and several stages are open at once, only the closest stage per channel is sent; the rest are recorded as `superseded_by_closer_stage` instead of piling up.
- **Cron:** `send-reminders` runs twice daily (09:00 and 21:00 UTC) — the second run exists so the 12-hour window on the day before is actually reachable.
- **Weekly recap** push, Saturdays 10:00 UTC, claimed atomically so it cannot send twice, and it re-arms itself each new week.

### Settings
- Per-subscription push/email toggles and lead times.
- A **Delivery Check** row: registered devices, last push *accepted* (never claimed as received), last email, and a **Send test notification** button that exercises both channels.
- A "last push accepted" state is honest about what the app can actually know.

---

## 4. Dashboard & insights — Live

- **Overview card** — monthly and annual spend, active subscription count, next renewal.
- **Most expensive plan card.**
- **Category breakdown card** — spend and share by category.
- **Personalised header** — time-aware greeting.
- **Smart Insight card**, driven by one shared engine so the card and the push can never disagree. Rules in production:
  1. Overdue Subscriptions
  2. Trial Ending Soon
  3. Duplicate Services (exact match)
  4. Potential Savings (near-duplicate streaming services)
  5. Spending Trend (velocity)
  6. Spending Trend (single subscription)
  7. Billing Flexibility (monthly-heavy)
  8. Annual Savings (annual-heavy)
  9. Annual Projection
  10. Category Concentration
  11. Savings Progress
  12. Subscription Overview (nothing wrong)
  13. Getting Started (no subscriptions yet)
- **Ad banner** on the Free tier.

---

## 5. Ask SubHalt (AI assistant) — Live reads, Plus writes

- Runs on **Groq** with an open model (default `openai/gpt-oss-120b`, configurable via `GROQ_MODEL`); optional live web search via the `browser_search` built-in tool, available only on the GPT-OSS models that support it.
- **Grounded in your own data only** — the model reads through your RLS-scoped Supabase client and never sees another user's rows.
- **Read tools** answer questions about your subscriptions, spend, renewals, and history.
- **Write tools never execute from the model.** The model can only *propose* a change; the UI shows it as a confirmation card, and only after you confirm does `/api/ai/actions` run it — re-validating the same schema and the same plan gate. **Write actions are Plus**; Free can ask anything and get analysis.
- **Savings recommendations** and a **cancellation intelligence** modal that works out what cancelling specific subscriptions would actually save.
- **Saved conversations**, grouped, with delete one / delete all.

---

## 6. Bills & Payments — Gated (off by default)

Hidden behind `NEXT_PUBLIC_BILL_PAYMENT_ENABLED`. When off, the nav item, the `/bills` routes and the sitemap entry all disappear.

- **Pay a bill:** country → category → verified provider → account reference → amount → currency. Countries include Nigeria, United Kingdom, United States, with country-specific categories (electricity, water, internet, TV, mobile, airtime, government, …).
- **Log a bill** manually or by scanning a receipt.
- **Bill history** and a **bill spending summary**.
- Local-only bills (never synced) vs synced bills.
- **Provider catalogue is admin-managed** — providers are not hardcoded user-side.

---

## 7. Plans & billing — Live

- **Paystack** checkout for Plus, with webhook, callback and a reconcile endpoint that recovers a purchase whose webhook never landed.
- Plan purchase records are mirrored locally; the Paystack routes remain authoritative.
- **Admins** get an effective `pro` tier regardless of stored tier — an operator locked out of the product it operates is a lockout, not a tier.
- Upgrade prompts appear the moment you hit a cap, not after a failed save.

---

## 8. Account & security — Live

- **Sign in:** email + password, magic-link email, and social providers (Google, Apple) — only providers actually enabled on the Supabase project get a button, so a disabled provider never reads as a bug.
- **Two-factor authentication:** TOTP, with QR code and manual secret, enrolled from Settings, unenrollable, with abandoned-enrolment cleanup.
- **Remembered accounts** chooser on the login screen.
- **Profile:** name, email, bio, timezone.
- **Account deletion** with an emailed confirmation code, plus a farewell email.
- **Infrastructure hardening:** Supabase RLS on every table, rate limiting on auth and API routes, and security headers (HSTS with preload, `X-Frame-Options: DENY`, `nosniff`, strict referrer policy, and a permissions policy that disables camera, microphone and geolocation).

---

## 9. Data, history & export — Live

- **History views:** All, Archived, Deleted, Restored — with state metadata on each record.
- **Activity log** with human-readable previews of what changed.
- **CSV export** of subscriptions (ID, name, price, currency, billing cycle, category, status, next billing date, payment method, provider URL, notes, created date).
- Import utilities for bulk loading.

---

## 10. Admin panel — Live

- **Overview** — user counts, subscription counts, spend, plan distribution.
- **Users** — search, drill into a user, change their plan, change their role.
- **Payments** — plan subscription records.
- **Providers** — full CRUD over the bill provider catalogue.
- **Integrations** and **activity** views.
- Role model backed by migrations (`admin_roles`), and admin routes are guarded server-side.

---

## 11. Marketing site — Live

Public pages: landing, `/features`, `/how-it-works`, `/about`, `/help`, `/login`, `/signup`.
- SEO: self-referencing canonicals on the canonical host, sitemap limited to the 5 publicly indexable routes, robots.txt pointing at that sitemap, OG image, and correct metadata base.
- Legal modals and a contact mailto.
- The signed-in app is a separate shell with a sidebar (desktop) and a mobile dock.

---

## 12. Platform & engineering

Next.js 16.4 (App Router, Turbopack) · TypeScript strict · Tailwind · Space Grotesk ·
Supabase (Postgres + RLS + Auth + Storage) · Vercel (hosting + crons) · Resend (email) ·
Groq (AI + vision) · Paystack (payments) · VAPID/web-push · Mailgun (inbound email) ·
Gmail API (read-only) · 769 passing tests, with type-check, lint and build as gates.

---

## 13. Feature matrix by plan

| Capability | Free | Plus | Pro |
| --- | --- | --- | --- |
| Subscriptions tracked | 3 | 50 | Unlimited |
| Bills tracked | 10 | 100 | Unlimited |
| Receipt scans / month | 3 | 50 | Unlimited |
| Email discovery / month | 0 | 100 | Unlimited |
| Account links per subscription | 1 | Unlimited | Unlimited |
| Ads shown | Yes | No | No |
| Advanced insights | No | Yes | Yes |
| Gmail Connect | No | Yes | Yes |
| Email forwarding | No | Yes | Yes |
| Assistant write actions | No | Yes | Yes |

---

## 14. What is *not* built (honest gaps)

- **No WhatsApp, no SMS.** Notifications are push, email and in-app only.
- **No public pricing page.** `/plans` is an in-app checkout screen behind the session guard, so nothing indexable states what SubHalt costs.
- **Bills & Payments is switched off** in production.
- **iOS web push only fires from the installed Home Screen app**, not from a Safari tab. This is the single biggest notification-reliability gap.
- **No native mobile app.**
- **No auto-cancellation and no partner integrations** — by design, not an oversight. SubHalt warns before a charge; the user cancels.
- **Receipt image scanning depends on Groq keeping a vision model available.** The fallback list is maintained, but if every candidate is retired, image scanning stops and the user must paste text.
- **Gmail refresh tokens expire in ~7 days** while the Google Cloud consent screen is in Testing mode. Moving it to In production is the fix; it is a console action, not a code change.
