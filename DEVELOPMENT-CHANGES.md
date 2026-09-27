# Development Changes — SubHalt

Detailed record of the work completed in this session: the admin console
(Phases 0–3), the Supabase schema/migration fixes applied while bootstrapping
the database, and the two new integrations — a real **email-forwarding backend**
and **background Gmail monitoring**.

---

## 1. Admin Console (Phases 0–3)

A complete admin area (`/admin/*` pages + `/api/admin/*` routes) for managing
users, payments, providers, and platform integrations. Verified before starting
the new integrations.

### What was built

| Page | Purpose |
| ---- | ------- |
| `/admin` | Overview dashboard (totals, growth, revenue, recent activity) |
| `/admin/users` | User management (search, role/plan changes, toggle admin) |
| `/admin/payments` | Payment history + plan subscriptions |
| `/admin/providers` | Verified provider catalog (verified / user-submitted tabs) |
| `/admin/integrations` | Platform-wide settings (logo.dev, Supabase, Gmail, Paystack) |

### Route coverage

- 9 dynamic `app/api/admin/*` routes (users list/detail, role & plan updates,
  payments, providers, integrations, overview stats).
- RLS-safe: service-role writes (`createAdminClient`) + browser-session reads;
  admin access gated by an `is_admin` check per request.

### Lint fixes applied

The repo enforces `react-hooks/set-state-in-effect` (errors on synchronous
`setState` inside effects). All five admin components were restructured:

- Removed synchronous `setLoading(true)` / `setError(null)` at the top of the
  `load()` functions.
- All state setters now run after `await` points.
- Effects call the loader via `Promise.resolve().then(() => load())`.

This matches the existing precedent in `lib/contexts/user-settings-context.tsx`
(line 313). Unused imports were also removed (`StatCard` in admin-integrations,
`UserCog` in admin-users).

**Verification:** `npm run lint` → 0 errors · `npm run type-check` → passes ·
`npm run build` → passes.

---

## 2. Supabase Schema & Migration Fixes (bootstrap)

While applying migrations to the hosted Supabase project, a sequence of
problems was found and fixed in the repo.

### 2.1 Base schema was never applied

`supabase/schema.sql` is the consolidated base schema (contains the content of
`001`–`007` migrations plus `plan_tier` columns). It does **not** include the
Gmail migration (`008`) or admin roles (`009`). Running `009` first produced:

> `relation "public.bill_payments" does not exist`

**Fix:** document/re-order so `schema.sql` is applied first, then `008` and
`009`.

### 2.2 Reserved-word bug: `limit`

`schema.sql` (line ~301) defined the composite type `rate_limit_result` with a
field named `limit`, which is a reserved keyword:

> `syntax error at or near "limit"`

**Fix:** renamed the field to `limit_value` in:

- `supabase/schema.sql`
- `supabase/migrations/004_rate_limit.sql`
- `lib/types/database.types.ts` (type-check still passes — the TS client never
  read that field; it reads `.allowed` / `.retry_after_seconds`).

### 2.3 Idempotency of `schema.sql`

After a partial run, re-running raised:

> `policy "Users can view their own profile" already exists`

**Fix:** made `schema.sql` fully re-runnable:

- `DROP POLICY IF EXISTS` before all 24 policies.
- `DROP TRIGGER IF EXISTS` before all 6 triggers.
- `rate_limit_result` type creation wrapped in a `DO $$ ... EXCEPTION WHEN
  duplicate_object THEN NULL $$` block (mirrors the existing
  `name_change_result` pattern).

`008_gmail_connections.sql` (trigger) and `009_admin_roles.sql` (its 6
policies) were also made idempotent.

### 2.4 RLS infinite recursion in admin policies

Re-running `009` surfaced:

> `infinite recursion detected in policy for relation "profiles"`

The original admin policies were:

```sql
USING (EXISTS (
  SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
))
```

The self-referencing `profiles` lookup re-triggers the policy, causing
recursion.

**Fix:** added a `SECURITY DEFINER` SQL function and rewrote every admin policy
to use it:

```sql
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and is_admin = true
  );
$$;
```

All six policies in `009` now use `USING (public.is_admin())`.

### 2.5 Permission denied on `is_admin()`

Running `009` again produced:

> `permission denied for function is_admin`

The initial grant only covered `authenticated`; anonymous/SSR paths (which use
the anon key) hit policies too and failed.

**Fix:** grant to both roles:

```sql
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
```

(anon always resolves to `false` because `auth.uid()` is null, which is the
correct behavior.)

### Migration application order (for the live Supabase dashboard)

1. Run `supabase/schema.sql`.
2. Run `supabase/migrations/008_gmail_connections.sql`.
3. Run `supabase/migrations/009_admin_roles.sql`.
4. Bootstrap the first admin:

   ```sql
   UPDATE public.profiles SET is_admin = true WHERE email = '<you@example.com>';
   ```

