# Fully Integrating the Premium Features: Gmail Connect + Email Forwarding

Plan for making both features work end-to-end in production, split into **what I
do** (implementation) and **what you do** (external/provider setup). Nothing here
is done yet — read it, then tell me what to change or approve.

Current state: the code paths for both features are **already written and mostly
wired**. What's missing is (a) external setup (Google Cloud, Mailgun/Resend, DNS,
Vercel env), and (b) a few real gaps I found while auditing. Details below.

---

## Overall sequencing

```
1. You answer the 5 open questions at the end        (5 min, unblocks everything)
2. You do Google Cloud + Mailgun/Resend setup        (your account work)
3. Me       Implementation     Gmail: Settings panel, copy fix, prod redirect
                              Email: quota enforcement
4. Us       Set Vercel env vars together, deploy, verify end-to-end
```

Gmail and email forwarding are independent; you can do steps 2a and 2b in any
order while I work on step 3.

---

# Part A — Connect through Gmail

## What already exists in code (verified)

| Piece | Where |
| ----- | ----- |
| OAuth consent URL + CSRF state cookie | `app/api/gmail/auth/route.ts` |
| OAuth callback → exchange code → store tokens | `app/api/gmail/oauth/callback/route.ts` |
| Token storage (service-role only, no client RLS) | `supabase/migrations/008_gmail_connections.sql`, `lib/services/gmail-service.ts:121` |
| Status / scan / disconnect endpoints | `/api/gmail/status`, `/api/gmail/scan`, `/api/gmail/disconnect` |
| Receipt scanning (query → metadata → bodies → parse) | `lib/services/gmail-service.ts:295` |
| Background auto-import cron (daily, `0 6 * * *`) | `app/api/cron/gmail-rescan/route.ts` + `lib/services/gmail-monitor.ts` + `vercel.json` |
| UI entry points (Plus-gated) | `components/subscriptions/add-subscription-modal.tsx:121` (Connect Gmail card), `subscription-manager.tsx` auto-opens modal via `?gmailConnected=1` |

So the flow _will_ work once Google + env are configured. It is not a big build —
the work is setup + polish.

## What you set up (I can't)

### 1. Google Cloud project (one-time)

1. <https://console.cloud.google.com> → create/reuse a project.
2. **APIs & Services → Library** → enable **Gmail API**.
3. **APIs & Services → OAuth consent screen** → User type **External**.
4. Add scope `.../auth/gmail.readonly` ("View your email messages and settings").
5. Publish the app or add yourself as a **Test user** first (see caveat below).
6. **APIs & Services → Credentials → Create OAuth 2.0 Client ID** → type
   **Web application** → **Authorized redirect URIs**, add **both**:
   - `https://subhalt.xyz/api/gmail/oauth/callback` ← production
   - `http://localhost:3000/api/gmail/oauth/callback` ← local dev
7. Copy the **Client ID** and **Client Secret**.

> **Caveat you must accept:** `gmail.readonly` is a *restricted Google scope*.
> Until the app passes Google's OAuth **verification** + security assessment,
> real users see "Google hasn't verified this app", and only accounts you add as
> **Test users** can connect. In testing mode Google also expires refresh tokens
> (policy tightened in 2025). For a solo/small rollout this is fine —
> verification only matters when strangers must connect. Plan for that later.

### 2. Vercel + local env

| Var | Vercel (Production) | `.env.local` (already set?) |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | your client id | yes (dev id) |
| `GOOGLE_CLIENT_SECRET` | your client secret | yes (dev secret) |
| `GOOGLE_REDIRECT_URI` | **`https://subhalt.xyz/api/gmail/oauth/callback`** | `http://localhost:3000/api/gmail/oauth/callback` |
| `CRON_SECRET` | your secret | now set |

> `lib/services/gmail-service.ts:57` falls back to `localhost:3000` if
> `GOOGLE_REDIRECT_URI` is unset — production **must** set it explicitly or the
> callback breaks in prod.

### 3. Database (confirm only)

