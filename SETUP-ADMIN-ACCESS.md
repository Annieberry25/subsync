# Making an Account Admin — SubHalt

How to grant and revoke `/admin` access. Verified against the live database:
`profiles.is_admin` exists, and the `set_user_admin` RPC is deployed and enforcing
its own guard.

---

## How admin access works

`public.profiles.is_admin` is the **server-side source of truth**. Nothing else
grants admin. Three places read it:

| Where | File | Effect when false |
| ----- | ---- | ----------------- |
| Middleware | `middleware.ts` → `/admin/*` | Redirects to `/` |
| API routes | `lib/auth/admin-guard.ts` (`requireAdmin()`) | `401` / `403` |
| Sidebar | `user-settings-context.tsx` | Hides the **Admin** nav item |

A `profiles` row is created automatically by the `handle_new_user` trigger the
moment you sign up, so **the row already exists** if you have an account.

---

## Step 1 — Confirm your account exists

Dashboard → **SQL Editor** → **New query**:

```sql
SELECT id, email, is_admin, created_at
FROM public.profiles
ORDER BY created_at DESC
LIMIT 20;
```

Note the exact `email` for the account you are promoting. That string is what the
next step matches on.

If your email is **not** in that list, stop — see
[No profile row](#no-profile-row) below.

---

## Step 2 — Bootstrap: promote the first admin

This has to be a direct SQL `UPDATE`. The `set_user_admin()` function refuses any
caller who is not already an admin ("Only an admin can manage admin roles"), so
it cannot be used to create the *first* one. This is deliberate — it is why a
signed-up user cannot self-promote.

```sql
UPDATE public.profiles
SET is_admin = true
WHERE email = 'you@example.com';
```

You should see **`UPDATE 1`**.

> Match on `email`, not a user id. `auth.users.id` and `public.profiles.id` are
> the same value, but typing the email avoids having to look the uuid up.

---

## Step 3 — Verify

```sql
SELECT id, email, is_admin
FROM public.profiles
WHERE is_admin = true;
```

Your row should be listed with `is_admin = true`. If it returns **zero rows**,
see [troubleshooting](#troubleshooting).

---

## Step 4 — Sign out and back in

Sign out (the sidebar's account menu → Sign out), then sign in again and reload.

The sidebar reads the flag once when `UserSettingsProvider` mounts, so a stale
`true`/`false` can persist in an open tab. Middleware re-reads it on every
request, so `/admin` itself will respond correctly either way.

---

## Step 5 — Confirm in the app

- An **Admin** entry appears in the sidebar, under Settings.
- `https://subhalt.xyz/admin` loads instead of redirecting to `/`.

Admin areas:

| Path | Purpose |
| ---- | ------- |
| `/admin` | Overview: totals, growth, revenue, recent activity |
| `/admin/users` | Search users, change role / plan, toggle admin |
| `/admin/payments` | Payment history and plan subscriptions |
| `/admin/providers` | Verified provider catalog |
| `/admin/integrations` | AdSense, Supabase, Gmail, Paystack |

---

## Promoting other admins

Once you are an admin, use the UI: **Admin → Users → role toggle**. That calls
`POST /api/admin/users/:id/role`, which invokes `set_user_admin()` using *your*
session so `auth.uid()` resolves to you.

Two guards apply:

- You **cannot change your own role** from the UI (returns
  `You cannot change your own admin role.`). To demote yourself, use the SQL in
  the next section.
- `set_user_admin()` refuses to remove the **last remaining admin**
  (`Cannot demote the last remaining admin`), which prevents lockout.

---

## Revoking admin

**Via the UI:** Admin → Users → toggle the account off. Blocked for your own
account, and blocked for the last admin.

**Via SQL** (works for yourself):

```sql
-- Demote a specific account
UPDATE public.profiles
SET is_admin = false
WHERE email = 'someone@example.com';

-- Or, using the guarded function so the last-admin check applies.
-- Must be run while signed in as an admin, e.g. from the Supabase dashboard
-- this will NOT work: auth.uid() is null there, so it raises
-- "Only an admin can manage admin roles".
```

> The `set_user_admin()` function identifies the caller from the request's JWT.
> Running it from the SQL Editor does **not** work — the dashboard is not an
> admin session, so `auth.uid()` is null and the function raises. Use plain
> `UPDATE` from the editor for bootstrap and self-demotion; use the function
> (via the admin UI) for everything else.

---

## Troubleshooting

### `UPDATE 0`

The `WHERE email = ...` matched no row. Check for:

- **Trailing whitespace or a different address.** Google sign-in can store a
  capitalised or otherwise normalised address. Find the real value with:
  ```sql
  SELECT id, email FROM public.profiles
  WHERE email ILIKE '%yourdomain.com%';
  ```
  `ILIKE` is case-insensitive, which is usually the fix.
- **The account signed up before the profile trigger existed.** See below.

### No profile row

If `SELECT ... FROM public.profiles` returns nothing for your email, the account
exists in `auth.users` but has no profile. Create it, copying the id from
`auth.users`:

```sql
SELECT id, email, raw_user_meta_data
FROM auth.users
WHERE email ILIKE '%yourdomain.com%';
```

Then:

```sql
INSERT INTO public.profiles (id, email, full_name, avatar_url, is_admin)
SELECT
  id,
  email,
  raw_user_meta_data->>'full_name',
  raw_user_meta_data->>'avatar_url',
  true
FROM auth.users
WHERE email = 'you@example.com'
ON CONFLICT (id) DO UPDATE SET is_admin = true;
```

### `/admin` still redirects to `/`

1. Are you signed in on **that** browser profile? A different browser or private
   window has its own cookie session.
2. Is the Site URL / auth redirect configured? If Google sign-in bounces, see
   `AUTH-AND-SCHEMA-FIXES.md` §1 — the Supabase project's Site URL is still
   `http://localhost:3000`.
3. Confirm the flag actually persisted — re-run the Step 3 query.

### Admin item missing but `/admin` works

The sidebar reads the flag once on mount. Hard-reload (Ctrl+Shift+R) or sign out
and back in.

### `Access denied.` or `403` from an admin API route

The route's `requireAdmin()` did not see `is_admin = true` for **your** session.
Usually a stale session; sign out and back in.

---

## Security notes

- `is_admin` grants **read** access across `profiles`, `subscriptions`,
  `bill_payments`, `plan_subscriptions`, `activity_log` and
  `ai_conversations` via RLS policies scoped to `public.is_admin()`.
- Admin **writes** go through server routes using the service role. Admins
  cannot write `plan_subscriptions` or `gmail_connections` from the browser.
- `gmail_connections` deliberately has **no** admin RLS policy — it holds OAuth
  tokens and is reachable only through service-role routes.
- Never put the service-role key in anything the browser can read. It is
  server-only and lives in `SUPABASE_SERVICE_ROLE_KEY`.
- Keep at least two admins so you cannot lock yourself out; the database refuses
  to remove the last one, but a second account is still prudent.