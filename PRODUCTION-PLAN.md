# SubHalt Production-Readiness Implementation Plan

> Generated from a full codebase audit. 34 issues across security, error handling,
> performance, accessibility, testing, and infrastructure.

---

## Phase 0 — Emergency Security Fixes (Day 1)

**Goal:** Stop credential leakage and remove sensitive data from source control.

| # | Task | Files | Effort |
|---|------|-------|--------|
| 0.1 | Delete entire `scratch/` directory | `scratch/*` | 5 min |
| 0.2 | Add `scratch/` to `.gitignore` | `.gitignore` | 2 min |
| 0.3 | Remove hardcoded Logo.dev token fallback | `components/ui/service-icon.tsx:12` | 5 min |
| 0.4 | Remove hardcoded personal info defaults (name, email, address, card) | `lib/contexts/user-settings-context.tsx:509-526` | 15 min |
| 0.5 | Rotate Supabase anon key (manual — Supabase dashboard) | External | 10 min |
| 0.6 | Rotate Logo.dev token (manual — logo.dev dashboard) | External | 10 min |
| 0.7 | Clean git history with BFG Repo-Cleaner to remove committed secrets | External (git history) | 20 min |

**Verification:** `git log --all --diff-filter=D -- scratch/` shows deletion; `grep -r "pk_DjjLxkpa" .` returns nothing; no hardcoded credentials in source.

---

## Phase 1 — Security Hardening (Days 2–3)

**Goal:** Add defense-in-depth security layers to the application.

### 1A. Security Headers (next.config.ts)

| # | Task | Files | Effort |
|---|------|-------|--------|
| 1.1 | Add `headers()` function with security headers | `next.config.ts` | 30 min |
| 1.2 | Add `X-Frame-Options: DENY` | `next.config.ts` | — |
| 1.3 | Add `X-Content-Type-Options: nosniff` | `next.config.ts` | — |
| 1.4 | Add `Referrer-Policy: strict-origin-when-cross-origin` | `next.config.ts` | — |
| 1.5 | Add `Permissions-Policy: camera=(), microphone=(), geolocation=()` | `next.config.ts` | — |
| 1.6 | Add `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` | `next.config.ts` | — |
| 1.7 | Add `X-DNS-Prefetch-Control: off` | `next.config.ts` | — |
| 1.8 | Set `poweredByHeader: false` | `next.config.ts` | — |

### 1B. Content Security Policy

| # | Task | Files | Effort |
|---|------|-------|--------|
| 1.9 | Define CSP directives: `default-src 'self'`, `script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' https://img.logo.dev https://*.googleusercontent.com data:`, `connect-src 'self' https://open.er-api.com https://*.supabase.co`, `font-src 'self' https://fonts.gstatic.com`, `frame-ancestors 'none'` | `next.config.ts` | 45 min |
| 1.10 | Test CSP in dev — fix any blocked resources | Browser console | 30 min |

### 1C. Environment Variable Validation

| # | Task | Files | Effort |
|---|------|-------|--------|
| 1.11 | Install `zod` | `package.json` | 2 min |
| 1.12 | Create `lib/env.ts` with Zod schema validating `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_LOGO_DEV_TOKEN` | `lib/env.ts` (new) | 30 min |
| 1.13 | Import and validate at app startup in `app/layout.tsx` | `app/layout.tsx` | 5 min |
| 1.14 | Remove `|| 'placeholder'` fallbacks from Supabase client files | `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts` | 15 min |

### 1D. Rate Limiting

| # | Task | Files | Effort |
|---|------|-------|--------|
| 1.15 | Install `@upstash/ratelimit` + `@upstash/redis` (or use Vercel KV) | `package.json` | 5 min |
| 1.16 | Create `lib/rate-limit.ts` with sliding window config | `lib/rate-limit.ts` (new) | 30 min |
| 1.17 | Add rate limiting to `middleware.ts` for API routes (e.g., 10 req/min per IP) | `middleware.ts` | 20 min |
| 1.18 | Move name-change rate limit from `user_metadata` to a database table or KV store | `app/api/profile/update-name/route.ts`, `supabase/schema.sql` | 45 min |

### 1E. Auth & Data Protection