---

## 3. Email Forwarding Backend (real, end-to-end)

Previously the "Email Forwarding" feature was a UI stub: a hardcoded address
(`receipts+user_8921@subhalt.app`) and a simulated button that created a
hardcoded Notion subscription directly from the browser. That has been replaced
with a real inbound-email pipeline.

### Concept

Every user gets a personal receiving address:

```
receipts+<userId>@<INBOUND_EMAIL_DOMAIN>
```

Forward any receipt/invoice to it. A provider webhook (Mailgun or Resend) POSTs
the message to this app; it is verified, parsed, deduped, and created as a
subscription through the service-role client. An inbox item is inserted so it
shows up on the Inbox page.

### New files

| File | Role |
| ---- | ---- |
| `lib/services/receipt-discovery.ts` | Pure helpers shared by all paths |
| `lib/services/receipt-ingestion.ts` | Service-role ingestion (dedupe/cap/create) |
| `lib/services/inbound-email.ts` | Webhook transport: verify + parse + process |
| `app/api/emails/inbound/route.ts` | `POST` webhook endpoint |
| `app/api/emails/test/route.ts` | Authenticated self-test endpoint |
| `app/api/emails/forwarding-address/route.ts` | `GET` the user's own address |

### `lib/services/receipt-discovery.ts`

Pure, I/O-free helpers:

- `deriveProviderFromSender(from)` — extracts the sender domain and derives a
  provider name (`info@info.netflix.com` → `Netflix`), falling back to `General
  Provider`. This logic was extracted from `gmail-service.ts` (which now
  imports it, removing the duplicate).
- `mapBillCategoryToSubscriptionCategory(raw)` — maps bill-parser categories
  (e.g. `TV / Streaming`, `Software / Digital Services`) to the subscriptions
  CHECK-enum (`Streaming`, `Software`, `Utilities`, `Fitness`, `Finance`,
  `Education`, `Gaming`, `Other`), defaulting to `Other`.
- `mapPaymentFrequencyToBillingCycle(freq)` and
  `mapBillingCycleToBillFrequency(cycle)` — converters between
  `BillFrequency` and the subscriptions `billing_cycle` enum.
- `normalizeSubscriptionName(name)` — lowercase, collapsed whitespace, used for
  duplicate detection.
- `stripHtmlToText(html)` — HTML → plain text for `body-html` fallback.
- `buildReceiptDraft(...)` — turns parser output into a normalized
  `ReceiptDraft` (`{ name, price, currency, billingCycle, category, from,
  subject, date }`).

### `lib/services/receipt-ingestion.ts`

Service-role (`SupabaseClient<Database>`) persistence layer:

- `getInboundEmailDomain()` / `getUserForwardingAddress(userId)` — derives the
  per-user address from `INBOUND_EMAIL_DOMAIN`; returns `null` when unset.
- `parseRecipientUserId(recipient)` — extracts the UUID from the `+tag`
  (handles both `receipts+<uuid>@domain` and `Name <receipts+<uuid>@domain>`
  formats).
- `isPlusUser(admin, userId)` — reads `profiles.plan_tier`.
- `fetchActiveSubscriptionNames(...)` — for pre-filtering duplicates.
- `ingestReceiptDraft(admin, userId, draft, source)` — the core writer:
  1. Rejects empty/invalid provider or price → `invalid`.
  2. Duplicate provider (active/paused/trial with the same normalized name) →
     `duplicate` (no write).
  3. Free-tier cap: non-Plus users with `FREE_SUBSCRIPTION_LIMIT` (3) or more
     active subscriptions → `limit_reached` (no write, no delete).
  4. Inserts the subscription via the admin client (`status: active`,
     `provider_url` from `getKnownProviderWebsite`, notes stamped with
     `[Email Forwarding] <from> — <subject>`, `is_synced: true`, next billing
     +1 month).
  5. Inserts an `inbox_items` row (`type: plan_update`, name/price/currency,
     `is_urgent: true`, metadata `{ source, created_from }`).
  6. Returns `{ status: 'created', subscriptionId, inboxItemId, ... }`.
- `ingestDiscoveredGmailSubscriptions(...)` — loops discovered Gmail
  candidates through the same `ingestReceiptDraft` for the background monitor.

### `lib/services/inbound-email.ts`

Webhook transport and the full forwarded-receipt path:

- `verifyMailgunSignature(payload)` — Mailgun **secure webhook** check: HMAC
  SHA-256 over `timestamp + token` using `MAILGUN_SIGNING_KEY`, constant-time
  comparison, with a 15-minute TTL on the timestamp.
