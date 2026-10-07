# SubHalt (Subsync) Security Audit Report

> Full audit findings plus the critical fixes that were implemented.
> Date: Wed Oct 07 2026 · Repo: `C:\Users\USER\Projects\subsync`

---

## 1. Summary

Full security/vulnerability audit of the SubHalt app (Next.js 16 App Router,
Supabase Postgres + RLS + GoTrue auth, Paystack payments, Gmail OAuth, Groq AI,
Resend email, Web Push). Reviewed route handlers, auth/session flow, Supabase
migrations/RLS, payment + webhook verification, file upload, AI/server services,
headers/CSP, and secret handling.

Two critical findings (privilege escalation + untrusted plan gating) have been
**fixed and verified**. The remaining high/medium/low items are documented below;
none has been changed yet.

---

## 2. Findings by severity

### Critical

**C1 — Self-admin privilege escalation via `profiles` RLS UPDATE policy**
(`supabase/schema.sql:29-32`, original)

```sql
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);
```

There was no `WITH CHECK` restricting columns, and **no migration revokes or
restricts UPDATE on `profiles`** (grep of all migrations found zero GRANT/REVOKE
on it). Supabase's default grants give `authenticated` full DML, so any user can
run from DevTools:

```js
supabase.from('profiles').update({ is_admin: true, plan_tier:'premium' }).eq('id', user.id)
```

RLS passes (own row), and the server trusts that row:

- `requireAdmin` → `lib/auth/admin-guard.ts:14`
- Middleware admin gate → `lib/supabase/middleware.ts:96-107`
- Sub cap check reads `is_admin`/`plan_tier` via the **browser client** →
  `lib/services/subscription-service.ts:686-706`
- All `/api/admin/*` routes

Result: full administrator + unlimited-tier takeover by any signed-in user.

**C2 — Plan tier is derived from self-editable `auth.user_metadata`**
(`lib/auth/access.ts:25-33`, original)

`getPlanTier()` trusted `user.user_metadata.plan_tier`. Any user can call
`supabase.auth.updateUser({ data: { plan_tier:'premium', plan_expires_at:'…' } })`
— a supported, unguarded client API. It bypassed the receipt-scan quota
(`app/api/receipts/extract/route.ts:102`), `hasPlanFeature` gates (Gmail,
forwarding), ad suppression, and plan UI. The server already knew the real value
via `lib/services/receipt-ingestion.ts:104` (`isPlusUser` reads `profiles` with
the service role) — that is the pattern now used everywhere. Additionally,
`getPlanTier` never checked `plan_expires_at`, so expiry was not enforced at all.

### High

**H1 — Session cookie is `httpOnly: false`** (`lib/supabase/cookie-options.ts:65-69`)
combined with CSP `script-src 'unsafe-inline' 'unsafe-eval'` (`next.config.ts:65`).
The Supabase auth token is readable by any JS in the page. No
`dangerouslySetInnerHTML`/reflection sink was found today, but **one future XSS
bug = full account takeover** (financial data, Gmail OAuth, admin). This is a
documented design tradeoff for the browser-side data layer; at minimum harden
the CSP (drop `unsafe-eval`, add nonces incl. for the AdSense script,
`object-src 'none'`), and consider moving privileged reads behind `httpOnly`
cookies with server authentication.

**H2 — Gmail OAuth refresh tokens stored plaintext** in
`gmail_connections.credentials` JSONB (`lib/services/gmail-service.ts:128-137`).
Refresh tokens are long-lived credentials to users' inboxes (`gmail.readonly`
but includes receipt content). Encrypt at rest (pgcrypto/KMS envelope); table
access is already service-role-only, which is good.

### Medium

- **M1 — Rate limiter trusts `x-forwarded-for`** (`lib/rate-limit.ts:30,57-63`).
  The first comma-separated value is attacker-controlled on many proxies: an
  attacker can consume a victim's 30 req/min budget (per-IP DoS) or rotate
  spoofed IPs to bypass throttling of auth/paystack endpoints. Use the
  platform's edge-provided IP (Vercel/Cloudflare header) or hash the last
  trusted hop.
- **M2 — Post-login redirect host from `x-forwarded-host`**
  (`app/auth/callback/route.ts:48-59`). After a successful code exchange the
  redirect target uses `x-forwarded-host`, which reflects the request `Host`
  header. Open-redirect applies only post-authentication, but validate against
  an allow-list (`getSiteUrl()`/`NEXT_PUBLIC_SITE_URL` + localhost).
- **M3 — Gmail OAuth state cookie not bound to a user**
  (`app/api/gmail/auth/route.ts:30-40`). Bind the state value to `user.id` and
  verify it in the callback to prevent cross-user token-store confusion in
  multi-tab flows.

### Low / hardening

- Plan expiry never enforced — past-due paid tiers stayed active until a
  manual downgrade/cancel. *(Now enforced — see section 3.)*
- `app/api/gmail/scan/route.ts:25` and `app/api/ai/chat/route.ts:106-109`
  return internal error detail to clients; strip these.
