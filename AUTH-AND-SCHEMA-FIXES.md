# Auth, Schema and Tooling Fixes — SubHalt

Session record for 2026-10-04. Covers four reported problems, three of which had
a different root cause than the symptom suggested.

| # | Reported as | Actual cause | Status |
| - | ----------- | ------------ | ------ |
| 1 | Google sign-in/sign-up broken | Three stacked faults (below) | Fixed, committed `bdc0e10` |
| 2 | Google button gone after sign-out | `localStorage` read during render → hydration mismatch | Fixed, **uncommitted** |
| 3 | `account_link` / `cheaper_plan_name` column missing | `migrations/` and `schema.sql` had drifted | Migration written, **needs applying** |
| 4 | UI/CSS completely broken | Not CSS — a corrupted `.next` cache | Diagnosed, resolved |

---

## 1. Google sign-in and sign-up

### Fault 1 — the auth cookie was `httpOnly`, blinding the browser client

`lib/supabase/cookie-options.ts` previously exported **two** constants that
disagreed on `httpOnly`: the server clients wrote the session with
`httpOnly: true`, while `createBrowserClient` was forced to `httpOnly: false`
(browsers silently drop a `document.cookie` write carrying `HttpOnly`, which is
what had broken the PKCE verifier in commit `57384c1`).

That split cannot work. A `Set-Cookie` for `sb-<project-ref>-auth-token`
carrying `HttpOnly` **replaces** the JS-visible cookie of the same name, so the
moment any server-side sign-in succeeded — `/api/auth/login`, or
`exchangeCodeForSession` in `/auth/callback` — `createBrowserClient` could no
longer read the session.

Every client-side read then went out unauthenticated and came back empty or 401:

- `lib/services/subscription-service.ts` — `fetchSubscriptions`, `createSubscription`
- `lib/services/bills-service.ts`, `activity-service.ts`, `receipt-storage.ts`
- `components/layout/Sidebar.tsx`
- `lib/contexts/user-settings-context.tsx`, `inbox-context.tsx`

**Why this presented as "Google is broken":** a brand-new Google user has an
empty `localStorage` cache, so `fetchSubscriptions()` fell back to `[]` and the
dashboard rendered nothing after a *successful* sign-in. Existing password users
still saw cached rows, which masked the fault for them.

The repo's own `lib/auth/sign-out.ts` already documented the mechanism
("Browsers refuse to let JavaScript read or delete an httpOnly cookie") without
connecting it to the data layer.

**Fix:** collapsed to one shared constant with `httpOnly: false`. Hardening the
token against XSS now requires moving the data layer behind authenticated route
handlers — incompatible with a browser-side Supabase client.

### Fault 2 — a new `GoTrueClient` on every render deleted the PKCE verifier

`createBrowserClient` caches its client only when `isSingleton` is `true` **or**
when it is handed no options at all; passing an options object silently opts out.
`lib/supabase/client.ts` passed options, and both auth flows called
`createClient()` inside the render body.

auth-js warns about exactly this, reproduced against the live project:

```
Multiple GoTrueClient instances detected in the same browser context.
It is not an error, but this should be avoided as it may produce
undefined behavior when used concurrently under the same storage key.
```

The consequence is concrete. Each instance runs `_initialize()` →
`_recoverAndRefresh()`, which on a stale session calls `_removeSession()`, which
executes `removeItemAsync(storage, storageKey + '-code-verifier')`. Clicking
"Continue with Google" calls `setSocialLoading('google')` **first**, so the
resulting re-render started a fresh client whose cleanup raced
`signInWithOAuth` writing the verifier. The verifier was deleted mid-flight and
`/auth/callback` failed `exchangeCodeForSession`.

**Fix:** `isSingleton: true`.

### Fault 3 — every OAuth failure reported the same string

`/auth/callback` collapsed all failure modes into one generic message, so a
misconfigured redirect was indistinguishable from a blocked cookie. It now maps
Supabase's `error_code` (`access_denied`, `invalid_request` + redirect,
`server_error`) to distinct, actionable text.

### Also changed