- `verifyWebhookAuth(payload, headers)` — three modes:
  1. If `MAILGUN_SIGNING_KEY` is set → must pass the HMAC signature check.
  2. Else if `INBOUND_WEBHOOK_SECRET` is set → requires that secret in the
     `secret` form field, the `x-webhook-secret` header, or
     `Authorization: Bearer <secret>`.
  3. Neither configured → unauthorized (route responds 503).
- `extractPayload(payload)` — case-insensitive field extraction supporting
  Mailgun names (`recipient`, `sender`, `To`, `From`, `Subject`,
  `stripped-text`, `body-plain`, `stripped-html`, `body-html`) and
  Resend/SES-style names (`from`, `to`, `subject`, `text`, `html`, `when`).
- `getReceiptText(input)` — chooses plain text, else `stripHtmlToText(html)`.
- `processInboundReceipt(input)` — end-to-end:
  1. Domain configured? (`not_configured` if not)
  2. Resolve userId from the recipient `+tag` (invalid if not a forwarding
     address, or if no profile exists).
  3. Extract text, run `parseBillReceiptText`.
  4. Provider fallback to sender domain via `deriveProviderFromSender`.
  5. `buildReceiptDraft` (mapped category + billing cycle) → `ingestReceiptDraft`.
- `processInboundReceiptWithSelfTest(recipient, text)` — runs a canned Netflix
  receipt through the same pipeline (used by the test endpoint).

### `app/api/emails/inbound/route.ts` (webhook)

- `export const runtime = 'nodejs'`, `dynamic = 'force-dynamic'`.
- 503 if the server is not configured (`isWebhookEnabled()` false).
- Parses either `application/json` or `multipart/form-data` (skipping
  `attachment-*` fields).
- Verifies auth → extracts payload → requires a `recipient`.
- `invalid` results → 422 with the ingestion result; `not_configured` → 503;
  otherwise 200 with `{ status, id }`.

### `app/api/emails/forwarding-address/route.ts`

Authenticated `GET` (session cookie, `getAuthUser`). Returns
`{ address: 'receipts+<userId>@<domain>' }` or 503 when `INBOUND_EMAIL_DOMAIN`
is unset.

### `app/api/emails/test/route.ts`

Authenticated `POST`. Builds the user's address, runs a sample Netflix receipt
through the real pipeline (`processInboundReceiptWithSelfTest`), returns the
ingest status. 503 when not configured.

### `components/integrations/email-forwarding-modal.tsx`

Rewritten from the stub:

- Fetches the real forwarding address on open via
  `Promise.resolve().then(() => loadAddress())` (setstate-in-effect safe).
- Loader state while the address resolves.
- "not configured" state: informs the user to ask the admin to set
  `INBOUND_EMAIL_DOMAIN` + secrets.
- Copy button copies the real address (not the hardcoded placeholder).
- "Send Test Receipt" calls `POST /api/emails/test` and handles every result:
  `created` → success toast + optimistic inbox item + close; `duplicate` →
  "Already Tracked" info; `limit_reached` → closes + triggers the upgrade flow;
  `401` → session-expired toast; `503` → not-configured state.

### Also fixed (latent bug)

`gmail-connect-modal.tsx` cast the raw bill-parser category directly into the
subscriptions enum (`item.category as 'Streaming' | ...`). The parser emits
values like `TV / Streaming` that fail the DB CHECK constraint, which made the
insert fall back to a local-only (unsynced) subscription. The modal now uses
`mapBillCategoryToSubscriptionCategory(item.category)`.

### Env vars (all optional in `lib/env.ts`)

```
INBOUND_EMAIL_DOMAIN=yourdomain.com
MAILGUN_SIGNING_KEY=            # preferred (HMAC webhook verification)
INBOUND_WEBHOOK_SECRET=         # alternative shared-secret verification
```

---

## 4. Background Gmail Monitoring (auto-import)

Previously Gmail receipts were only discovered on-demand via the
`POST /api/gmail/scan` review flow. Now connected inboxes are also monitored in
the background and new receipts are auto-imported.

### New files

| File | Role |
| ---- | ---- |
| `lib/services/gmail-monitor.ts` | Batch scan + auto-import orchestrator |
| `app/api/cron/gmail-rescan/route.ts` | `GET`/`POST` cron endpoint |
| `instrumentation.ts` | Self-hosted interval (root, per Next docs) |
| `vercel.json` | Added `crons` entry (`0 6 * * *`, see below) |

### `lib/services/gmail-monitor.ts`

`monitorGmailSubscriptionsForAllUsers({ maxUsers, maxResults })`:

1. Queries `gmail_connections` where `status = 'connected'`, ordered by
   `last_scan_at` ascending (nulls first — least-recently scanned first),
   limited to `maxUsers` (default 10).
2. For each user: runs `scanGmailForSubscriptions`.
3. Pre-filters candidates against the user's existing active subscription names
   (normalized) to avoid unnecessary writes.