| # | Task | Files | Effort |
|---|------|-------|--------|
| 1.19 | Add re-authentication step (password confirm) before account deletion | `app/settings/page.tsx:128-151` | 45 min |
| 1.20 | Add explicit RLS deny policies for `bill_providers` INSERT/UPDATE/DELETE | `supabase/schema.sql` | 15 min |
| 1.21 | Sanitize error messages shown to users (strip Supabase internals) | `components/auth/login-flow.tsx:101`, `components/auth/signup-flow.tsx:83`, `app/api/profile/update-name/route.ts:80` | 30 min |

**Verification:** Run `npm run build` — no errors. Visit app in browser, check DevTools Network tab for security headers. Verify CSP doesn't block legitimate resources.

---

## Phase 2 — Error Handling & Observability (Days 4–6)

**Goal:** Make errors visible, traceable, and user-friendly.

### 2A. Error Tracking Integration

| # | Task | Files | Effort |
|---|------|-------|--------|
| 2.1 | Install `@sentry/nextjs` | `package.json` | 5 min |
| 2.2 | Run `npx @sentry/wizard@latest -i nextjs` to auto-configure | Project root | 10 min |
| 2.3 | Configure Sentry DSN via env var `NEXT_PUBLIC_SENTRY_DSN` | `.env`, `sentry.client.config.ts` | 10 min |
| 2.4 | Verify Sentry captures errors in `app/error.tsx` | `app/error.tsx` | 10 min |

### 2B. Error Boundaries

| # | Task | Files | Effort |
|---|------|-------|--------|
| 2.5 | Add `app/global-error.tsx` for root layout crashes | `app/global-error.tsx` (new) | 20 min |
| 2.6 | Add `error.tsx` to every route segment (12 files) | `app/settings/error.tsx`, `app/bills/error.tsx`, `app/inbox/error.tsx`, `app/inbox/[id]/error.tsx`, `app/history/error.tsx`, `app/export/error.tsx`, `app/subscriptions/error.tsx`, `app/renewals/error.tsx`, `app/plans/error.tsx`, `app/profile/error.tsx`, `app/help/error.tsx`, `app/login/error.tsx` | 45 min |
| 2.7 | Add `loading.tsx` with skeleton UI to every route segment (12 files) | `app/settings/loading.tsx`, `app/bills/loading.tsx`, etc. | 45 min |
| 2.8 | Add `not-found.tsx` to `app/inbox/[id]/` | `app/inbox/[id]/not-found.tsx` (new) | 10 min |

### 2C. Fix Silent Error Swallowing

| # | Task | Files | Effort |
|---|------|-------|--------|
| 2.9 | Add `lib/logger.ts` with structured logging (wraps Sentry + console) | `lib/logger.ts` (new) | 20 min |
| 2.10 | Fix `subscription-service.ts` — propagate errors from `fetchSubscriptions()`, `createSubscription()` instead of returning cached/mock data with `error: null` | `lib/services/subscription-service.ts:435-535` | 1 hr |
| 2.11 | Fix `bills-service.ts` — same pattern for `fetchBillPayments()`, `createBillPayment()`, `updateBillPayment()`, `deleteBillPayment()` | `lib/services/bills-service.ts:204-395` | 1 hr |
| 2.12 | Fix `activity-service.ts` — log errors instead of silently returning empty arrays | `lib/services/activity-service.ts:35-53` | 20 min |
| 2.13 | Fix `currency-service.ts` — log exchange rate fetch failures | `lib/services/currency-service.ts:87-111` | 15 min |
| 2.14 | Fix `user-settings-context.tsx` — add logging to the 7 silent inner catch blocks | `lib/contexts/user-settings-context.tsx:170-274` | 30 min |
| 2.15 | Fix `inbox-context.tsx` — add logging to 6 silent catch blocks | `lib/contexts/inbox-context.tsx:92-254` | 20 min |

### 2D. Unhandled Promise Rejections

| # | Task | Files | Effort |
|---|------|-------|--------|
| 2.16 | Add `.catch()` to `fetchExchangeRates().then()` | `lib/contexts/user-settings-context.tsx:145` | 5 min |
| 2.17 | Add error handling to `supabase.auth.updateUser()` in `addCategory`, `updateCategory`, `deleteCategory` | `lib/contexts/user-settings-context.tsx:395-454` | 15 min |
| 2.18 | Add `.catch()` to all `fetchSubscriptions().then()` chains (7 locations) | `components/ai/ask-subhalt-modal.tsx:64`, `components/subscriptions/subscription-manager.tsx:187`, `components/dashboard/dashboard-v2.tsx:108`, `app/export/page.tsx:62`, `components/renewals/renewals-page-content.tsx:61` | 30 min |
| 2.19 | Add error handling to `supabase.auth.signOut()` in Sidebar | `components/layout/Sidebar.tsx:97` | 5 min |