- `secure` now reads `window.location.protocol` in the browser instead of
  `NEXT_PUBLIC_SITE_URL`, which was marking the cookie `Secure` while developing
  on `http://localhost` — browsers drop those, so sign-in appeared to bounce.
- Apple is no longer offered. `GET /auth/v1/settings` reports `apple: false`, so
  `signInWithOAuth` could never return a session; the button was a dead control.
- The live session is recorded via `saveRememberedAccount` in
  `user-settings-context.tsx`, so the account chooser learns Google users —
  previously nothing ran between the OAuth redirect and the dashboard.
- Provider errors surface through `lib/auth/oauth-errors.ts`.

### Still outstanding — Supabase dashboard

The project's **Site URL is `http://localhost:3000`**, confirmed via
`GET /auth/v1/verify?...&redirect_to=https://evil.example.com`, which returned
`Location: http://localhost:3000#error=access_denied`. GoTrue silently discards
any `redirect_to` not in the allow-list and falls back to the Site URL, so the
browser lands off-app with no visible error.

**Authentication → URL Configuration:**

| Field | Value |
| ----- | ----- |
| Site URL | `https://subhalt.xyz` |
| Redirect URLs | `https://subhalt.xyz/auth/callback` |
| | `https://www.subhalt.xyz/auth/callback` |
| | `http://localhost:3000/auth/callback` |

`NEXT_PUBLIC_SITE_URL` is now set in `.env.local` and documented in
`.env.example`; it must also be set in **Vercel**, since `NEXT_PUBLIC_*` values
are inlined at build time.

---

## 2. Account chooser hydration mismatch

### Symptom

`components/auth/remembered-account-chooser.tsx:50` logged a hydration mismatch
on every `/login` visit for anyone who had signed in before, and the chooser hid
the Google button.

### Root cause

`LoginFlow` seeded both pieces of state from `localStorage` in a `useState`
initializer:

```tsx
const [step, setStep] = useState(() =>
  getRememberedAccounts().length > 0 ? 'chooser' : 'email'
);
```

A `useState` initializer runs during render on the client only. The server
rendered the email step; the client rendered the chooser. React discards the
server markup and re-renders the client tree.

### Why the obvious fix was wrong

The conventional remedy — seed with the SSR-safe value, then promote in a
`useEffect` — passes type-check and tests but is wrong twice over:

1. It renders the email step for one frame before swapping to the chooser, which
   is precisely the "Google button disappeared" flash we were trying to remove.
2. It adds a second `react-hooks/set-state-in-effect` error (this repo treats that
   rule as an error).

### Fix

`localStorage` is an external store, so it is read through `useSyncExternalStore`,
which takes an explicit server snapshot and handles the hydration handshake
itself.

- **`lib/auth/remembered-accounts.ts`** — added `subscribeRememberedAccounts`,
  `getRememberedAccountsSnapshot` (cached: `useSyncExternalStore` compares
  snapshots *by reference* and would infinite-loop on a fresh parse each call),
  and `getRememberedAccountsServerSnapshot` (always empty — this is what makes SSR
  and hydration agree). `save`/`remove` notify subscribers, plus a cross-tab
  `storage` listener.
- **`components/auth/login-flow.tsx`** — accounts come from the store; the
  landing step is derived rather than pushed by an effect:
  `requestedStep ?? (rememberedAccounts.length > 0 ? 'chooser' : 'email')`.
  All 10 `setStep` sites became `setRequestedStep`. No effect, no lint error, no
  extra render pass.
- **`components/auth/remembered-account-chooser.tsx`** — renders the social
  buttons between the account list and "Log in to another account", so Google is
  reachable from every step. `onSocialAuth` is optional so the component still
  renders standalone.

### Tests

Three added in `components/auth/__tests__/auth-form.test.tsx`:

- `renders the email step server-side even when accounts are saved` — uses
  `renderToStaticMarkup`, which skips effects. `render` **cannot** assert this:
  testing-library's `act()` flushes effects before it returns, so the chooser is
  already mounted by the first assertion.
