# SubHalt — Features & Product Audit

_Last audited: 2026-10-17 · Repo: `subsync` · Product name: SubHalt (older docs say "SubSync")_

## What SubHalt is

SubHalt is a subscription and recurring-bill tracker built around the part that
actually saves money: **the action after the total**. Most trackers only add up
your spend. SubHalt keeps every subscription and bill in one place, warns you
*before* each renewal instead of after, auto-discovers forgotten subscriptions
from Gmail and forwarded receipts, files anything waiting on a decision into a
single inbox, and shows you the cancellation route for anything that is not
earning its keep — with the savings measured.

- **Free plan is the product, not a trial** — full manual tracking, no card, no time limit.
- **Plus** ($3.99/month, charged in NGN via Paystack, one-off monthly — no auto-renew) lifts the caps and turns on automatic discovery.

### Plans at a glance

| | Free | Plus |
|---|---|---|
| Subscriptions | 3 | 50 |
| Bills | 10 | 100 |
| Receipt scans / month | 3 | 50 |
| Inbox / email discovery | — | 100 / month |
| Account links per subscription | 1 | Unlimited |
| Gmail & email-forwarding discovery | — | ✔ |
| Export CSV/JSON | — | ✔ |

---

## Feature inventory

### 1. Accounts & authentication
- Email + password, Google and Apple sign-in, OTP email verification.
- TOTP two-factor authentication with QR enrollment, MFA wall, and a
  remembered-account chooser at sign-in.
- Password change, email change with re-authentication, display-name change
  (30-day cooldown enforced in the database).
- Self-service account deletion gated by an emailed 6-digit HMAC code and an
  optional churn-reason survey.

### 2. Subscription tracking (core)
- Full CRUD for subscriptions: price, currency, billing cycle
  (weekly/monthly/quarterly/yearly/custom), category, status
  (active/paused/canceled/trial), dates, notes.
- Table (list) and card (grid) views at every screen width; search,
  category/status filters, four sort modes.
- **Archive → Delete → Restore** lifecycle with full history
  (`/history/archive`, `/history/deleted`, `/history/restored`) — nothing is
  ever silently destroyed.
- Multiple account links per subscription, provider websites resolved from a
  catalog of ~664 known providers, official management-page deep links.
- Per-plan caps with upgrade prompts at the limit.

### 3. Renewals
- `/renewals` shows upcoming renewals plus overdue ones (60-day window).
- Dashboard "upcoming renewals" spotlight (10-day window, top 3).
- Live next-renewal countdown on each subscription's detail sheet.

### 4. Automatic discovery
- **Gmail**: connect a mailbox (read-only scope), scan for subscription and
  bill receipts, review candidates, create subscriptions in one flow.
  OAuth tokens encrypted at rest (AES-256-GCM); background daily rescan.
- **Email forwarding**: a personal `receipts+<uuid>@…` address; anything
  forwarded is parsed and turned into a subscription/bill draft
  (Mailgun HMAC-verified webhook, burst limits, monthly quota).
- Deduplication means the same receipt never creates two rows.

### 5. Receipt capture & import
- Upload, paste, or take a photo of a receipt: PDF, image, or text.
- A deterministic 1,287-line parser extracts provider, amount, date, cycle and
  category with **per-field confidence and evidence**; AI vision is used only
  to transcribe pixels and never to invent amounts.
- Low-confidence fields are flagged and editable before anything is saved.
- Receipt files stored privately with signed links; monthly quota per plan.

### 6. Bills & payments (feature-flagged)
- Guided pay-a-bill flow: country → category → provider → amount
  (built with Nigerian electricity/DISCO-style billers in mind).
- Record payments with verified-provider autosuggest, regions, frequency,
  status; receipt scanning for bills; spending summary and analytics.
- `/bills/history` with search, filters, verified-biller marks and converted
  totals.

### 7. Inbox
- Every item needing a decision collected in one feed: unread,
  action-required, favourites, archived.
- Mark-all-read, deep links straight to the subscription or billing screen.

### 8. Reminders & notifications
- Renewal reminders by **email and Web Push**, with configurable lead time.
- Automatic day-before (monthly) / week-before (annual) reminders that run even
  without configuration, plus a push-only 10-day nudge.
- Delivery is idempotent in the database — a reminder can never double-send.
- Saturday weekly recap push; full test-notification endpoint.

### 9. AI assistant & savings
- **Ask SubHalt**: tool-calling agent grounded in your real data (`lib/ai/tools.ts`,
  `lib/ai/agent.ts`). Reads/phases execute against your own rows via RLS —
  subscriptions, spending summaries, bill totals, insight engine — and live web
  search with citations fills in external facts. No answer is hardcoded: every
  figure comes from a tool result. Saved conversation history, plus a
  deterministic offline engine when AI is unavailable.