**Verification:** Trigger a network failure (disconnect WiFi) — app should show user-visible error, Sentry should capture it. Check that `loading.tsx` skeletons appear during route transitions.

---

## Phase 3 — Data Integrity (Days 7–8)

**Goal:** Prevent silent data loss and fix race conditions.

| # | Task | Files | Effort |
|---|------|-------|--------|
| 3.1 | Create `lib/safe-local-storage.ts` utility with try/catch wrappers for `getItem`, `setItem`, `removeItem` | `lib/safe-local-storage.ts` (new) | 30 min |
| 3.2 | Replace all `localStorage.setItem()` calls in `user-settings-context.tsx` (14 locations) with safe wrapper | `lib/contexts/user-settings-context.tsx` | 45 min |
| 3.3 | Replace all `localStorage.setItem()` calls in `inbox-context.tsx` (5 locations) | `lib/contexts/inbox-context.tsx` | 20 min |
| 3.4 | Replace all `localStorage.setItem()` calls in services (subscription, bills, activity, currency) | `lib/services/*.ts` | 30 min |
| 3.5 | Replace all `localStorage.setItem()` calls in remaining components (profile, theme, reminders) | `app/profile/page.tsx`, `lib/hooks/use-theme.tsx`, `components/subscriptions/subscription-manager.tsx`, `components/dashboard/dashboard-v2.tsx` | 20 min |
| 3.6 | Fix duplicate `fetchSubscriptions()` on mount in `subscription-manager.tsx` — remove direct call, rely on event listener | `components/subscriptions/subscription-manager.tsx:184-210` | 20 min |
| 3.7 | Fix `dashboard-v2.tsx` effect dependency — remove `subscriptions.length` from deps, use ref to track initial load | `components/dashboard/dashboard-v2.tsx:120` | 15 min |
| 3.8 | Initialize Supabase CLI migrations — run `supabase init`, convert `schema.sql` to first migration | `supabase/migrations/` (new directory) | 30 min |
| 3.9 | Remove `INITIAL_DEMO_BILLS` from `bills-service.ts` — gate behind `NODE_ENV === 'development'` or remove entirely | `lib/services/bills-service.ts:21-146` | 20 min |
| 3.10 | Remove hardcoded mock payment data from `plans/page.tsx` checkout flow | `app/plans/page.tsx:41-53` | 15 min |

**Verification:** Fill localStorage to near capacity (via DevTools) — app should show a toast warning instead of silently losing data. Open two tabs, make changes in both — no data overwrites.

---

## Phase 4 — Performance Quick Wins (Days 9–11)

**Goal:** Reduce unnecessary re-renders and improve rendering performance.

### 4A. React.memo

| # | Task | Files | Effort |
|---|------|-------|--------|
| 4.1 | Wrap `SubscriptionCard` in `React.memo` | `components/subscriptions/subscription-card.tsx` | 10 min |
| 4.2 | Wrap `SubscriptionTable` row component in `React.memo` | `components/subscriptions/subscription-table.tsx` | 15 min |
| 4.3 | Wrap `CategoryBreakdownCard` in `React.memo` | `components/dashboard/category-breakdown-card.tsx` | 5 min |
| 4.4 | Wrap `SmartInsightCard` in `React.memo` | `components/dashboard/smart-insight-card.tsx` | 5 min |
| 4.5 | Wrap `MostExpensivePlanCard` in `React.memo` | `components/dashboard/most-expensive-plan-card.tsx` | 5 min |
| 4.6 | Wrap `UpcomingRenewalsSpotlight` in `React.memo` | `components/dashboard/upcoming-renewals-spotlight.tsx` | 5 min |
| 4.7 | Wrap `SavingsRecommendations` in `React.memo` | `components/ai/savings-recommendations.tsx` | 5 min |
| 4.8 | Wrap `PersonalizedHeader` in `React.memo` | `components/dashboard/personalized-header.tsx` | 5 min |
| 4.9 | Wrap `SubHaltAIAssistant` in `React.memo` | `components/ai/subhalt-ai-assistant.tsx` | 5 min |

### 4B. useCallback for Handler Props

