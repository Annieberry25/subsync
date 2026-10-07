# Gmail Receipt Discovery — Setup & How It Works

This replaces the old simulated "Connect Gmail" button (which just waited 1.8 s and
showed hardcoded subscriptions) with a real OAuth 2.0 connection to the Gmail API.

## What you need to set up (once, in Google Cloud)

1. Go to <https://console.cloud.google.com> and create (or reuse) a project.
2. Enable the **Gmail API**:
   - APIs & Services → Library → search "Gmail API" → Enable.
3. Configure the **OAuth consent screen**:
   - APIs & Services → OAuth consent screen.
   - User type: **External** (Internal is fine for testing but only works for Google
     Workspace accounts).
   - Add the scope: `.../auth/gmail.readonly` → "View your email messages and settings".
4. Create an **OAuth 2.0 Client ID** (type: **Web application**):
   - Authorized redirect URIs — add:
     - `http://localhost:3000/api/gmail/oauth/callback` (local dev)
     - `https://your-app-domain.com/api/gmail/oauth/callback` (production)
   - Copy the Client ID and Client Secret.
5. Copy `.env.example` values into `.env.local`:

   ```
   GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=xxxxx
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/gmail/oauth/callback
   ```
6. Apply the database migration: `supabase/migrations/008_gmail_connections.sql`
   (or run `supabase db push` with the migrations folder).

> **Verification**: `gmail.readonly` is a *restricted* scope. For local testing the
> Google consent screen will show "Google hasn't verified this app" — click
> *Advanced → Go to <app>* to continue. Before shipping to real users you must
> complete Google's OAuth app verification + a security assessment.

## How the flow works

```
Browser                          Next.js (server)                Supabase / Google
-----                            ---------------                 -----------------
Click "Authorize Google Account"
  → POST/GET /api/gmail/auth
  → sets CSRF state cookie
  → returns accounts.google.com URL
  → user approves "<app> wants to
    read your Gmail messages"
Google redirects to
  /api/gmail/oauth/callback?code&state
  → validates state cookie
  → exchanges code for tokens
  → stores refresh token (server-only)
  → redirects to /subscriptions?gmailConnected=1
Page auto-opens the modal with autoScan
  → POST /api/gmail/scan
  → gmail.users.messages.list(q=...)
  → fetch bodies of candidates
  → parse amounts/providers
  → user reviews & imports
```

## Security notes

- The **client secret and tokens never reach the browser**. All Google calls happen
  in API routes using the service-role Supabase client.
- Tokens are stored in `gmail_connections` (RLS: no client policies; browser can't
  read them). The `/api/gmail/status` route returns only safe display fields.
- A one-time random `state` value is stored in a short-lived HttpOnly cookie and
  validated on the callback to prevent CSRF token injection.
- The only scope requested is `https://www.googleapis.com/auth/gmail.readonly` —
  read access to emails. No send/delete/modify permissions.

## API routes

| Route | Method | Purpose |
| ----- | ------ | ------- |
| `/api/gmail/auth` | GET | Generate the Google consent URL (sets state cookie) |
| `/api/gmail/oauth/callback` | GET | Code exchange → store tokens → redirect back |
| `/api/gmail/status` | GET | `{ connected, email, lastScanAt }` for the UI |
| `/api/gmail/scan` | POST | Run a bounded inbox scan, return candidates |
| `/api/gmail/disconnect` | POST | Revoke token + delete the connection row |

## Scan behavior

The scanner queries `subject:(receipt OR invoice OR "payment confirmation" OR
"your subscription" OR "order confirmation" OR "billing statement") newer_than:1y`,
reads metadata for up to 60 messages, deep-reads the 20 most promising, and
extracts provider/amount/currency/date with `lib/services/bill-receipt-parser.ts`.
Results are de-duplicated by provider before the review step.

## Background Gmail monitoring (auto-import)

The on-demand scan above still exists, but connected inboxes are now also
monitored in the background by `POST/GET /api/cron/gmail-rescan`, which batches up
to 10 connected users, rescans their inbox, and auto-imports any *new* receipts
(skips duplicates, respects the free-tier limit). It expects one of:

- `x-cron-secret: <CRON_SECRET>` header, or
- `Authorization: Bearer <CRON_SECRET>`.

Set `CRON_SECRET` (any long random string) in the environment. Then pick one runner:

- **Vercel Cron**: `vercel.json` already registers `0 6 * * *` → the route.
  That is **once a day (06:00 UTC)** because Hobby plans reject sub-daily crons.
  This is not a warning — Vercel validates the schedule when it builds, so a
  `0 */6 * * *` entry fails the whole deployment and nothing gets published.
  For more frequent scans, upgrade to Pro, or use one of the two options below.
- **Self-hosted**: set `ENABLE_BACKGROUND_GMAIL_SCAN=true` and `NEXT_PUBLIC_SITE_URL`
  to your deployed origin; `instrumentation.ts` triggers the route on a 6-hour loop.
- **Any external cron** (keeps the 6-hour cadence on Hobby): point
  cron-job.org, GitHub Actions, or a machine-level `crontab` at the route with
  the secret header.

Note that `instrumentation.ts` only helps when you self-host. On Vercel it is
inert unless `ENABLE_BACKGROUND_GMAIL_SCAN=true`, which you should leave off
there since `vercel.json` already provides the schedule.

## Email forwarding (inbound receipts)

Users get a personal receiving address `receipts+<userId>@<INBOUND_EMAIL_DOMAIN>`.
Forward any receipt/invoice to it and it is parsed and added as a subscription
(deduped, quota enforced). Setup with **Resend Inbound** (the single-provider
choice for this deployment):

1. **Resend**: add an Inbound Domain (e.g. `mail.yourdomain.com`) under
   *Domains → Add domain → Type: Inbound*. Resend gives you the MX record to add
   at your DNS provider (typically `feedback-smtp.us-east-1.amazonses.com`). Then
   create a Webhook (`<Webhooks> → Add domain event` or per-domain Inbound rule)
   that POSTs to `https://your-app-domain.com/api/emails/inbound` with a secret.
2. Env vars:

   ```
   INBOUND_EMAIL_DOMAIN=mail.yourdomain.com     # bare lowercase host of the +tag address
   INBOUND_WEBHOOK_SECRET=xxx                   # shared secret Resend sends with the webhook
   ```

   If `MAILGUN_SIGNING_KEY` is set instead, each webhook is verified via the
   Mailgun HMAC-SHA256 signature (timestamp+token) using `multipart/form-data`
   payloads. Otherwise (the Resend path) the webhook requires `INBOUND_WEBHOOK_SECRET`
   (form field `secret`, header `x-webhook-secret`, or `Authorization: Bearer`).
   With neither set the route returns 503.
3. The UI reads the address from `GET /api/emails/forwarding-address` and the
   "Send Test Receipt" button (in the modal or the Settings → Integrations panel)
   runs a sample through the real pipeline via `POST /api/emails/test`.

**Quota & limits** (enforced server-side in `ingestReceiptDraft`):
- Monthly discovery quota `maxEmailDiscoveryPerMonth` = 0 (Free), 100 (Plus),
  ∞ (Premium). Free users are blocked immediately; Plus users get 100 forwarded
  receipts per calendar month (UTC).
- A per-user burst cap of 30/hour protects the webhook from a single faulty
  forward exploding into a flood; bursts return HTTP 429 `rate_limited`.
- Accounting rows live in `email_discovery_usage` (migration `014`), written
  server-side only via the service role, mirroring `receipt_scan_usage`.

## Email forwarding API routes

| Route | Method | Purpose |
| ----- | ------ | ------- |
| `/api/emails/forwarding-address` | GET | Returns the signed-in user's `receipts+<id>@<domain>` |
| `/api/emails/inbound` | POST | Provider webhook: verify, parse, create subscription |
| `/api/emails/test` | POST | Authenticated self-test of the inbound pipeline |