- `promotes to the account chooser after mount when accounts are saved`
- `keeps Google sign-in reachable from the account chooser`

---

## 3. Database schema reconciliation

### Symptom

A sequence of one-column-at-a-time failures:

```
Could not find the 'account_link' column of 'subscription' in the schema cache
Could not find the 'cheaper_plan_name' column of 'subscriptions' in the schema cache
```

Note the column is `account_links` (plural); PostgREST just names the relation in
the singular. Nothing in the codebase queries `account_link`.

### Two distinct causes

1. **`002_subscriptions_metadata.sql` was never applied**, while `003` and
   `006`–`010` were — the migrations were run out of order. Columns
   `end_date`, `account_links`, `receipts`, `is_synced` were all absent. Applied
   by hand on 2026-10-04.
2. **`cheaper_plan_name` / `cheaper_plan_price` exist in `schema.sql:71-72` and in
   `database.types.ts`, but in no migration file at all.** Applying `002` could
   never have added them. `supabase/schema.sql` and `supabase/migrations/` had
   drifted apart.

### Blast radius

Not reads only. `subscription-service.ts` writes `end_date`, `account_links`,
`receipts`, `is_synced`, `cheaper_plan_name` and `cheaper_plan_price` on every
insert (`:663-665`) and update (`:517-524`), and `import-utils.ts:84` does the
same on import. **Creating, editing and importing a subscription all failed
outright.** `fetchSubscriptions()` uses `select('*')`, which is why the list
still rendered and masked it.

Because each write aborts on whichever missing column PostgREST notices first,
closing one gap simply exposed the next.

### Full reconciliation

Every column of every table in `database.types.ts` was diffed against the live
PostgREST schema:

```
ok              profiles         ok  plan_subscriptions   ok  bill_payments
ok              bill_providers   ok  receipt_scan_usage   ok  receipts
ok              activity_log     ok  ai_conversations     ok  inbox_items
ok              gmail_connections
MISSING COLUMNS subscriptions -> cheaper_plan_name, cheaper_plan_price
```

That was the **entire** remaining gap across all 11 tables. `profiles`
reconciles fully.

### SQL to apply

> **Superseded in part.** The `cheaper_plan_*` half of this is now **optional** —
> see §6. The app no longer writes those columns, so subscription create/edit
> works without them. The four columns from `002` are still required if they have
> not been applied.

Supabase dashboard → **SQL Editor** → **New query**:

```sql
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS cheaper_plan_name TEXT,
  ADD COLUMN IF NOT EXISTS cheaper_plan_price NUMERIC(10, 2);

-- schema.sql declares this CHECK inline; ADD COLUMN cannot carry one.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.subscriptions'::regclass
      AND conname = 'subscriptions_cheaper_plan_price_check'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_cheaper_plan_price_check
      CHECK (cheaper_plan_price >= 0);
  END IF;
END $$;
```

The constraint guard checks only the constraint **name** on purpose: if existing
rows violate the check the `ALTER` fails loudly rather than silently leaving a
migrated database without a constraint a fresh install would have.

PostgREST caches the table definition it exposes, so the client-side error can
outlive the `ALTER` by a minute or two.

**Verify the four required columns** (`end_date`, `account_links`, `receipts`,
`is_synced`):

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='subscriptions'
  AND column_name IN ('end_date','account_links','receipts','is_synced');