| # | Task | Files | Effort |
|---|------|-------|--------|
| 4.10 | Wrap `onSelectSubscription`, `onEdit`, `onDeleteRequest` in `useCallback` | `components/subscriptions/subscription-manager.tsx:424-436` | 15 min |
| 4.11 | Wrap `onViewSubscription` and AI assistant callbacks in `useCallback` | `components/dashboard/dashboard-v2.tsx:228-229` | 10 min |

### 4C. Memoize Date Computations

| # | Task | Files | Effort |
|---|------|-------|--------|
| 4.12 | Move `new Date()` into `useState` initializer or `useMemo` in 7 components | `components/subscriptions/subscription-card.tsx:59`, `components/subscriptions/subscription-table.tsx:265`, `components/subscriptions/subscription-detail-modal.tsx:82`, `components/history/history-page-content.tsx:83`, `components/ai/savings-recommendations.tsx:57`, `components/ai/cancellation-intelligence-modal.tsx:40`, `components/dashboard/personalized-header.tsx:19` | 20 min |

### 4D. Image Optimization

| # | Task | Files | Effort |
|---|------|-------|--------|
| 4.13 | Replace `<img>` with `next/image` `<Image>` in `service-icon.tsx` | `components/ui/service-icon.tsx:189` | 15 min |
| 4.14 | Replace `<img>` with `<Image>` in `profile/page.tsx` | `app/profile/page.tsx:190` | 10 min |
| 4.15 | Replace `<img>` with `<Image>` in `Sidebar.tsx` | `components/layout/Sidebar.tsx:302` | 10 min |
| 4.16 | Replace `<img>` with `<Image>` in `remembered-account-chooser.tsx` | `components/auth/remembered-account-chooser.tsx:70` | 10 min |

### 4E. setTimeout Cleanup

| # | Task | Files | Effort |
|---|------|-------|--------|
| 4.17 | Add cleanup for `setTimeout` in 6 components | `components/ai/ask-subhalt-modal.tsx:214`, `components/bills/receipt-scan-modal.tsx:82`, `components/subscriptions/receipt-extraction-modal.tsx:51`, `components/integrations/email-forwarding-modal.tsx:34`, `components/integrations/gmail-connect-modal.tsx:41`, `components/layout/Sidebar.tsx:73` | 30 min |

**Verification:** Use React DevTools Profiler — subscription list re-renders should drop significantly. Check Lighthouse performance score improvement.

---

## Phase 5 — Performance Architecture (Days 12–16)

**Goal:** Fix structural performance issues.

### 5A. Split UserSettingsContext

| # | Task | Files | Effort |
|---|------|-------|--------|
| 5.1 | Create `lib/contexts/auth-context.tsx` — user, session, loading, signOut | `lib/contexts/auth-context.tsx` (new) | 1 hr |
| 5.2 | Create `lib/contexts/currency-context.tsx` — defaultCurrency, exchangeRates, setDefaultCurrency | `lib/contexts/currency-context.tsx` (new) | 45 min |
| 5.3 | Create `lib/contexts/plan-context.tsx` — planTier, isPlus, isPremium, upgradePlan | `lib/contexts/plan-context.tsx` (new) | 45 min |
| 5.4 | Create `lib/contexts/categories-context.tsx` — customCategories, addCategory, updateCategory, deleteCategory | `lib/contexts/categories-context.tsx` (new) | 45 min |
| 5.5 | Keep `user-settings-context.tsx` for remaining settings (notifications, billing, preferences) | `lib/contexts/user-settings-context.tsx` | 30 min |
| 5.6 | Update `AppShell.tsx` to wrap new providers | `components/layout/AppShell.tsx:36-84` | 15 min |
| 5.7 | Update all consumer imports (~20 components) to use the correct focused context | Various | 1 hr |

### 5B. Split Monolithic Components

| # | Task | Files | Effort |
|---|------|-------|--------|
| 5.8 | Extract `settings/page.tsx` render helpers into 5 separate components: `BillingSection`, `AccountSection`, `PreferencesSection`, `PrivacySection`, `HelpSection` | `components/settings/billing-section.tsx`, `components/settings/account-section.tsx`, `components/settings/preferences-section.tsx`, `components/settings/privacy-section.tsx`, `components/settings/help-section.tsx` (all new) | 2 hrs |
| 5.9 | Extract `ActivityMessageItem` from `history-page-content.tsx` into its own file | `components/history/activity-message-item.tsx` (new) | 30 min |
| 5.10 | Extract history section views (all, archive, deleted, restored) into separate components | `components/history/history-sections.tsx` (new) | 45 min |