Migration `008_gmail_connections.sql` creates the tokens table. Verify it's in
the live DB (SQL editor):

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'gmail_connections';
```

If missing, run the migration file. (Check alongside migration `012`.

## What I'll implement (your signal needed)

| # | Item | Reason |
| - | ---- | ------ |
| A1 | **Settings → Integrations panel** (new, Plus-gated): show connected Gmail account, last-scan time/count, Reconnect, Disconnect; show forwarding address + copy + Send Test Receipt in the same place. | Today these both only exist inside the **Add Subscription** flow — there is nowhere to see/manage them after setup. Settings currently has `account / plan / preferences / privacy / help` only (`app/settings/page.tsx:354`). |
| A2 | **Fix the over-promise copy** at `gmail-connect-modal.tsx:482`: "monitor your inbox for new subscription receipts **and price changes**". We detect new receipts, **not** price changes. Fix copy unless you want me to build price-change detection (bigger — see open question). | Misleading marketing invites complaints and uninstallations. |
| A3 | **Prod guard/validation** for `GOOGLE_REDIRECT_URI` (warn at build/log if it's the default localhost in a non-dev env), plus make `/api/gmail/status` return the *reason* a user sees "not configured" in the modal. | Prevents the exact "connected nothing" trap above. |
| A4 | Re-run the existing Gmail-related tests / add coverage for the Settings panel. | Keep CI green. |

That's small, contained work. Gmail "full integration" is mostly the Settings
panel — the engine already exists.

## Verify together (after you set up Google + Vercel)

1. `GET /api/gmail/status` → `{ "connected": false }` *without* an error (means
   creds are recognized).
2. Open Add Subscription → **Connect Gmail** → consent screen → land back; status
   now shows your email.
3. Run a scan → candidates appear → import → rows appear in `/subscriptions`.
4. `curl -X POST https://subhalt.xyz/api/cron/gmail-rescan -H "x-cron-secret: <CRON_SECRET>"` → `{ scanned, created, duplicates, ... }`.

---

# Part B — Email Forwarding

## What already exists in code (verified)

| Piece | Where |
| ----- | ----- |
| Personal address `receipts+<userId>@<domain>` | `lib/services/receipt-ingestion.ts:69` |
| Webhook (Mailgun HMAC or shared-secret auth) | `app/api/emails/inbound/route.ts` + `lib/services/inbound-email.ts:37` |
| Parse → dedupe → cap → insert subscription + inbox item | `lib/services/receipt-ingestion.ts:137` |
| Forwarding-address + self-test endpoints | `/api/emails/forwarding-address`, `/api/emails/test` |
| UI (address + copy + Send Test Receipt, handles 503 "not configured") | `components/integrations/email-forwarding-modal.tsx` |
| Plus gating | `add-subscription-modal.tsx:149`, `lib/constants/plan-limits.ts:13` |

## What you set up (I can't)

### 1. Pick a provider and configure it

**Option A — Mailgun (recommended, what the code signs for first).**

1. Mailgun → **Domains** → add a domain or subdomain for receiving (example:
   `mail.subhalt.xyz`). Mailgun verifies DNS for you.
2. Copy the **MX records** Mailgun gives you into DNS (this is the part that makes
   `anything@mail.subhalt.xyz` actually arrive).
3. **Receiving → Routes** → new route: filter `recipient` **matches**
   `receipts+*@<domain>` → forward to `https://subhalt.xyz/api/emails/inbound`.
4. Copy the domain's **HTTP Webhook Signing Key** (used for the HMAC check in
   `lib/services/inbound-email.ts:42`).

**Option B — Resend Inbound** (fine if you prefer; shared-secret auth instead).
Configure an **Inbound Domain**, add MX, route to the same webhook URL. Use
`INBOUND_WEBHOOK_SECRET` instead of the Mailgun signing key.

> If users will also *get* emails from you (welcome, reminders) on this domain,
> add **SPF + DKIM** records so receipts you forward aren't flagged as spam.
> `EMAIL_FROM` is already `hello@mail.subhalt.xyz` — check whether that domain
> currently has send records; if the incoming domain differs from the sending
> one, that's fine, they're independent.

### 2. Vercel env (after provider is live)

| Var | Value |
| --- | ----- |
| `INBOUND_EMAIL_DOMAIN` | the **host part** you chose, e.g. `mail.subhalt.xyz` (no `http`), **lowercase** |
| `MAILGUN_SIGNING_KEY` | Mailgun signing key (if Mailgun) — mutually exclusive with below |
| `INBOUND_WEBHOOK_SECRET` | shared secret fallback / Resend |
| `EMAIL_FROM` | already set (`hello@mail.subhalt.xyz`) |
| `EMAIL_FROM_DOMAIN` | set to your sending domain |

`lib/env.ts:29-32` already reads all of these. Until at least
`INBOUND_EMAIL_DOMAIN` + one auth key are set, the modal shows the "not
configured yet" state and `/api/emails/inbound` returns 503 — that's designed, not
broken.