```

### Why not `supabase db push`

The project is not linked (no `supabase/config.toml`, no `supabase/.temp`) and
there is **no `supabase_migrations.schema_migrations` ledger** on the project. The
CLI has no record of what is applied and would attempt to replay `002` through
`010`, including non-idempotent statements (the `005` grants, `004`'s rate-limit
function).

`supabase/migrations/011_subscription_metadata_backfill.sql` is the durable fix:
all six columns via `ADD COLUMN IF NOT EXISTS`, so it is safe on a fresh
database, a partially migrated one, or one where `002` was applied by hand.

**Process note:** any future column must be added to `schema.sql`, to a
migration, **and** regenerated into `database.types.ts`. A column present only in
`database.types.ts` is exactly how `cheaper_plan_name` went missing.

---

## 4. "The UI/CSS is completely broken"

Neither reported file was touched.

**`app/globals.css`** — intact and byte-identical to `HEAD` (577 lines, 17 KB,
braces balanced 80/80). Never deleted.

**`tailwind.config.ts`** — **has never existed** in this repository, on any
branch, in any commit, and appears in no deletion. This is Tailwind CSS v4
(`tailwindcss: ^4`, `@tailwindcss/postcss: ^4`), which is configured in CSS via
`@import "tailwindcss"` + `@theme { ... }` — exactly what `globals.css` lines
1–13 do. `postcss.config.mjs` correctly wires up the plugin. Adding a
`tailwind.config.ts` would do nothing.

The build reported `✓ Compiled successfully`, and the dev server served 107 KB of
valid CSS including the custom `--spacing-dock` theme token and Tailwind
preflight.

### The real cause

A **corrupted `.next` build cache**. `.next/dev/types/routes.d.ts` contained a
duplicated, mangled tail (`})` followed by a repeat of the `RouteContext`
interface), and `npm run build` failed type-checking on it.

Cause: `npm run build` ran **concurrently with a live `npm run dev`**, both
writing the same `.next` directory. `.next` is a generated artifact directory and
is gitignored; clearing it and rebuilding was sufficient.

### Recurring papercut

`tsconfig.json:30` explicitly includes `.next/dev/types/**/*.ts`. Those files are
rewritten by `next dev`, so running `npm run type-check` while the dev server is
up reads them mid-write. This corrupted them twice in one session
(`routes.d.ts`, then `validator.ts` — the latter with `st handler = ...`, a
truncated `const`), producing phantom type errors in generated code.

**Do not run `npm run type-check` while `npm run dev` is running.** A
`tsconfig.check.json` excluding `.next/dev/types` would remove the footgun.

---

## 5. Commits

| Commit | Contents |
| ------ | -------- |
| `bdc0e10` | `fix(auth): unbreak Google sign-in end to end` — 13 files, all three OAuth faults |
| `d7ea35f` | `chore(dashboard): seed subscriptions from the local cache on mount` |

Both pushed to `origin/main`.

`d7ea35f` was **already uncommitted in the working tree** before this session and
is not part of the auth fix. It adds a mount effect adopting
`getCachedSubscriptions()`, which works around the symptom fault 1 fixed at the
source. Two caveats, both recorded in the commit message:

- It trips `react-hooks/set-state-in-effect` at `dashboard-v2.tsx:145` and is
  currently the repository's only lint error.
- It masks this class of outage — with the session readable again the cache is a
  genuine offline optimisation rather than a fallback hiding an auth bug.

---

## 6. Cheaper-plan tier and empty-state CTA removed

Two UI changes requested after the schema work.

### 6.1 The "Cheaper Plan Tier" fields are gone from the subscription form

`subscription-modal.tsx` had two optional inputs (name + price) feeding a
hand-entered "downgrade instead of cancel" hint that fed the AI cancellation
modal's `Confirm Downgraded` path.

Removed: both inputs, their state, the `initialData` prefill, the reset branch,
the `hasCheaperPlan` validation, and — critically — the two keys from the save
payload.

**Why the payload keys had to go too.** PostgREST rejects an entire write if any
key names a column the table lacks, so deleting the inputs while still sending
`cheaper_plan_name: null` would have kept every create/edit failing with exactly
the 42703 error the fields were being removed to clear. Nothing else in the app
wrote those columns (`subscription-service.ts` and `import-utils.ts` never
referenced them), so removing them from the payload is what actually fixes it.
`updateSubscription` applies a partial update, so rows that already have values
keep them.

The columns remain in `database.types.ts` and `011`, because
`cancellation-intelligence-modal.tsx:61-67` still *reads* them — existing rows
that have values continue to offer the downgrade path. New rows will simply have
none, which is the intended outcome.

**Consequence:** the `cheaper_plan_*` half of the §3 SQL is now **optional**.
`011` still creates them so a fresh install matches the declared types; if you
would rather not run it, nothing breaks.

### 6.2 "Add Your First Subscription" removed from the empty state

Three controls were opening the same `AddSubscriptionModal`:

| Control | Visibility |
| ------- | ---------- |
| Empty-state "Add Your First Subscription" | Always, and the most prominent |
| Header "Add Subscription" | `hidden lg:inline-flex` — desktop only |
| Contextual FAB in the dock | Mobile (asserted by `contextual-fab.test.tsx:39`) |

The header row and the FAB between them cover every width, so the empty state is
now text only. The empty state keeps its heading and explanatory copy.

### Tests

Four added:

- `subscription-modal.test.tsx` — no cheaper-plan inputs render, and the saved
  payload omits both keys (create mode).
- `subscription-modal.test.tsx` — an existing tier is preserved on edit, i.e. the
  keys are omitted rather than nulled.
- `subscription-manager.test.tsx` — the empty state offers no add button, while
  the header action still exists.
- `subscription-manager.test.tsx` — same when filters exclude every row.

### 6.3 AdSense loader, and the middleware that was blocking crawlers

The AdSense loader was committed alone (`324d210`) so verification could proceed
without waiting on the rest of this work. `next/config` then shipped separately
with the CSP allowance.

The client id is a committed fallback in `lib/config/adsense.ts` rather than
living only in `NEXT_PUBLIC_ADSENSE_CLIENT`. Verification reads the raw HTML of
your pages, `.env*` is gitignored, and env values are inlined at build time — an
unset variable meant the script could never reach the deployed document.

**Middleware fix.** The auth redirect was swallowing three routes that crawlers
fetch *before* any page. The matcher only excludes a fixed list of image
extensions, so `.txt`, `.xml` and `.webmanifest` fell through to it:

| Route | Was | Now |
| ----- | --- | --- |
| `/robots.txt` | login page HTML | robots directives |
| `/sitemap.xml` | login page HTML | sitemap |
| `/manifest.webmanifest` | login page HTML | PWA manifest |

The manifest was collateral: discovered while checking, not previously reported,
and it had been silently breaking "Add to Home Screen".

`PUBLIC_ROUTES` in `lib/supabase/middleware.ts` now exempts them alongside
`/api`, compared on a segment boundary so a lookalike like `/robots.txt.bak`
cannot slip through on its prefix.

Covered by `lib/supabase/__tests__/middleware.test.ts` (7 tests). Worth noting
how those tests were built: the first version of the protected-route and
lookalike cases passed against the *missing-env guard* at the top of
`updateSession` rather than the auth redirect, because vitest does not load
`.env.local` into `process.env`. They were green and proving nothing.
Stubbing the Supabase env vars exposed the real path.

---

## Verification

| Check | Result |
| ----- | ------ |
| `npm run type-check` | Clean |
| `npm test` | 343/343 passing (35 files) |
| `npm run lint` | 1 error — pre-existing `dashboard-v2.tsx:145`, not from this work |
| `npm run build` | Compiled successfully, 51/51 static pages |
| Schema reconciliation | 11/11 tables `ok` after the §3 SQL above is applied |

---

## Follow-ups

1. **Apply the four `002` columns** (`end_date`, `account_links`, `receipts`,
   `is_synced`) if not already done — subscription create/edit/import is broken
   until then. The `cheaper_plan_*` half is optional (§6.1).
2. **Supabase URL Configuration** (§1) — Site URL is still `http://localhost:3000`.
3. **`dashboard-v2.tsx:145`** — the repo's only lint error; fix or suppress.
4. **`tsconfig.check.json`** — remove the `.next/dev/types` race.
5. **`components/auth/remembered-account-chooser.tsx`** — `onRemoveAccount` is
   destructured but never rendered, so saved accounts cannot be removed from the
   chooser (pre-existing dead prop, currently only a lint warning).
6. **Decide the cheaper-plan columns' fate** (§6.1) — either keep them for the AI
   downgrade path on existing rows, or drop the columns, the types and the
   `cancellation-intelligence-modal` branch together.