- **Assistant actions (Plus)**: the agent can *propose* writes — add, edit,
  pause, resume or cancel a subscription, log or correct a bill payment — but
  never executes them. Each proposal renders as a confirmation card in the
  chat; only after you tap Confirm does `/api/ai/actions` re-validate (auth,
  plan, schema) and write via the same tables the app uses. Free tier keeps
  full reads and analysis.
- **Smart insights** card shared with push notifications.
- **Savings recommendations** (expensive plans, upcoming renewals, expiring
  trials) and **Cancellation Intelligence**: it finds cheaper plans, links the
  provider's cancellation page, and books the savings you confirm, with an
  8-second undo. Dashboard total-savings is the proof the app paid for itself.

### 10. Dashboard & analytics
- Monthly spend normalised across cycles (weekly ×52/12, quarterly ÷3, etc.),
  annualised cost, category breakdown, most expensive plan.
- Export and import (Plus): CSV/JSON export, CSV/JSON restore with preview
  before anything is written; monthly expense distribution chart.

### 11. Plans & billing
- Paystack checkout (NGN), server-verified callback + HMAC-SHA512 webhook +
  self-heal reconciliation with unusually thorough double-charge prevention.
- Cancel keeps access until expiry; post-payment recovery UI covers every
  result state.

### 12. Settings & personalisation
- Appearance (Midnight theme shipped; Ivory and Sand fully designed), accent
  colours, reporting currency (30+), custom categories, assistant name.
- Notification preferences per channel; privacy & data controls: JSON export,
  local-cache wipe, telemetry toggle.

### 13. Admin console
- Role-gated `/admin`: user search and detail, admin role grant/revoke, plan
  grants/revokes, payment ledger, bill-provider catalog CRUD, integration
  health, MRR estimate, recent activity.

### 14. Marketing site & PWA
- Landing, features, how-it-works, about, help pages; SEO (sitemap, robots,
  OG cards); Google AdSense banner on the free tier.
- Installable PWA: web manifest, push-only service worker, mobile bottom dock,
  contextual FAB, safe-area handling.

---

## Why this app matters — why anyone needs it

1. **Subscription creep is universal.** People pay for more than they think,
   and free trials and annual renewals are engineered to be forgotten. A
   total-spend number does not stop the charge; a warning before it does.
2. **It closes the loop from awareness to action.** Discovery (Gmail /
   forwarding) → renewal reminders → decision inbox → cancellation route →
   measured savings. Most competitors stop at step one.
3. **The free tier is genuinely usable**, so there is no card and no clock
   pressuring anyone just to track their own money.
4. **Inbox and payment access are high-stakes**, and the engineering reflects
   that: encrypted OAuth tokens, row-level security everywhere,
   server-authoritative billing, idempotent payment grants.
5. **Built for a market US-first trackers ignore**: NGN checkout, Nigerian
   billers/DISCOs, multi-currency conversion alongside USD/EUR/GBP.

---

## Under the hood

- Next.js 16 / React 19 / TypeScript / Tailwind 4; Supabase (Postgres, Auth,
  Storage) with RLS on every table and `SECURITY DEFINER` functions for
  privileged operations; Paystack, Groq (AI), Resend (email), Web Push.
- 20 database migrations; owner-scoped tables (subscriptions, bills, activity,
  inbox, receipts) vs server-only tables (payment ledger, Gmail connections,
  quotas, reminder-delivery idempotency).
- Security posture: constant-time secret comparisons, fail-closed webhooks,
  raw-body signature verification, encrypted tokens, server-side plan
  resolution, IP rate limiting, CSP and security headers.

## Audit snapshot (2026-10-17)

| Check | Result |
|---|---|
| `npm run type-check` | Clean |
| `npm test` | **737 / 737 passing** (75 files) |
| `npm run build` | Passes |
| Lint | Clean (0 problems) |

### Recommendations & status

1. ~~Throttle the `POST /api/auth/providers` enumeration oracle~~ — done:
   dedicated 5 requests/min per-IP bucket, independent of the global window.
2. ~~Per-user quotas on AI chat, Gmail scan, delete-account code sending and
   receipt scanning~~ — done via the shared `check_rate_limit` store.
3. ~~Receipt-quota race~~ — the scan counter is now awaited before the
   response, and a 6/min per-user burst cap bounds concurrent overruns.
4. ~~Weekly-recap double-send race~~ — now claim-first and atomic via
   migration `020_weekly_recap_idempotency.sql`; if the migration is not yet
   applied the route falls back to the previous behaviour instead of failing.
5. ~~`launch-video/` counting as app lint errors~~ — the subproject is now
   excluded from the app ESLint config.

**Still to do at deployment (no code changes needed):** apply migrations
`013_restrict_profile_updates.sql` and `020_weekly_recap_idempotency.sql` in
the live Supabase project, and set `GMAIL_TOKEN_ENCRYPTION_KEY` +
`ACCOUNT_DELETE_SIGNING_KEY` in the deployment environment (both now
documented in `.env.example`).
