# Gmail Connection — Complete Setup Guide

Everything you need to turn on the Gmail integration end-to-end: connect a
user's inbox, discover subscription receipts, and (optionally) let the app
re-scan inboxes automatically in the background.

There are three parts:

1. **Google Cloud** — create the OAuth client (do this once).
2. **This app** — env vars + the database table (do this once per environment).
3. **Verify** — connect an account, run the scan, enable monitoring.

---

## Part 1 — Google Cloud Console (one-time)

1. Go to <https://console.cloud.google.com> and create (or reuse) a project.

2. Enable the **Gmail API**:
   - **APIs & Services → Library** → search *Gmail API* → **Enable**.

3. Configure the **OAuth consent screen**:
   - **APIs & Services → OAuth consent screen**.
   - User type: **External** (Internal only works for Google Workspace accounts).
   - Add the scope: `.../auth/gmail.readonly` → "View your email messages and settings".

4. Create an **OAuth 2.0 Client ID** (type: **Web application**):
   - **Authorized redirect URIs** — add *both*:
     - `http://localhost:3000/api/gmail/oauth/callback` (local dev)
     - `https://your-app-domain.com/api/gmail/oauth/callback` (production)
   - Copy the **Client ID** and **Client Secret**.

> **Note:** `gmail.readonly` is a *restricted* scope. For local testing the
> consent screen shows "Google hasn't verified this app" — click *Advanced →
> Go to <app>* to continue. Before shipping to real users you must complete
> Google's OAuth app verification.

---

## Part 2 — App setup

### 2.1 Add the Google credentials

Add to `.env.local` (and the production dashboard):

```
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxx
GOOGLE_REDIRECT_URI=http://localhost:3000/api/gmail/oauth/callback
```

`GOOGLE_REDIRECT_URI` can be left empty in local dev (defaults to
`http://localhost:3000/api/gmail/oauth/callback`).

### 2.2 Apply the database migration

Apply `supabase/migrations/008_gmail_connections.sql` in the Supabase dashboard
**SQL Editor** (this project has no CLI/config.toml). Recommended order for a
fresh database:

1. `supabase/schema.sql` (base schema)
2. `supabase/migrations/008_gmail_connections.sql`
3. `supabase/migrations/009_admin_roles.sql`

`008` creates the `gmail_connections` table that stores the per-user OAuth
tokens. It is service-role-only (no RLS client policies), so tokens never leak
to the browser.

### 2.3 (Optional) Turn on background monitoring

To let the app re-scan connected inboxes automatically, set up one runner:

- **On Vercel:** nothing to do — `vercel.json` already registers the cron
  (`0 */6 * * *` → `/api/cron/gmail-rescan`). You only need `CRON_SECRET`.
- **Self-hosted Node server:** add these env vars:

  ```
  CRON_SECRET=<long-random-string>
  ENABLE_BACKGROUND_GMAIL_SCAN=true
  NEXT_PUBLIC_SITE_URL=https://your-app-domain.com
  ```

  `instrumentation.ts` will trigger the rescan every 6 hours.
- **Any external cron:** hit `GET|POST /api/cron/gmail-rescan` on your own
  schedule with header `x-cron-secret: <CRON_SECRET>` (or
  `Authorization: Bearer <CRON_SECRET>`).

`CRON_SECRET` is required by the cron endpoint regardless of runner.

### 2.4 Restart the dev server

The env vars are read at startup. Restart `npm run dev` (or rebuild in
production) after changing them.

---

## Part 3 — Verify

### 3.1 Connect an account

1. Start the app and sign in.
2. Go to **Add Subscription → Connect Gmail** (or Settings → Integrations).
3. Click **Authorize / Connect Google Account**.
4. On the Google consent screen, approve the inbox read access.
5. You should land back on the app (the modal auto-opens on success).

### 3.2 Check the status endpoint

Connectivity state is exposed at `GET /api/gmail/status` (authenticated).
Expected shape:

```json
{ "connected": true, "email": "you@gmail.com", "lastScanAt": null }
```

### 3.3 Run an on-demand scan

With the modal open (or directly):

```
POST /api/gmail/scan
```

The scan:
- Queries `subject:(receipt OR invoice OR "payment confirmation" OR
  "your subscription" OR "order confirmation" OR "billing statement")
  newer_than:1y`
- Reads up to 60 message headers, deep-reads the 20 most promising bodies
- Extracts provider / amount / currency with `lib/services/bill-receipt-parser.ts`

Candidates appear in the modal review list; approve the ones you want imported.
Category values are mapped to the valid subscription enum before insert
(`mapBillCategoryToSubscriptionCategory`), so DB CHECK constraints cannot reject
them.

### 3.4 Verify monitoring

1. Confirm `gmail_connections.last_scan_at` updates after a scan/run.
2. Trigger the cron manually:

   ```
   curl -X POST https://your-app-domain.com/api/cron/gmail-rescan \
     -H "x-cron-secret: <CRON_SECRET>"
   ```

   Expected response:

   ```json
   { "scanned": 1, "created": 0, "duplicates": 0, "limitReached": 0, "invalid": 0, "errors": [] }
   ```

   New receipts are auto-imported (deduped; free-tier users are capped at 3
   active subscriptions).

---

## Security notes

- Tokens live only in server API routes (service-role Supabase client). The
  browser never sees the client secret or refresh tokens.
- Tokens are stored in `gmail_connections` with **no client RLS policies**.
  `/api/gmail/status` returns only safe display fields.
- A one-time random `state` cookie is validated on the callback to prevent CSRF
  token injection.
- The only scope requested is `gmail.readonly` — read access. No send/delete/
  modify permissions.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| ------- | ------------ | --- |
| `redirect_uri_mismatch` | Callback URL not registered | Add `http://localhost:3000/api/gmail/oauth/callback` (and prod URL) in Google Console |
| "Google hasn't verified this app" | `gmail.readonly` is restricted | Advance past the warning for testing; complete app verification for production |
| `invalid_grant` | Stale refresh token | Disconnect (`POST /api/gmail/disconnect`) and reconnect the account |
| `/api/cron/gmail-rescan` → 401 | Wrong/missing `CRON_SECRET` | Set `CRON_SECRET` and send `x-cron-secret` (or Bearer) header |
| Scan finds nothing | No receipt keywords in the last year | Send a real receipt to the inbox, then re-scan |
| Tokens not persisted | Migration `008` not applied | Run `supabase/migrations/008_gmail_connections.sql` in the SQL Editor |