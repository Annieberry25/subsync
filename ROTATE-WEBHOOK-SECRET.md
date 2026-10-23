# Rotate SUPABASE_WEBHOOK_SECRET (do this now)

**Why:** the webhook secret was committed in plain text at `SIGNUP-WELCOME-WEBHOOK.sql:28`
and your GitHub repo is **public**. Anyone can read it and forge webhook calls to
`https://subhalt.xyz/api/webhooks/supabase` (spam welcome emails under your domain,
burn your Resend quota). It was exposed starting today's push (`40792dc`) — likely only
a few hours, so probably not abused yet. Nothing else was leaked; rotate **this one
secret only**.

**Order:** steps 1 and 2 should happen back-to-back (within a couple of minutes).
Worst case during the gap: a signup doesn't receive its welcome email (the route fails
closed). No data loss, nothing else breaks.

---

## Step 1 — Generate a new secret

Open PowerShell and run:

```powershell
[System.Guid]::NewGuid().ToString('N') + [System.Guid]::NewGuid().ToString('N')
```

That prints a 64-character hex string. **Copy it.** This is your new secret.

## Step 2 — Update Vercel

1. Open your Vercel project → **Settings → Environment Variables**
2. Find `SUPABASE_WEBHOOK_SECRET`
3. Set it to the new value (paste over the old one)
4. **Redeploy** the project (env changes only apply to new deployments —
   Deployments → "..." → Redeploy)

## Step 3 — Update the Supabase trigger

The database function sends the secret as a literal inside the SQL, so Supabase must
have the new value too.

1. Supabase Dashboard → **SQL Editor → New query**
2. Paste the script below
3. **Replace `YOUR_NEW_SECRET_HERE` with the value you generated in Step 1**
4. Run it

```sql
-- Rotate webhook secret: recreates the function with the new x-webhook-secret.
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_signup_welcome()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  perform net.http_post(
    url := 'https://subhalt.xyz/api/webhooks/supabase',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', 'YOUR_NEW_SECRET_HERE'
    ),
    body := jsonb_build_object(
      'type', format('INSERT:%I.%I', TG_TABLE_SCHEMA, TG_TABLE_NAME),
      'table', TG_TABLE_NAME,
      'record', to_jsonb(new)
    )
  );
  return new;
end;
$$;
```

(The script is idempotent — re-running it is safe. Vercel redeploy and this step
should be done within a minute or two of each other.)

## Step 4 — Verify

1. Forged request must be rejected (expects 401):

   ```powershell
   curl.exe -s -o NUL -w "%{http_code}" -X POST https://subhalt.xyz/api/webhooks/supabase `
     -H "Content-Type: application/json" -H "x-webhook-secret: totally-wrong" `
     -d "{\"type\":\"INSERT:auth.users\",\"table\":\"users\",\"record\":{}}"
   ```

   `401` = good.

2. Real signup (new test account) → welcome email arrives within a minute.

## Step 5 — Clean the value out of the repo

Editing this file does **not** un-leak the old secret (it stays in git history) — but
after Steps 1–3 the old value is dead, so this step is hygiene, not the fix.

1. In `SIGNUP-WELCOME-WEBHOOK.sql`, replace the value on line 28 with
   `YOUR_WEBHOOK_SECRET_HERE` and update the comment above it to say the value must be
   pasted in when running the script
2. Commit and push:

   ```powershell
   git add SIGNUP-WELCOME-WEBHOOK.sql
   git commit -m "chore(security): strip webhook secret from SQL script"
   git push
   ```

   (Or just ask me to do this step.)

## Optional extras

- **Check Resend dashboard** (Activity) for unexpected send volume in the last few hours.
- **Purge git history** (`git filter-repo` / BFG + force-push) to remove the old value
  from history. Not required once the secret is rotated — a dead secret is harmless —
  but it's good hygiene. Doing this rewrites history for everyone with a clone.