## What I'll implement (your signal needed)

| # | Item | Reason |
| - | ---- | ------ |
| B1 | **Enforce the monthly discovery quota server-side.** `maxEmailDiscoveryPerMonth` was declared (`lib/constants/plan-limits.ts:37` = 100 for Plus) but nothing counts usage — forwarded receipts are unbounded today. I'll add a small monthly counter (same pattern as `lib/services/receipt-scan-usage.ts`) and enforce it in `ingestReceiptDraft`. | Otherwise the "100/mo" you sell is a lie and a spam vector (anyone can forward unlimited fake receipts → DB spam). |
| B2 | **Expose forwarding state in the Settings → Integrations panel** (from A1): address + copy + Send Test Receipt + "not configured" reason. | Same discoverability gap as Gmail. |
| B3 | **Rate limit + required-marker checks** on `/api/emails/inbound` (per-user and per-provider burst cap; reject rows with no `recipient` already done). Also confirm `MAILGUN_SIGNING_KEY` vs `INBOUND_WEBHOOK_SECRET` precedence is documented in the modal state. | Abuse hardening; the webhook is a public POST endpoint. |

## Verify together (after provider is live)

1. `POST /api/emails/test` (signed in) → creates a sample "Netflix" subscription →
   appears in `/subscriptions` + inbox item. This tests the **whole pipeline
   except the mail server**.
2. With Mailgun: **Receiving → Routes → Test** (Mailgun sends a real test POST to
   the webhook). Watch `/api/emails/inbound` return 200.
3. Real end-to-end: email a receipt from your personal inbox to
   `receipts+<your-user-id>@<domain>` (get the exact address from the modal) →
   subscription appears.
4. Send garbage (no body/amount) → webhook returns 422 `invalid` silently, no row
   created.

---

# Shared checklist you'll do (regardless of Part)

- [ ] Google Cloud: enable Gmail API + consent screen + OAuth client with **both** redirect URIsden (Part A)
- [ ] Mailgun **or** Resend: domain + MX + route to `/api/emails/inbound` (Part B)
- [ ] Vercel env (Production): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI=https://subhalt.xyz/api/gmail/oauth/callback`, `CRON_SECRET`, `INBOUND_EMAIL_DOMAIN`, `MAILGUN_SIGNING_KEY` (or `INBOUND_WEBHOOK_SECRET`), `EMAIL_FROM`, `EMAIL_FROM_DOMAIN`
- [ ] Redeploy, then we run the verification steps together

---

# Open questions (answer these and I start)

1. **Settings → Integrations panel (A1/B2):** add it? It's the main real
   implementation work and I recommend yes.
2. **Price-change detection (A2):** fix the copy for now, or build price-change
   detection into the Gmail scanner (compare names/prices across scans)? Recommend
   copy fix now; detection later as its own feature.
3. **Mail provider:** Mailgun or Resend? If Mailgun, what subdomain — `mail.subhalt.xyz`?
4. **Forwarding quota (B1):** enforce the declared 100/mo for Plus (and 0 for free
   — meaning free users get `limit_reached`, matching the plan sheet), or leave
   uncapped?
5. **Google verification:** OK to ship Gmail in "Testing" mode with you as test user
   for now, and defer OAuth verification until you need random users to connect?

---

# Decisions (2026-10-07) & implementation status

| # | Question | Decision | Status |
|---|----------|----------|--------|
| 1 | Integrations panel | Yes, add to Settings | ✅ Done (component + section) |
| 2 | Price-change detection | Copy fix only, no detection yet | ✅ Done (copy changed) |
| 3 | Mail provider | **Resend Inbound** (one provider) | ✅ Code supports it; DNS + env still external |
| 4 | Forwarding quota | Enforce (free 0, plus 100, pro ∞) | ✅ Done (migration 014 + service + `ingestReceiptDraft`) |
| 5 | Google verification | Ship in Testing mode | ✅ Accepted by decision |

Extra hardening shipped with the code: per-hour burst cap (30/hr → HTTP 429),
accounting recorded only after a successful insert, and `rate_limited` mapped to
429 in `/api/emails/inbound`. Follow-ups pending model: OpenAI/Anthropic key for
the AI recap → leave `RESEND_API_KEY` out of `INBOUND_*` (Resend needs `EMAIL_FROM`
as an owned/sending domain, not just inbound).