- `generateTransactionReference` embeds a userId fragment in the Paystack
  reference (`lib/paystack/index.ts:65-69`).
- `delete-account` requires a password; Google-only users have none and can't
  self-delete.
- `getGoogleRedirectUri` defaults to `localhost:3000`
  (`lib/services/gmail-service.ts:57-59`) — ensure `GOOGLE_REDIRECT_URI` is
  always set in prod or OAuth silently misbehaves.
- `.env.local` is present but **correctly gitignored and untracked** (verified
  with `git ls-files`/`check-ignore`) — no committed secrets; keep it that way
  and rotate if it was ever shared.

### Verified sound

- Paystack HMAC-SHA512 webhook (`verifyWebhookSignature`), constant-time
  cron/inbound/Supabase secret compares, fail-closed Supabase webhook.
- Tight RLS on `plan_subscriptions`, `gmail_connections`, `name_change_log`,
  `rate_limit_events`, `receipt_scan_usage`; matching amount/currency
  verification before granting plans.
- File upload: outright size caps, magic-byte MIME sniffing, plan quota,
  bounded PDF/image parsing.
- No SSRF (all server fetches are fixed hosts), no shell execution, no
  `dangerouslySetInnerHTML`.
- PKCE flow, uniform login errors (no user enumeration), `getSafeRedirectUrl`
  blocks `next` open-redirect.
- Security headers + CSP with `frame-ancestors 'none'`; server secrets confined
  to `server-only` modules.

---

## 3. Fixes implemented (C1 + C2)

### C1 fix — RLS migration

**New file:** `supabase/migrations/013_restrict_profile_updates.sql`

- Added a SECURITY DEFINER recall function `public.own_privileged_profile()`
  that returns the **caller's own** `is_admin`, `plan_tier`, `plan_expires_at`
  (same pattern migration 009 uses for `is_admin()` to avoid RLS recursion).
  It cannot read another user's flags because it is hard-wired to `auth.uid()`.
- Replaced the broad `"Users can update their own profile"` policy with
  `"Users can update non-privileged profile fields"` whose `WITH CHECK` only
  passes when the three privileged columns are unchanged
  (`IS NOT DISTINCT FROM` the recalled committed values).
- Defense-in-depth:
  `REVOKE UPDATE (is_admin, plan_tier, plan_expires_at) ON public.profiles
   FROM anon, authenticated;`
  so even a future policy slip errors out at the privilege layer.
- `supabase/schema.sql` synced: added `plan_tier`, `plan_expires_at`,
  `is_admin` to the profiles DDL and inlined the same restricted policy, so a
  fresh schema run keeps the same posture.

Writers are unaffected: the service role (Paystack webhook, admin grants) and
the SECURITY DEFINER routines (`update_user_name`, `set_user_admin`) run as the
table owner and bypass these restrictions. The app itself never wrote `profiles`
from the browser client (verified by grep), so nothing breaks.

### C2 fix — server-authoritative plan enforcement

- **`lib/auth/access.ts`** — removed `getPlanTier`/`hasPlanTier` (metadata-based)
  and added `resolveServerPlanTier(supabase, userId)` which reads
  `profiles.plan_tier, plan_expires_at, is_admin` with the injected client.
  Behavior:
  - admin row → `{ tier: 'premium', isAdmin: true }` (unlimited tier);
  - `plan_expires_at` in the past → `'free'`;
  - NULL expiry → honored as before (indefinite), so legacy paid rows are not
    silently demoted;
  - missing row / query error → `'free'`.
- **`app/api/receipts/extract/route.ts:99`** — receipt-scan quota now uses
  `resolveServerPlanTier` instead of `getPlanTier(user)`.
- **`lib/services/subscription-service.ts`** — `createSubscription` cap also
  treats an expired `plan_expires_at` as `free`.
- **`lib/services/receipt-ingestion.ts`** — `isPlusUser` (email-discovery /
  inbound-receipt path) now enforces `plan_expires_at` as well.

### Verification

- `npm run type-check` — clean.
- `npm run lint` — 0 errors (warnings pre-existing, untouched files).
- `npm run test` — 457/457 passing, including a new regression suite
  `lib/auth/__tests__/access.test.ts` (8 tests) covering the resolver
  (free/plus/premium/pro mapping, expiry, NULL expiry, admin, missing/error
  rows).

---

## 4. Action items

1. **Apply the migration** (required — the live DB is still exploitable until
   then): run the contents of `supabase/migrations/013_restrict_profile_updates.sql`
   in the Supabase SQL editor, or `npx supabase db push` once the project is
   linked.
2. Review and decide on remaining findings: H1 (cookie/CSP), H2 (token
   encryption), M1 (x-forwarded-for), M2 (x-forwarded-host), M3 (OAuth state
   binding), and the low/hardening items.
3. Re-audit after each further change; keep `.env.local` out of git.

---

## 5. Prioritization (original)

Implement C1 and C2 first (the only ones recoverable by a self-registered
attacker), then H1/H2, then M1–M3.