### 5C. Pagination / Virtualization

| # | Task | Files | Effort |
|---|------|-------|--------|
| 5.11 | Install `react-window` | `package.json` | 2 min |
| 5.12 | Add pagination to `subscription-manager.tsx` (client-side, 20 per page) | `components/subscriptions/subscription-manager.tsx` | 1 hr |
| 5.13 | Add pagination to `history-page-content.tsx` (client-side, 50 per page) | `components/history/history-page-content.tsx` | 1 hr |
| 5.14 | Add pagination to bills list | `components/bills/bills-manager.tsx` | 45 min |

**Verification:** Split UserSettingsContext — use React DevTools to confirm changing currency doesn't re-render sidebar. Check component tree sizes are smaller.

---

## Phase 6 — Accessibility & UX (Days 17–19)

**Goal:** Make the app usable for everyone.

### 6A. ARIA Attributes

| # | Task | Files | Effort |
|---|------|-------|--------|
| 6.1 | Add `aria-label` to all icon-only buttons (10+ locations) | `app/settings/page.tsx:481`, `app/profile/page.tsx:167`, `app/help/page.tsx:260`, `components/bills/bill-modal.tsx:190`, `components/ai/ask-subhalt-modal.tsx:245`, `components/ai/subhalt-ai-assistant.tsx:48`, `components/ai/cancellation-intelligence-modal.tsx:93`, `components/integrations/gmail-connect-modal.tsx:135` | 30 min |
| 6.2 | Add `role="dialog"` and `aria-modal="true"` to 5 modals | `components/bills/bill-modal.tsx:177`, `components/ai/ask-subhalt-modal.tsx:229`, `components/ai/cancellation-intelligence-modal.tsx:75`, `components/integrations/gmail-connect-modal.tsx:107`, `app/plans/page.tsx:273` | 20 min |
| 6.3 | Convert "Terms of Use" and "Privacy Policy" `<span>` to `<a>` tags | `components/auth/signup-flow.tsx:482-486`, `components/auth/login-flow.tsx:486-489` | 10 min |
| 6.4 | Add `aria-describedby` linking form errors to inputs | `components/subscriptions/subscription-modal.tsx:314-319`, `components/auth/signup-flow.tsx:430-433`, `components/bills/bill-modal.tsx:132-147` | 30 min |
| 6.5 | Add screen-reader text to status dots in inbox | `components/inbox/inbox-page-content.tsx:181-192` | 10 min |
| 6.6 | Add `aria-label` to search input in help page | `app/help/page.tsx:280-286` | 5 min |

### 6B. Loading States & UX

| # | Task | Files | Effort |
|---|------|-------|--------|
| 6.7 | Add loading/disabled state to category manager submit | `components/settings/category-manager.tsx:172-231` | 15 min |
| 6.8 | Add loading state to history restore/delete buttons | `components/history/history-page-content.tsx:364,374` | 15 min |
| 6.9 | Add loading state to subscription archive button | `components/subscriptions/subscription-card.tsx:179` | 10 min |
| 6.10 | Add loading state to bill save/delete buttons | `components/bills/bills-manager.tsx:94,149` | 15 min |
| 6.11 | Add loading state to upgrade button | `components/subscriptions/upgrade-modal.tsx:31` | 10 min |
| 6.12 | Add loading state to cancellation intelligence update | `components/ai/cancellation-intelligence-modal.tsx:43` | 10 min |
| 6.13 | Add sign-out button to sidebar profile menu | `components/layout/Sidebar.tsx` | 30 min |
| 6.14 | Reduce excessive bottom padding in subscription manager | `components/subscriptions/subscription-manager.tsx:299` | 5 min |

**Verification:** Run axe DevTools or Lighthouse accessibility audit — zero critical issues. Tab through all interactive elements — focus is visible and logical.

---

## Phase 7 — SEO & Marketing (Days 20–21)

**Goal:** Make the app discoverable and shareable.

