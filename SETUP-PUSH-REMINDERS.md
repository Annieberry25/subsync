# Waking Up Push Notifications & Reminders — SubHalt

Everything below is a **deploy-time / dashboard task for the owner**. The code is
committed and `main` is green on CI; none of this happens automatically.

This enables:

- **Native browser push** (Web Push / VAPID) — replaces the credit-burning
  transactional emails for payment reminders and insight alerts.
- **Reminder preferences** — the per-subscription lead-time sheet and the
  Settings toggles (stored in the database, read by the cron).
- **Daily reminder cron** (`0 9 * * *`) and **weekend recap** (`0 10 * * 6`).
- **E-mail conservation** — welcome email kept, everything else prefers push.

There are three things to do, in this order:

1. Apply the database migration (Supabase).
2. Set the environment variables (Vercel).
3. Configure Supabase auth + webhooks (optional, but recommended).

---

## Step 1 — Apply the migration to the production database

Dashboard → **SQL Editor** → **New query**, paste the entire contents of

```
supabase/migrations/012_push_and_reminders.sql
```

from the repo, then **Run**.

It creates:

| Object | Purpose |
| ------ | ------- |
| `public.push_subscriptions` | `endpoint`, `p256dh`, `auth` per device/browser, RLS-scoped to the owner |
| `public.subscription_reminders` | `push_lead_days` / `email_lead_days` per subscription; `NULL` row = default |
| `set_reminder_preferences()` RPC | upserts the two leads so UI and cron agree |
| Check constraints | `push_lead_days > 0` and `email_lead_days > 0` (a `0` or `NULL` cannot be saved as "on") |
| RLS policies | Row only readable/writable by its owner; cron reads through the service role |

Expect a green **"Success"** banner (a few `CREATE TABLE` / `CREATE FUNCTION` /
`ALTER POLICY` statements). No data is destroyed.

> If it was already applied, just re-run it — every statement is idempotent.

---

## Step 2 — Set the environment variables in Vercel

Vercel → your project → **Settings → Environment Variables** → add these, for
**Production** (add Preview/Development too so local-style deploys work):

| Name | Value — copy from |
| ---- | ----------------- |
| `VAPID_PUBLIC_KEY` | `.env.local` line 14 (`VAPID_PUBLIC_KEY=...`) |
| `VAPID_PRIVATE_KEY` | `.env.local` line 15 (`VAPID_PRIVATE_KEY=...`) |
| `VAPID_SUBJECT` | `.env.local` line 16 (`VAPID_SUBJECT=mailto:hello@mail.subhalt.xyz`) |
| `EMAIL_FROM` | `.env.local` (`hello@mail.subhalt.xyz`) |
| `RESEND_API_KEY` | keep the existing value |
| `CRON_SECRET` | **not in `.env.local`** — generate one (`openssl rand -hex 32`) and add it to both Vercel and `.env.local` |

**Security notes:**

- `VAPID_PRIVATE_KEY` is a secret. It lives in your local `.env.local` (which is
  gitignored); **never** paste it into a file that gets committed.
- `NEXT_PUBLIC_*` keys (if any) are separate — VAPID is server-only.

After saving, **redeploy** (deployments don't pick up env changes until the next
deploy, and the VAPID public endpoint is served by a route).

### Verify

Open in the browser:

```
https://subhalt.xyz/api/push/vapid-public-key
```

It should return JSON like `{ "key": "BEkS0-q8T2_...", "email": "..." }`. If you
get `404` / an error, you are looking at a stale deployment — redeploy.

---

## Step 3 — Turn it on in the app (manual smoke test)

1. Log in at `https://subhalt.xyz`.
2. **Settings → Push notifications → enable.** The browser asks for permission —
   grant it. The toggle then stays on.
3. Open a subscription → **Payment reminders** → pick a lead time (e.g. 3 days).
   Save.
4. To test immediately without waiting for the daily cron, trigger the route by
   hand:

   ```sh
   curl -X POST https://subhalt.xyz/api/cron/send-reminders \
     -H "Authorization: Bearer $CRON_SECRET"
   ```

   With no due subscription in range the response is `{ "ok": true, "pushed": 0,
   "emailed": 0, ... }` — that is success.

   The weekend recap, for later:

   ```sh
   curl -X POST https://subhalt.xyz/api/cron/weekly-recap \
     -H "Authorization: Bearer $CRON_SECRET"
   ```

> Vercel invokes both crons itself from `vercel.json` (`0 9 * * *` and
> `0 10 * * 6`); manual `curl` is only for testing. A cron **must** be run while
> authenticated as the user to work in a browser tab — the daily run is what
> matters.

---

## Step 4 — Magic Link / OTP template (required for 6-digit sign-in)

The app signs users in with a **6-digit email code**, and the default Supabase
Magic Link template only contains a clickable link. If it is not updated, sign-in
shows a code box that never arrives.

Dashboard → **Authentication → Email Templates → Magic Link**:

- Confirm **"Enable email confirmations"** path if used.
- Make sure the body contains the OTP token marker, e.g.:

  ```
  Your SubHalt code is {{ .Token }}
  ```

  (or keep a link and add the token line — the important part is `{{ .Token }}`.)

- Save. Send yourself a test email from the template editor to confirm the code
  renders.

Do the same for the **Confirm signup** template if your flow relies on it.

---

## Step 5 — Database webhooks (optional; instant push instead of daily)

Without webhooks, reminders push during the **next cron run** (at worst ~24h
after `next_billing_date` hits the lead window). Webhooks make a newly-created
subscription push immediately, and reserve email even harder (webhook
notifications are push-only; see `app/api/webhooks/supabase/route.ts`).

1. First add `SUPABASE_WEBHOOK_SECRET` to Vercel (any long random string —
   `openssl rand -hex 32`).
2. Dashboard → **Database → Webhooks → Create a webhook**, twice:

   | Table | Event | Destination |
   | ----- | ----- | ----------- |
   | `auth.users` | `INSERT` | `https://subhalt.xyz/api/webhooks/supabase` |
   | `subscriptions` | `INSERT` | `https://subhalt.xyz/api/webhooks/supabase` |

3. Headers: `Authorization: Bearer <your SUPABASE_WEBHOOK_SECRET>` and
   `Content-Type: application/json`. Body = "The rows of the database table
   that fired the webhook" (the route reads `type`/`table` from it).
4. Save, then press **Test** on each and confirm a `200` with
   `{ "ok": true, ... }`.

The route ignores anything that is not an `INSERT` on those two tables, and it
never uses the email path for reminders.

---

## Rollback / turning it off

- **Push off for everyone:** remove the Vercel env vars and redeploy — the
  subscribe routes 404. Existing rows in `push_subscriptions` remain harmless.
- **Reminders off:** set `push_lead_days = NULL` and `email_lead_days = NULL`
  (or delete rows) in `subscription_reminders`; the cron skips rows with no
  preference.
- **Migration rollback** isn't a `down()` — restore the database from a snapshot
  if ever needed; the two new tables are additive and ignored by older builds.