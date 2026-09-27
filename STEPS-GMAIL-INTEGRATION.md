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

- **Vercel Cron**: `vercel.json` already registers `0 */6 * * *` → the route.
- **Self-hosted**: set `ENABLE_BACKGROUND_GMAIL_SCAN=true` and `NEXT_PUBLIC_SITE_URL`
  to your deployed origin; `instrumentation.ts` triggers the route on a 6-hour loop.
- **Any external cron**: hit the route with the secret header on your own schedule.

## Email forwarding (inbound receipts)

Users get a personal receiving address `receipts+<userId>@<INBOUND_EMAIL_DOMAIN>`.
Forward any receipt/invoice to it and it is parsed and added as a subscription
(deduped, free-tier enforced). Setup:

1. Get an inbound-email provider that supports Mailgun-style incoming webhooks or
   Resend-style inbound (the webhook parses `multipart/form-data` from either):
   - **Mailgun** (recommended): create a domain (or subdomain) in a region without
     boilerplate; add the MX records Mailgun gives you; go to
     *Receiving → Routes* and forward with filter `recipient "receipts+*@"` to
     `https://your-app-domain.com/api/emails/inbound`. Copy the domain's HTTP
     Webhook Signing Key.
   - **Resend**: set up Inbound Domains, then point their `to=<domain>` rule at the
     same webhook URL.
2. Env vars:

   ```
   INBOUND_EMAIL_DOMAIN=yourdomain.com          # host part of the +tag address
   MAILGUN_SIGNING_KEY=xxx                      # required for Mailgun; else
   INBOUND_WEBHOOK_SECRET=xxx                   # shared secret fallback / Resend
   ```

   If `MAILGUN_SIGNING_KEY` is set, each webhook is verified via the Mailgun
   HMAC-SHA256 signature (timestamp+token). Otherwise the webhook requires
   `INBOUND_WEBHOOK_SECRET` (form field `secret`, header `x-webhook-secret`, or
   `Authorization: Bearer`). With neither set the route returns 503.
3. The UI reads the address from `GET /api/emails/forwarding-address` and the
   "Send Test Receipt" button in the modal runs a sample through the real pipeline
   via `POST /api/emails/test`.

## Email forwarding API routes

| Route | Method | Purpose |
| ----- | ------ | ------- |
| `/api/emails/forwarding-address` | GET | Returns the signed-in user's `receipts+<id>@<domain>` |
| `/api/emails/inbound` | POST | Provider webhook: verify, parse, create subscription |
| `/api/emails/test` | POST | Authenticated self-test of the inbound pipeline |