| # | Task | Files | Effort |
|---|------|-------|--------|
| 7.1 | Add `metadataBase` to root layout metadata | `app/layout.tsx:11-14` | 5 min |
| 7.2 | Add OpenGraph and Twitter card tags to root layout | `app/layout.tsx` | 15 min |
| 7.3 | Create `app/sitemap.ts` generating sitemap for all public routes | `app/sitemap.ts` (new) | 20 min |
| 7.4 | Create `app/robots.ts` blocking `/api/*`, `/login`, `/signup` | `app/robots.ts` (new) | 10 min |
| 7.5 | Add page-specific metadata to all 18 route pages | All `app/**/page.tsx` files | 1 hr |
| 7.6 | Create OG image (1200x630) for social sharing | `public/og-image.png` (new) | 30 min |

**Verification:** Use Twitter Card Validator and Facebook Sharing Debugger to verify OG tags. Check `sitemap.xml` renders correctly.

---

## Phase 8 — Testing (Days 22–26)

**Goal:** Establish a testing foundation.

### 8A. Test Infrastructure

| # | Task | Files | Effort |
|---|------|-------|--------|
| 8.1 | Install `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom` | `package.json` | 5 min |
| 8.2 | Create `vitest.config.ts` with React and path alias support | `vitest.config.ts` (new) | 15 min |
| 8.3 | Add `test` and `test:watch` scripts to `package.json` | `package.json` | 5 min |
| 8.4 | Create `lib/__tests__/` directory structure | Directory | 2 min |

### 8B. Unit Tests — Services

| # | Task | Files | Effort |
|---|------|-------|--------|
| 8.5 | Test `subscription-service.ts` — CRUD operations, error propagation, localStorage fallback | `lib/services/__tests__/subscription-service.test.ts` | 2 hrs |
| 8.6 | Test `bills-service.ts` — CRUD operations, error propagation | `lib/services/__tests__/bills-service.test.ts` | 1.5 hrs |
| 8.7 | Test `currency-service.ts` — exchange rate fetching, fallback behavior | `lib/services/__tests__/currency-service.test.ts` | 1 hr |
| 8.8 | Test `activity-service.ts` — activity recording, history retrieval | `lib/services/__tests__/activity-service.test.ts` | 45 min |
| 8.9 | Test `lib/utils/url-utils.ts` — `getSafeRedirectUrl`, URL validation | `lib/utils/__tests__/url-utils.test.ts` | 30 min |
| 8.10 | Test `lib/utils/metrics-utils.ts` — spend calculations | `lib/utils/__tests__/metrics-utils.test.ts` | 30 min |

### 8C. Unit Tests — Context & Env

| # | Task | Files | Effort |
|---|------|-------|--------|
| 8.11 | Test `lib/env.ts` — valid/invalid env var scenarios | `lib/__tests__/env.test.ts` | 30 min |
| 8.12 | Test `lib/safe-local-storage.ts` — quota exceeded, parse errors | `lib/__tests__/safe-local-storage.test.ts` | 30 min |

### 8D. Component Tests — Critical Flows

| # | Task | Files | Effort |
|---|------|-------|--------|
| 8.13 | Test `AuthForm` — login/signup toggle, form submission | `components/auth/__tests__/auth-form.test.tsx` | 1.5 hrs |
| 8.14 | Test `SubscriptionModal` — create/edit modes, validation | `components/subscriptions/__tests__/subscription-modal.test.tsx` | 1.5 hrs |
| 8.15 | Test `BillModal` — create/edit modes, validation | `components/bills/__tests__/bill-modal.test.tsx` | 1 hr |
| 8.16 | Test `ConfirmDialog` — confirm/cancel actions | `components/ui/__tests__/confirm-dialog.test.tsx` | 30 min |

**Verification:** `npm run test` passes with 100% of new tests green. `npm run test:coverage` shows reasonable coverage of service layer.

---

## Phase 9 — Infrastructure & CI/CD (Days 27–28)

**Goal:** Automate quality checks and deployment.

| # | Task | Files | Effort |
|---|------|-------|--------|
| 9.1 | Create `.github/workflows/ci.yml` — lint, typecheck, test on PR | `.github/workflows/ci.yml` (new) | 45 min |
| 9.2 | Add `type-check` script (`tsc --noEmit`) to `package.json` | `package.json` | 5 min |
| 9.3 | Add `lint:fix` script to `package.json` | `package.json` | 5 min |
| 9.4 | Create `app/api/health/route.ts` — returns `{ status: 'ok', supabase: boolean }` | `app/api/health/route.ts` (new) | 20 min |
| 9.5 | Add `vercel.json` with security headers (defense-in-depth with next.config.ts) | `vercel.json` (new) | 15 min |
| 9.6 | Configure Vercel project settings (environment variables for production) | Vercel Dashboard | 15 min |