4. Ingests the remainder via `ingestReceiptDraft(..., 'Gmail Monitoring')` with
   category/billing mapping, dedupe and free-cap enforcement.
5. Updates `last_scan_at`, `last_scan_status`, `last_scan_count`.
6. Summary: `{ scanned, created, duplicates, limitReached, invalid, errors }`.

### `app/api/cron/gmail-rescan/route.ts`

- Protected by `CRON_SECRET` via `x-cron-secret` header or
  `Authorization: Bearer <CRON_SECRET>` → 401 otherwise.
- `GET` and `POST` both trigger the monitor and return the summary.
- `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`.

### `instrumentation.ts` (self-hosted option)

Per the installed Next.js 16 docs (`node_modules/next/dist/docs/02-guides/
instrumentation.md`), the file sits at the repo root and exports `register()`.
Gated on:

- `NEXT_RUNTIME === 'nodejs'`
- `NODE_ENV === 'production'`
- `ENABLE_BACKGROUND_GMAIL_SCAN === 'true'`
- `CRON_SECRET` set

When active it self-fetched (POST) `/api/cron/gmail-rescan` with the secret
header on a 6-hour interval (first run after 15 s), with a module-level
`running` guard to prevent overlapping runs.

### `vercel.json` (Vercel option)

```json
{
  "crons": [
    { "path": "/api/cron/gmail-rescan", "schedule": "0 6 * * *" }
  ]
}
```

> **Revised after first deploy.** This originally shipped as `0 */6 * * *`, which
> Vercel rejects on Hobby: *"Hobby accounts are limited to daily cron jobs."*
> The check runs at build time, so the entry did not merely disable the cron —
> it failed the whole deployment, and the app stopped updating at all. The
> schedule is now daily. Sub-daily scans on Hobby require either Pro or an
> external cron POSTing to the route with the secret header.

Any external cron can also POST/GET the route with the secret header.

### Env vars

```
CRON_SECRET=long-random-string
ENABLE_BACKGROUND_GMAIL_SCAN=false     # true only for self-hosted loop
```

---

## 5. Shared plumbing changes

### `lib/env.ts`

Added to the Zod schema (all optional) and the parsed object:

- `INBOUND_EMAIL_DOMAIN`
- `INBOUND_WEBHOOK_SECRET`
- `MAILGUN_SIGNING_KEY`
- `CRON_SECRET`
- `ENABLE_BACKGROUND_GMAIL_SCAN`

### `lib/services/gmail-service.ts`

Removed the local `GENERIC_PROVIDER_NAME` constant and
`deriveProviderFromSender` copy; both now come from `receipt-discovery.ts`.

### `.env.example`

Documented all five new variables with comments explaining each provider
choice (Mailgun HMAC vs shared secret, Vercel Cron vs self-hosted loop).

### `STEPS-GMAIL-INTEGRATION.md`

Added three sections:

1. **Background Gmail monitoring** — the cron endpoint, its auth, and the three
   runner options (Vercel Cron, self-hosted, external cron).
2. **Email forwarding** — provider setup (Mailgun routes with
   `recipient "receipts+*@"`, or Resend inbound), env vars, webhook URL.
3. **Email forwarding API routes** — route/method/purpose table.

---

## 6. Verification

All green:

```
npm run type-check   → passes (tsc --noEmit)
npm run lint         → 0 errors (104 pre-existing warnings, untouched)
npm run build        → passes (Next.js 16.2.11 / Turbopack;
                        includes /api/cron/gmail-rescan,
                        /api/emails/forwarding-address,
                        /api/emails/inbound, /api/emails/test)
npm test             → 13 files, 90 tests, all pass
```

---

## 7. What you need to do to activate

1. **Database** — apply the migrations in order (dashboard SQL Editor):
   `schema.sql` → `008_gmail_connections.sql` → `009_admin_roles.sql`, then
   bootstrap an admin:
   `UPDATE public.profiles SET is_admin = true WHERE email = '<you>@...' ;`
2. **Env** — add to `.env.local` / production:
   `INBOUND_EMAIL_DOMAIN`, plus `MAILGUN_SIGNING_KEY` (or
   `INBOUND_WEBHOOK_SECRET`), and `CRON_SECRET`. Set
   `ENABLE_BACKGROUND_GMAIL_SCAN=true` only if self-hosting (leave off on
   Vercel, which uses `vercel.json` crons).
3. **Provider** — create the domain/MX + receiving route at Mailgun (or Resend
   inbound) and point it at
   `https://<your-domain>/api/emails/inbound`.
4. **Deploy** — `npm run build && npm start` (or push to Vercel; the cron in
   `vercel.json` activates automatically).
5. **Verify** — in the app: Add Subscription → *Receipt Email Forwarding* →
   the real address loads, and *Send Test Receipt* inserts the sample
   subscription.