**Verification:** Push to a branch — CI runs and passes. Visit `/api/health` — returns `{"status":"ok"}`.

---

## Phase 10 — Code Quality Polish (Days 29–30)

**Goal:** Clean up remaining technical debt.

### 10A. TypeScript

| # | Task | Files | Effort |
|---|------|-------|--------|
| 10.1 | Replace `any` types in `bills-service.ts` (4 instances) with proper types | `lib/services/bills-service.ts:148,264,301,326` | 30 min |
| 10.2 | Replace `any` types in `subscription-service.ts` (3 instances) | `lib/services/subscription-service.ts:308,580,605` | 20 min |
| 10.3 | Replace `any` types in bill components (4 instances) | `components/bills/bill-history-table.tsx:33-34`, `components/bills/bill-modal.tsx:49,116` | 20 min |
| 10.4 | Replace `any` types in remaining components (6 instances) | `app/settings/page.tsx:176`, `lib/contexts/user-settings-context.tsx:381,407`, `components/subscriptions/subscription-manager.tsx:508-510`, `components/bills/receipt-scan-modal.tsx:91,121` | 30 min |

### 10B. CSS Cleanup

| # | Task | Files | Effort |
|---|------|-------|--------|
| 10.5 | Remove unused CSS classes: `.glass-popover`, `.btn-pill`, `.touch-target`, `.page-title`, `.section-heading`, `.card-title`, `.large-metric`, `.body-text`, `.secondary-text` | `app/globals.css` | 30 min |
| 10.6 | Remove or reduce `!important` declarations (42 total) — replace with proper specificity | `app/globals.css:128-319` | 1 hr |
| 10.7 | Either use CSS custom properties in components OR remove the unused `--bg-section`, `--text-secondary`, etc. tokens | `app/globals.css:12-60` | 20 min |

### 10C. Miscellaneous

| # | Task | Files | Effort |
|---|------|-------|--------|
| 10.8 | Add date input constraints (`min`/`max`) to subscription modal | `components/subscriptions/subscription-modal.tsx:407-455` | 15 min |
| 10.9 | Standardize form validation patterns — use `fieldErrors` object everywhere | `components/bills/bill-modal.tsx:128` | 30 min |
| 10.10 | Remove hardcoded `https://subhalt.com` URLs — use env var `NEXT_PUBLIC_SITE_URL` | `app/plans/page.tsx:51`, `app/settings/page.tsx:346`, `components/subscriptions/upgrade-modal.tsx:43` | 15 min |

**Verification:** `npx tsc --noEmit` — zero `any` errors. `npm run lint` — zero warnings. Visual inspection — no layout regressions from CSS cleanup.

---

## Effort Summary

| Phase | Days | Focus |
|-------|------|-------|
| 0 | 1 | Emergency security |
| 1 | 2–3 | Security hardening |
| 2 | 4–6 | Error handling & observability |
| 3 | 7–8 | Data integrity |
| 4 | 9–11 | Performance quick wins |
| 5 | 12–16 | Performance architecture |
| 6 | 17–19 | Accessibility & UX |
| 7 | 20–21 | SEO & marketing |
| 8 | 22–26 | Testing |
| 9 | 27–28 | Infrastructure & CI/CD |
| 10 | 29–30 | Code quality polish |
| **Total** | **~30 days** | |

---

## Dependency Graph

```
Phase 0 (credentials)
  └─> Phase 1 (security headers, CSP, env validation)
        └─> Phase 2 (error handling, Sentry)
              ├─> Phase 3 (data integrity)
              ├─> Phase 4 (performance quick wins)
              └─> Phase 6 (accessibility)
                    └─> Phase 7 (SEO)

Phase 5 (context split) can start after Phase 2 (needs logger)
Phase 8 (testing) can start after Phase 3 (needs stable data layer)
Phase 9 (CI/CD) can start after Phase 8 (needs test script)
Phase 10 (polish) is last
```

---

## Risk Notes

1. **Phase 5 (context split)** is the highest-risk refactor — it touches ~20 consumer components. Do it carefully with incremental testing.
2. **Phase 1 (CSP)** may break resources — test thoroughly in dev before deploying.
3. **Phase 2 (error propagation)** changes service return contracts — all callers must be updated.
4. **Phase 8 (testing)** requires mocking Supabase — use `vitest` with MSW or manual mocks.
