# SubHalt — Mobile Implementation Plan

Status: **Proposed** · Scope: full mobile/responsive pass across all 25 routes and 72 components
Stack constraints: Next.js `16.2.11` (App Router), React `19.2.4`, Tailwind CSS 4 (CSS-first `@theme`, no JS config file)

---

## 1. Goals

1. Make every route usable and well-composed on phone-sized viewports (320px → 430px) with no horizontal scroll, no clipped controls, and no unreachable actions.
2. Replace the mobile hamburger + slide-in drawer with a **floating bottom dock** as the primary mobile navigation.
3. Make every card, table, form, modal, and chart responsive by construction — not by per-page patches.
4. Enforce minimum touch-target sizing and iOS-safe-area handling app-wide.
5. Cover all 25 routes and all 72 non-test components. No page is deferred to a "later" bucket.

### Non-goals

- No visual rebrand. The dark palette (`#000000` / `#0B0D0D` / `#14B8A6`) and the "no shadow / no gradient / flat border" rules in `app/globals.css:124-176` stay.
- No native app. A PWA install path is included as an optional later phase (Phase 7), not a Phase 1 dependency.
- No data-layer or API changes, except where a mobile layout exposes an existing bug (see §9).

---

## 2. Current state

### 2.1 What already exists (keep)

| Asset | Location | Status |
|---|---|---|
| Collapsible desktop sidebar | `components/layout/Sidebar.tsx:466-486` | Good at `lg+` |
| Mobile drawer, 260px, `max-w-[80vw]` | `components/layout/Sidebar.tsx:489-501` | To be replaced on phones |
| Sticky glass header, `h-14 sm:h-16` | `components/layout/Header.tsx:24` | Needs mobile rework |
| Fluid page gutters | `AppShell.tsx:65` `px-3 sm:px-6 lg:px-8` | Good baseline |
| Design tokens | `app/globals.css:12-60` | Good, needs extension |
| 44px form-control floor | `app/globals.css:185` `min-height: 44px` | Good |
| iOS zoom prevention | `app/globals.css:252-262` (16px inputs under 639px) | Good |
| `.touch-target` helper | `app/globals.css:265-268` | Under-used |
| Scroll-lock + Escape in modals | e.g. `components/history/activity-detail-modal.tsx:22-40` | Inconsistent across modals |
| Page-transition animation | `app/globals.css:236-249` | Good |

### 2.2 Gaps to close

**Typography is fixed-px and desktop-sized.** `.page-title` is `40px/48px` (`globals.css:78-84`), `.large-metric` is `48px/56px` (`:101-107`), `.section-heading` is `28px/36px` (`:86-92`). At 320–390px these overflow or dominate the viewport. None of these are fluid.

**`100vh` semantics.** `AppShell.tsx:47` uses `min-h-screen` and `Sidebar.tsx:470` uses `h-screen`. Mobile browser chrome collapses, so `vh` units cause viewport jumps. `dvh`/`svh` are needed.

**No safe-area handling.** The notch, home indicator, and landscape cutouts are unhandled. The current `pb-12` on mobile main (`AppShell.tsx:65`) is compensating for the drawer, not the OS.

**Header controls are below touch-target size on phones.** The "Ask SubHalt" button is `px-3.5 py-1.5 text-xs` (`Header.tsx:45`) ≈ 32px tall.

**`/renewals` has no navigation entry.** It is absent from `navItems` (`Sidebar.tsx:36-44`) and reachable only from the dashboard and the spotlight card. The dock promotes it to a primary slot (§4.2).

**Tables have no mobile strategy.** `components/subscriptions/subscription-table.tsx`, `components/bills/bill-history-table.tsx`, and the admin tables are wide multi-column layouts.

**Modals use fixed `p-4` padding and no height cap.** E.g. `components/subscriptions/subhalt-assistance-modal.tsx:74-84`, `components/history/activity-detail-modal.tsx:52-58`. Long forms will overflow vertically with no scroll and no sticky actions.

**`overflow-x-hidden` on main masks overflow bugs** (`AppShell.tsx:65`), so layout defects are invisible rather than caught.

**No PWA manifest or app icons.** Relevant if the app is installed to a home screen, where `display-mode: standalone` changes the available viewport.

---

## 3. Breakpoint strategy

Tailwind 4 defaults are in use: `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px.

| Band | Width | Navigation | Layout |
|---|---|---|---|
| **Compact phone** | `< 640px` | Floating dock + More sheet | Single column, 16px gutters |
| **Large phone** | `640–767px` | Floating dock + More sheet | Single column, 20px gutters |
| **Tablet** | `768–1023px` | Floating dock + More sheet | 2-column card grids |
| **Desktop** | `>= 1024px` | Collapsible sidebar (unchanged) | Existing grids |

**Decision point for the user:** the dock is specified for all widths below `lg`. If tablet portrait (768–1023px) feels cramped, the drawer at `Sidebar.tsx:489-501` can be retained for the `md` band only via `hidden md:block lg:hidden` on the dock. Default recommendation: keep the dock everywhere below `lg` for a single, consistent mental model.

### 3.1 Fluid tokens to add to `app/globals.css`

```css
@theme {
  --spacing-dock: 3.5rem;            /* 56px dock bar */
  --spacing-safe-b: env(safe-area-inset-bottom, 0px);
  --spacing-safe-t: env(safe-area-inset-top, 0px);
  --spacing-gutter: 1rem;            /* 16px phone */
}

@media (min-width: 640px)  { :root { --spacing-gutter: 1.25rem; } }  /* 20px */
@media (min-width: 768px)  { :root { --spacing-gutter: 1.5rem; } }   /* 24px */
@media (min-width: 1024px) { :root { --spacing-gutter: 2rem; } }     /* 32px */
```

Convert the fixed type ramp to `clamp()`:

```css
.page-title    { font-size: clamp(1.5rem, 1.05rem + 2.2vw, 2.5rem);   line-height: 1.15; }
.section-heading{ font-size: clamp(1.25rem, 1rem + 1.2vw, 1.75rem);   line-height: 1.25; }
.card-title    { font-size: clamp(1rem, 0.95rem + 0.25vw, 1.125rem);   line-height: 1.35; }
.large-metric  { font-size: clamp(2rem, 1.4rem + 3vw, 3rem);           line-height: 1.1; }
.body-text     { font-size: 1rem;   line-height: 1.5; }
.secondary-text{ font-size: 0.8125rem; line-height: 1.4; }
```

`clamp()` means no per-page font overrides are needed anywhere.

### 3.2 Viewport and safe-area plumbing

Export a static `viewport` object from `app/layout.tsx` (Server Component only — do **not** use `generateViewport`; nothing here depends on request data, and the static object keeps the static shell):

```tsx
import type { Viewport } from 'next'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',      // required for env(safe-area-inset-*) to be non-zero
  colorScheme: 'dark',
  themeColor: '#000000',
}
```

Notes:
- `maximumScale` / `userScalable: false` are **not** set — disabling zoom is an accessibility failure.
- `viewportFit: 'cover'` is the enabling flag; without it all safe-area insets resolve to `0px` and the dock will sit under the home indicator.
- Replace `min-h-screen` → `min-h-[100dvh]` at `AppShell.tsx:47` and `h-screen` → `h-[100dvh]` at `Sidebar.tsx:470`.

---

## 4. Floating dock — design

### 4.1 Behaviour

- Fixed to the bottom, horizontally centered, inset `12px` from each edge, `max-width: 480px`, `border-radius: 20px`, floating above page content with a 1px `#1A1D1D` border and a deep shadow (the one sanctioned shadow in the app — elevation is required for a floating surface; add it as `.glass-dock` in `globals.css` and document the exception).
- Height `56px` + `padding-bottom: env(safe-area-inset-bottom)`.
- **Hidden** on `/login`, `/signup`, `/plans` (the `isFullPage` branch, `AppShell.tsx:17,41-45`).
- **Hidden** while any modal/sheet is open, and while the on-screen keyboard is up (avoids a double-stacked obstruction).
- Auto-hides on downward scroll past 120px, returns on upward scroll or at scroll top. Never hides on `/` (dashboard) or on pages with a sticky action bar.
- Appears on route change, replacing the drawer-fade used today.

### 4.2 Slots (4)

| # | Item | Route | Icon |
|---|---|---|---|
| 1 | Home | `/` | `LayoutDashboard` |
| 2 | Subscriptions | `/subscriptions` | `CreditCard` |
| 3 | Renewals | `/renewals` | `Clock` |
| 4 | More | — | opens the More sheet |

Four slots means each target is ~25% of the dock width (≈74px on a 320px screen), so every slot clears 44×44px **with room for a visible label** — no icon-only compromise, and no mis-tap risk from crowding.

**Why Renewals earns a slot and Inbox does not.** `/renewals` currently has *no* entry in the sidebar nav (`Sidebar.tsx:36-44`); it is reachable only from two dashboard links (`dashboard-v2.tsx:308,348`) and the renewals spotlight card (`upcoming-renewals-spotlight.tsx:81`). Promoting it closes a real discoverability gap, and it is the app's core time-sensitive value — "what is about to charge me". Inbox already has a permanent home in the header bell (`Header.tsx:53-63`), so a dock slot would be redundant.

**Inbox stays reachable three ways:** the header bell, a pinned row at the top of the More sheet, and the existing dashboard inbox card.

Active state: teal `#14B8A6` icon and label plus a 4px-tall indicator bar above the slot. Inactive: `#94A3B8`. Labels always visible at 11px/600.

**The unread count moves to the header.** Upgrade the bell from a bare 2px dot (`Header.tsx:61`) to a count pill reusing the treatment at `Sidebar.tsx:344-348`, clamped to `99+`, with `aria-label={`Inbox, ${unreadCount} unread items`}`. The minimal dot stays on the dashboard card where horizontal space is tighter.

### 4.3 More sheet

A bottom sheet (not a full-screen modal) sliding from the bottom, `max-h-[85dvh]`, scrollable, drag-to-dismiss, Escape to close, focus-trapped, `role="dialog" aria-modal="true"`. Contents in order:

- **Inbox** → `/inbox` — pinned to the top of the sheet, with the unread count badge, since it is no longer a dock slot
- **Bills & Payments** — parent row → expands to `Pay a Bill`, `Payment History`. Hidden when `BILL_PAYMENT_ENABLED` is false (`Sidebar.tsx:146-148`).
- **History** — parent row → expands to `Past Activity`, `Archive`, `Deleted`, `Restored`.
- **Export & Analytics** → `/export`
- **Settings** → `/settings`
- **Profile** → `/profile`
- **Help** → `/help`
- **Upgrade Plan** → `/plans?from=…` — only when `!isPlus`
- **Admin** → `/admin` — only when `isAdmin`
- **Log out** — destructive styling, separated by a divider

The accordion-parent pattern is lifted from `Sidebar.tsx:185-319` so the two nav systems stay behaviourally identical. The 30-day name-change and plan-context calls stay untouched.

### 4.4 Contextual FAB

A separate 56px FAB, `bottom: dock-height + safe-area + 12px`, `right: 16px`, hidden on scroll-down. Label is icon-only with `aria-label`; on first use a one-time coachmark explains it.

| Route | FAB action |
|---|---|
| `/`, `/subscriptions` | Add subscription |
| `/renewals` | Add subscription |
| `/bills`, `/bills/pay` | Record payment |
| `/bills/history` | Record payment |
| `/export`, `/settings`, `/profile`, `/help`, `/history*`, `/inbox*` | none |
| `/admin*` | none (admin has its own tab bar) |

Rationale: keeping the dock purely navigational and the FAB purely actionable avoids mixing navigation and action in one floating surface, and keeps the 4-slot dock uncluttered at 320px.

### 4.5 New files

```
components/layout/MobileDock.tsx        # dock bar, active state, auto-hide
components/layout/MoreSheet.tsx         # bottom sheet: pinned Inbox row + nested accordions
components/layout/ContextualFab.tsx     # route-aware primary action
lib/hooks/use-dock-items.ts             # derives the 4 slots from pathname + flags + isAdmin
lib/hooks/use-safe-area.ts              # reads env(safe-area-inset-*) into CSS vars
lib/hooks/use-scroll-direction.ts       # auto-hide behaviour
```

### 4.6 `AppShell.tsx` changes

```
main:  min-h-[100dvh]
       px-(--spacing-gutter)
       pt-[calc(1.5rem+var(--spacing-safe-t))]
       pb-[calc(var(--spacing-dock)+var(--spacing-safe-b)+5.5rem)]   < lg only
       pb-12                                                       >= lg
       overflow-x-clip                                              (was overflow-x-hidden)
       scroll-padding-bottom: calc(var(--spacing-dock) + 4rem)
```

- Remove the `mobileMenuOpen` state and the `onMobileMenuToggle` prop.
- Keep `isSidebarCollapsed` for `lg+` only.
- Move `ToastContainer` above the dock (`z-[70]` vs dock `z-60`) and, below `lg`, offset it by the dock height so toasts are not hidden behind it.
- Keep `AskSubHaltModal` at the shell level.

### 4.7 `Header.tsx` changes

- Drop the hamburger button entirely (below `lg`). Keep the slot in the DOM above `lg` only if a future desktop affordance needs it; otherwise delete.
- Raise "Ask SubHalt" to `min-h-[44px] px-3` and keep the short label below `sm` (`Header.tsx:48-49` already does this).
- Header height `h-14` is fine; add `pt-[var(--spacing-safe-t)]` compensation so the notch does not clip the bell.
- **The bell becomes the primary Inbox entry point** (`Header.tsx:53-63`), since Inbox left the dock. Replace the 2px dot at `Header.tsx:61` with a count pill: teal `#14B8A6` background, `#091512` text, `min-w-[20px] h-[20px]`, `text-[10px] font-bold`, clamped to `99+`. Keep the existing `aria-label` and `title` at `Header.tsx:56-57`. Add `focus-visible` ring styling, which `.settings-nav` currently strips globally (`globals.css:274-315`).

---

## 5. Shared responsive primitives

Build these first; most per-page work then becomes configuration.

### 5.1 `components/ui/sheet.tsx` (new)

Base for every modal/drawer. Handles: `dvh` height cap, internal scroll, sticky header and sticky footer action row, backdrop click, Escape, `document.body` scroll-lock with reference counting (so nested modals do not unlock early — `activity-detail-modal.tsx:22-40` currently has no reference counting), focus trap, focus restore, and `aria-modal`/`role="dialog"`/`aria-labelledby`.

Variants:
- `size="sm" | "md" | "lg" | "full"`
- `placement="center" | "bottom"`
- Below `sm`, `placement="center"` renders as a bottom sheet with top-rounded corners and `max-h-[92dvh]`.

Migrate all 21 existing modals onto it (§7.2).

### 5.2 `components/ui/responsive-table.tsx` (new)

Wraps a `<table>` and provides a `mobileCard` render prop. Below `md`, each row renders as a stacked card (primary label, secondary line, trailing value, chevron) instead of a table. The table markup is preserved for `md+` and for screen readers via `role="table"` semantics or a visually-hidden summary.

### 5.3 `components/ui/stat-grid.tsx` (new)

Wraps stat cards. `grid-cols-2` below `sm`, `grid-cols-2 md:grid-cols-3`, `lg:grid-cols-4`. Used by dashboard, bills summary, export analytics, and all admin tabs.

### 5.4 `components/ui/filter-bar.tsx` (new)

Horizontally scrollable chip row on phones (`overflow-x-auto no-scrollbar`, `scroll-snap-type: x mandatory`, edge fade masks) that expands into a wrapping grid at `md+`. Replaces the current filter layouts in `subscription-filters.tsx`, `history-page-content.tsx`, and `bills-manager.tsx`.

### 5.5 `components/ui/app-table.tsx` / chart containers

- Tables: `min-w-[640px]` inside an `overflow-x-auto` wrapper **with a sticky first column** (`position: sticky; left: 0`) so the entity name stays visible. Header row sticky under the app header.
- Charts: fixed `h-[200px]` below `sm`, `h-[260px]` at `sm+`. Bar/line charts get a reduced tick count and no rotated axis labels below `sm`. Donut charts get an external legend below `sm`. Category colour palettes must remain distinguishable at 200px width.

### 5.6 Touch-target enforcement

- Global: add `button, [role="button"], a[href] { touch-action: manipulation; }` to `@layer base` to remove the 300ms tap delay.
- Audit every interactive element for `min-h`/`min-w` of 44px; add the existing `.touch-target` class where missing (`app/globals.css:265-268`).
- Increase spacing between adjacent destructive actions to `gap-2` minimum.

### 5.7 Accessibility

- `prefers-reduced-motion`: disable `animate-page-transition` (`globals.css:247`), the dock slide/fade, sheet drag, and `subtleShake` (`:322-328`).
- Dock uses `role="navigation" aria-label="Primary"`. Slot order is fixed and matches visual order.
- All icon-only controls (FAB, header bell, card overflow menus) require `aria-label`.
- Verify focus-visible rings survive the flat-design rules — note `app/globals.css:274-315` nukes `outline` inside `.settings-nav`, so that region needs an explicit `:focus-visible` style.

---

## 6. Per-route plan — all 25 routes

### 6.1 Public / full-page (no dock)

| Route | File | Work |
|---|---|---|
| `/login` | `app/login/page.tsx` | Center card `max-w-sm`; single column below `sm`; 44px inputs; ensure `min-h-[100dvh]`; add `autoComplete` attributes for iOS. Related: `components/auth/login-flow.tsx`, `auth-form.tsx`, `remembered-account-chooser.tsx` — the chooser must scroll horizontally below `sm` and use 44px rows. |
| `/signup` | `app/signup/page.tsx` | Same as login plus multi-step progress (`components/auth/signup-flow.tsx`); step indicator must not overflow at 320px; password rules list wraps. |
| `/plans` | `app/plans/page.tsx` | Pricing cards stack below `md`; feature comparison table → per-feature accordion below `md`; Paystack CTA `min-h-[48px]` full-width below `sm`. Also fix the `from` open-redirect risk flagged in §9. |

### 6.2 Main app (dock visible)

| Route | File | Work |
|---|---|---|
| `/` | `app/page.tsx` → `components/dashboard/dashboard-v2.tsx` | Reorder for mobile: `PersonalizedHeader` → `StatGrid` (2-up) → `MostExpensivePlanCard` → `CategoryBreakdownCard` → `SmartInsightCard` → `UpcomingRenewalsSpotlight` → `AdBanner`. All cards `p-4` below `sm`, `p-6` at `sm+`. Chart legend below chart below `sm`. FAB = Add subscription. |
| `/subscriptions` | `app/subscriptions/page.tsx` → `subscription-manager.tsx` | Toggle card/table by viewport: `subscription-card.tsx` list below `md`, `subscription-table.tsx` at `md+`. `subscription-filters.tsx` → `FilterBar`. Toolbar wraps to two rows below `sm`. FAB = Add. |
| `/renewals` | `app/renewals/page.tsx` → `renewals-page-content.tsx` | **Dock slot 3 — treat as a primary screen.** Group by urgency section; each subscription is a full-width row with name, amount, date, and a status pill; status text never colour-only. FAB = Add. |
| `/bills` | `app/bills/page.tsx` → `bills-manager.tsx` | Feature-flagged. `bill-spending-summary.tsx` uses `StatGrid`; provider/category breakdowns become stacked bars. |
| `/bills/pay` | `app/bills/pay/page.tsx` → `pay-a-bill-flow.tsx` | Multi-step flow: one step per screen below `sm`, sticky footer with Back/Continue at 44px. `provider-logo.tsx` verified below 44px. FAB = Record payment. |
| `/bills/history` | `app/bills/history/page.tsx` → `bill-history-table.tsx` | `ResponsiveTable` card mode below `md`. |
| `/inbox` | `app/inbox/page.tsx` → `inbox-page-content.tsx` | No dock slot — entry points are the header bell and the pinned More-sheet row. Type filters → `FilterBar`; item rows min-height 64px with unread dot, title, 2-line clamp, relative time, and a 44px action row. |
| `/inbox/[id]` | `app/inbox/[id]/page.tsx` → `inbox-detail-content.tsx` | Full-width card; metadata grid 1-col below `sm`; action button full-width. Needs an explicit back affordance in the header, since the dock has no Inbox slot to return to. |
| `/history` | `app/history/page.tsx` → `history-page-content.tsx` | The 4 sub-views become a segmented control (`all / archive / deleted / restored`) below `md` instead of nested nav. |
| `/history/all` | `app/history/all/page.tsx` | `ActivityDetailModal` reachable; rows are cards below `md`. |
| `/history/archive` | `app/history/archive/page.tsx` | As above, plus empty state. |
| `/history/deleted` | `app/history/deleted/page.tsx` | As above; destructive confirmations get full-width buttons. |
| `/history/restored` | `app/history/restored/page.tsx` | As above. |
| `/export` | `app/export/page.tsx` | Import/export actions become a stacked action list below `sm`; the analytics charts use the §5.5 rules; the restore-confirmation dialog uses `Sheet`. |
| `/settings` | `app/settings/page.tsx` | **Largest single page.** The `.settings-nav` rail (`globals.css:274-319`) becomes a horizontally scrollable chip row below `md`. Each section's rows become full-width stacked cards. All 6 modals migrate to `Sheet`. |
| `/profile` | `app/profile/page.tsx` | Avatar/name/email/accent sections stack; avatar upload button full-width; `ChangeEmailModal` via `Sheet`. |
| `/help` | `app/help/page.tsx` | Search input sticky under the header; `HELP_TOPICS` accordion items min-height 56px; long answers break long words (`overflow-wrap: anywhere`). |
| `/admin` | `app/admin/page.tsx` → `admin-shell.tsx`, `admin-overview.tsx` | Admin tabs → `md`+ horizontal tabs, below `md` a `FilterBar` chip row or a select. `StatCard` grid via `StatGrid`. |
| `/admin/users` | `app/admin/users/page.tsx` → `admin-users.tsx` | `ResponsiveTable` card mode; per-row action menus become a bottom sheet; search/filter row wraps. |
| `/admin/payments` | `app/admin/payments/page.tsx` → `admin-payments.tsx` | As above. |
| `/admin/providers` | `app/admin/providers/page.tsx` → `admin-providers.tsx` | As above; the create/edit form uses `Sheet` with sticky footer. |
| `/admin/integrations` | `app/admin/integrations/page.tsx` → `admin-integrations.tsx` | As above. |

### 6.3 Shared modal migrations (21 files)

All move to `components/ui/sheet.tsx`:

`subscription-modal.tsx` · `subscription-detail-modal.tsx` · `add-subscription-modal.tsx` · `subscription-notes-modal.tsx` · `receipt-import-modal.tsx` · `payment-reminder-modal.tsx` · `upgrade-modal.tsx` · `link-subscription-modal.tsx` · `subhalt-assistance-modal.tsx` *(delete — see §9)* · `bill-modal.tsx` · `bill-detail-modal.tsx` · `receipt-scan-modal.tsx` · `activity-detail-modal.tsx` · `inbox-detail-content.tsx` · `ask-subhalt-modal.tsx` · `cancellation-intelligence-modal.tsx` · `savings-recommendations.tsx` · `gmail-connect-modal.tsx` · `email-forwarding-modal.tsx` · `legal-modal.tsx` · `edit-billing-modal.tsx` · `change-email-modal.tsx` · `delete-account-modal.tsx` · `category-manager.tsx` · `add-payment-modal.tsx` · `confirm-dialog.tsx`

Special cases:
- `ask-subhalt-modal.tsx` → near-fullscreen sheet on phones; message input pinned to the bottom above the keyboard; conversation sidebar becomes a slide-in panel.
- `receipt-scan-modal.tsx` and `receipt-import-modal.tsx` → file input must accept capture from the camera; preview must scale to viewport width; drag-and-drop needs a tap-to-browse fallback (drag is unusable on touch).
- `delete-account-modal.tsx` → type-to-confirm input scrolls into view when the keyboard opens.
- `category-manager.tsx` → inline add/rename rows with 44px hit areas, not a desktop-style table.

---

## 7. Per-component work

### 7.1 By folder

**`components/layout`** — `AppShell.tsx` (§4.6), `Header.tsx` (§4.7, plus the unread count pill that replaces the dock badge), `Sidebar.tsx` (desktop-only; delete the mobile drawer block at `:489-501`, hoist `navItems`/`billsSubItems`/`historySubItems` into a shared module consumed by both nav systems).

**`components/dashboard`** — `dashboard-v2.tsx` (mobile order, FAB), `personalized-header.tsx` (fluid type, wrap), `most-expensive-plan-card.tsx` (metric scale), `category-breakdown-card.tsx` (chart rules), `smart-insight-card.tsx` (drop the 5 unused imports; clamp body to 3 lines), `ad-banner.tsx` (respect safe-area, never overlap the dock).

**`components/subscriptions`** — `subscription-manager.tsx` (card/table switch, toolbar wrap, fix reopen race §9), `subscription-card.tsx` (`p-4`, 44px actions, no horizontal scroll), `subscription-table.tsx` (responsive wrapper), `subscription-filters.tsx` (`FilterBar`), `subscription-modal.tsx` (Sheet + sticky footer + scroll-referenced receipt section), `add-subscription-modal.tsx` (1-col below `sm`; category select full-width), `subscription-detail-modal.tsx` (metadata 1-col; notes wrap; receipt list scrolls), `subscription-notes-modal.tsx` (textarea `min-h-[40dvh]`), `receipt-import-modal.tsx`, `payment-reminder-modal.tsx`, `upgrade-modal.tsx` (pricing stack), `link-subscription-modal.tsx` (provider grid 1-col), `upcoming-renewals-spotlight.tsx` (horizontal snap carousel or stacked list), **`subhalt-assistance-modal.tsx` — delete (unreferenced)**.

**`components/bills`** — `bills-manager.tsx` (grids + FAB), `bill-spending-summary.tsx` (`StatGrid` + stacked bars), `bill-modal.tsx`, `bill-detail-modal.tsx` (receipt images scale to container, `object-contain`), `bill-history-table.tsx` (responsive wrapper), `pay-a-bill-flow.tsx` (one step per screen, sticky footer), `receipt-scan-modal.tsx` (camera capture, tap-to-browse), `provider-logo.tsx` (size variants, `loading="lazy"`, sized fallback so layout never shifts).

**`components/history`** — `history-page-content.tsx` (segmented control, card rows), `activity-detail-modal.tsx` (Sheet; already has Escape + scroll-lock — port that into `Sheet`).

**`components/inbox`** — `inbox-page-content.tsx` (64px rows, 2-line clamp, `FilterBar`), `inbox-detail-content.tsx` (1-col metadata, full-width actions, explicit back control in the header).

**`components/settings`** — all 6 modals via `Sheet`; `category-manager.tsx` inline editing.

**`components/integrations`** — `gmail-connect-modal.tsx` (candidate list → cards; OAuth restart button full-width), `email-forwarding-modal.tsx` (the forwarding address must be selectable and copyable — use a monospace wrap-anywhere block plus a 44px copy button).

**`components/ai`** — `ask-subhalt-modal.tsx` (fullscreen sheet, bottom-pinned composer), `savings-recommendations.tsx` (card list; remove unused imports), `cancellation-intelligence-modal.tsx` (scrollable steps; 44px CTAs).

**`components/admin`** — `admin-shell.tsx` (tabs → chip row below `md`), `admin-ui.tsx` (`StatCard` fluid metric, loading/error/empty states sized for phones), `admin-overview.tsx`, `admin-users.tsx`, `admin-payments.tsx`, `admin-providers.tsx`, `admin-integrations.tsx` (all: responsive tables, sheet-based row actions, full-width primary actions).

**`components/auth`** — `auth-form.tsx` (full-width controls, 44px), `login-flow.tsx`, `signup-flow.tsx` (step indicator fits 320px), `remembered-account-chooser.tsx` (horizontal scroll, 44px rows).

**`components/ui`** — `button.tsx` (min-height by variant: `sm` → 40px, `default`/`lg` → 44px; add `block` for full-width mobile CTAs), `custom-select.tsx` (44px trigger, full-width listbox, native `<select>` fallback on small screens for reliability), `confirm-dialog.tsx` (already has tests — extend, don't rewrite), `toast.tsx` (offset above dock; full-width below `sm`; dismiss target 44px), `skeleton.tsx` (no layout shift; keep aspect ratios), `section-error.tsx` (retry button full-width), `page-loading.tsx` (centred, respects safe areas), `card-icons.tsx` (fixed box so cards don't reflow), `service-icon.tsx` (fix the `null` return for `subhalt` §9), `subhalt-avatar.tsx` (size variants for dock and FAB).

### 7.2 Guard against regressions

`overflow-x-hidden` on `<main>` currently hides horizontal-overflow bugs. During this work, temporarily switch to `overflow-x-clip` and add a dev-only overflow detector that logs any element wider than `document.documentElement.clientWidth`. Remove the detector once all pages are clean.

---

## 8. Phased execution plan

Each phase ends with `npm run lint`, `tsc --noEmit`, `npm test`, and a manual pass across the §10 device matrix.

### Phase 0 — Baseline and instrumentation (0.5 day)
1. Capture current screenshots at all widths for all 25 routes (baseline for diffing).
2. Add the dev-only horizontal-overflow detector.
3. Add the overflow detector + `100dvh` audit to CI or a pre-commit checklist.

### Phase 1 — Foundation (2–3 days)
1. Add the fluid tokens, `clamp()` type ramp, and gutter variables to `app/globals.css`.
2. Export the `viewport` object from `app/layout.tsx`.
3. Build `components/ui/sheet.tsx` with scroll-lock reference counting, focus trap, and Escape.
4. Build `responsive-table.tsx`, `stat-grid.tsx`, `filter-bar.tsx`, chart container rules.
5. Add reduced-motion guards and `touch-action: manipulation`.
6. Update `Button`, `custom-select`, `toast`, `skeleton` for 44px minimums.

**Gate:** tokens land, no page regressed on desktop.

### Phase 2 — Dock navigation (2–3 days)
1. Create `lib/hooks/use-dock-items.ts` and extract nav data from `Sidebar.tsx` into a shared module.
2. Build `MobileDock`, `MoreSheet`, `ContextualFab`, and the scroll/safe-area hooks.
3. Rewire `AppShell`: remove the hamburger, add dock offsets, lift toasts above the dock.
4. Rewire `Header`: drop the hamburger, fix touch targets, add safe-area padding.
5. Reduce `Sidebar` to `lg+`; delete the mobile drawer block.
6. Verify dock behaviour with `BILL_PAYMENT_ENABLED` on/off and `isAdmin` on/off.

**Gate:** every route reachable on a 320px viewport using only the dock and More sheet.

### Phase 3 — Core app pages (4–5 days)
1. `/` dashboard: reorder, `StatGrid`, chart rules, FAB.
2. `/subscriptions`: card/table switch, `FilterBar`, toolbar wrap.
3. `/renewals`: urgency grouping, full-width rows.
4. `/inbox` and `/inbox/[id]`: row density, clamps, 1-col metadata.
5. `/history` + 4 sub-routes: segmented control, card rows.
6. Delete `subhalt-assistance-modal.tsx` and remove the hamburger-era dead paths.

### Phase 4 — Bills (3–4 days)
1. `/bills`, `/bills/pay`, `/bills/history`.
2. `pay-a-bill-flow` one-step-per-screen with sticky footer.
3. `receipt-scan-modal` camera capture and tap-to-browse.
4. `provider-logo` sizing and layout-shift fixes.

### Phase 5 — Settings, profile, export, help, plans (4–5 days)
1. `/settings`: chip nav, stacked section cards, 6 modal migrations.
2. `/profile`, `/export`, `/help`.
3. `/plans`: stacked pricing, feature accordion.
4. `/login`, `/signup`: full-page mobile composition.

### Phase 6 — Admin (2–3 days)
1. `admin-shell` tabs → chip row below `md`.
2. All 5 admin pages: responsive tables, sheet row actions, `StatGrid`.
3. Fix the identical `paidPlans`/`pendingPlans`/`failedPlans` counts (§9) so the mobile tiles are not showing wrong data.

### Phase 7 — Polish and PWA (2–3 days, optional)
1. `app/manifest.ts` (`MetadataRoute.Manifest`) with `display: 'standalone'`, `background_color: '#000000'`, `theme_color: '#000000'`, and 192/512 icons in `public/`.
2. Apple touch icon and `appleWebApp` metadata in `app/layout.tsx`.
3. Web Push opt-in for renewal/bill reminders (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `public/sw.js`) — a natural fit for a mobile-first product.
4. Landscape and split-view verification; `<meta name="color-scheme">` already handled via `viewport.colorScheme`.
5. Final reduced-motion, 200% text-zoom, and screen-reader passes.

**Total estimate: ~20–27 working days**, excluding the unrelated correctness fixes in §9.

---

## 9. Defects that must be fixed as part of this work

These were found in the preceding audit and intersect directly with mobile layout. Fixing them now avoids shipping mobile UI on top of broken behaviour.

| # | Issue | Location | Why it blocks mobile |
|---|---|---|---|
| 1 | `getAdminOverview` counts `plan_subscriptions` three times with no `status` filter, so Paid/Pending/Failed tiles are identical | `lib/services/admin-service.ts:59-62` | Admin stat tiles are the most prominent mobile cards; they'd show wrong data |
| 2 | Receipt-scan quota never enforced — `authenticated` has no `SELECT` on `receipt_scan_usage`, so the count always returns 0 | `supabase/schema.sql:174-175`, `migrations/010_receipt_storage.sql:67-68`, `lib/services/receipt-scan-usage.ts:36-45` | The scan-limit upsell card will always show scans remaining |
| 3 | `subhalt-assistance-modal.tsx` is referenced nowhere and claims "SubHalt will execute automated cancellation" | `components/subscriptions/subhalt-assistance-modal.tsx` (241 lines) | Dead component; migrating it to a Sheet wastes a day and ships a false claim |
| 4 | `plans/page.tsx` passes the user-controlled `from` query to `router.push` | `app/plans/page.tsx` | Open-redirect risk on a page that is a primary dock target |
| 5 | `ServiceIcon` returns `null` for the name `subhalt` | `components/ui/service-icon.tsx` | Direct-child callers render an empty box, breaking card alignment on small screens |
| 6 | Detail modal reopens after closing (open state set during render, no latch) | `components/subscriptions/subscription-manager.tsx:158` | Very visible when the Sheet is full-height on a phone |
| 7 | Plan-limit rejection shows a success toast and closes the modal | `components/subscriptions/subscription-modal.tsx:269` | Mobile users hit the free limit sooner; the wrong feedback is worse |
| 8 | Duplicate success toasts on create | `subscription-modal.tsx:269` + `subscription-manager.tsx:281` | Stacked toasts collide with the dock on mobile |
| 9 | Receipt/history metadata lost on save and on restore | `subscription-modal.tsx:234`, `lib/services/subscription-service.ts:805,839` | The detail Sheet is the main place receipts are viewed; they will be missing |
| 10 | `GROQ_WEB_SEARCH` documented but never consumed; no `tools` in the Groq request | `lib/ai/server.ts:107-112`, `.env.example:19` | The AI Sheet promises cited sources that can never appear |
| 11 | `FREE_SUBSCRIPTION_LIMIT = 3` vs `PLAN_LIMITS.free.maxSubscriptions = 5`; `maxSubscriptions`, `maxEmailDiscoveryPerMonth`, `showAds`, `hasAdvancedInsights` read nowhere | `lib/constants.ts:1`, `lib/constants/plan-limits.ts` | Limit-gating cards and banners render inconsistent numbers |
| 12 | `.env.example` omits `NEXT_PUBLIC_BILL_PAYMENT_ENABLED`, `NEXT_PUBLIC_ADSENSE_CLIENT`, `NEXT_PUBLIC_ADSENSE_AD_SLOT` | `.env.example` | The entire Bills section, and therefore half the dock's More sheet, can be feature-flagged off with no documented way to enable it |

---

## 10. Verification matrix

### 10.1 Viewports

| Class | Widths | Target devices |
|---|---|---|
| Compact | 320, 360 | iPhone SE, small Android |
| Standard phone | 375, 390, 393, 414 | iPhone 15/16, Pixel |
| Large phone | 430, 440 | iPhone Pro Max, Pixel XL |
| Tablet portrait | 744, 768, 834 | iPad / iPad Air |
| Tablet landscape | 1024, 1180 | iPad landscape — sidebar boundary |
| Desktop | 1280, 1440, 1920 | Must be visually unchanged |

Per route at every width: no horizontal scroll, no clipped text, no unreachable control, no overlap between content / FAB / dock / toasts.

### 10.2 Environment

- `dvh` behaviour with browser chrome shown and hidden; URL bar expand/collapse.
- `env(safe-area-inset-*)` on a notched device in portrait and landscape.
- On-screen keyboard open on every form and on the AI composer; verify the focused field is not covered and the dock hides.
- Landscape phone (`dvh` is short — confirm every Sheet scrolls and the dock does not consume the viewport).
- 200% browser text zoom; Dynamic Type on iOS.
- `prefers-reduced-motion: reduce`.
- Keyboard-only and screen-reader pass (VoiceOver, TalkBack) for the dock, More sheet, and every Sheet.
- Light/dark: the app is dark-only, but confirm `colorScheme: 'dark'` prevents the OS from auto-inverting form controls.

### 10.3 Feature-flag and role matrix

| Case | Expectation |
|---|---|
| `BILL_PAYMENT_ENABLED=false` | No Bills row in the More sheet; `/bills*` still redirects to `/` |
| `BILL_PAYMENT_ENABLED=true` | Bills row present and expandable |
| `isAdmin=false` | No Admin row; no FAB on `/admin*` |
| `isAdmin=true` | Admin row present |
| `isPlus=false` | "Upgrade Plan" row present in More |
| `isPlus=true` | "Upgrade Plan" row hidden |
| `unreadCount > 0` | Header bell count pill matches the More-sheet badge and the sidebar badge at `lg+` |
| `unreadCount > 99` | Pill clamps to `99+` in both places |
| Unauthenticated | Dock never renders; full-page auth layout unchanged |

### 10.4 Automated

- Extend `components/ui/__tests__/confirm-dialog.test.tsx` for the new `Sheet` behaviour (Escape, focus trap, scroll lock, nested modals).
- Add a `MobileDock` test: 4 slots rendered in order, correct `aria-current`, Renewals present.
- Add a `MoreSheet` test: Inbox pinned row with badge, accordion expansion, role gating, sign-out.
- Optionally add Playwright viewport specs across the 320/390/834/1440 matrix with `toHaveNoHorizontalOverflow` assertions.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| `viewportFit: 'cover'` exposes content under the notch on pages where safe-area padding is missed | Add a global `safe-t` offset in `AppShell` and audit each full-page route |
| A floating dock permanently covers content at the bottom of long lists | `scroll-padding-bottom` on `<main>`, `pb-*` clearance, auto-hide on scroll-down |
| The dock competes with the AI launcher and the FAB for the lower-right region | AI launcher stays in the header; FAB is the only lower-right floating element |
| Settings is a very large page with 6 modals | Phase 5 isolates it; `Sheet` migration is mechanical once `Sheet` exists |
| Migrating 26 modals to `Sheet` risks behavioural drift (focus, scroll lock) | Reference-counted scroll lock, shared focus trap, and port `activity-detail-modal.tsx`'s existing Escape handling as the reference implementation |
| `overflow-x-hidden` currently masks layout bugs | Phase 0 overflow detector, removed once clean |
| Fluid `clamp()` type may shift desktop rendering | Verify against Phase 0 baseline screenshots at 1280/1440/1920; desktop must be pixel-identical |

---

## 12. Definition of done

- [ ] All 25 routes reviewed and signed off at 320, 390, 834, and 1440px.
- [ ] All 72 non-test components either updated or explicitly documented as desktop-only.
- [ ] Dock has exactly 4 slots (Home, Subscriptions, Renewals, More), replaces the hamburger on every width below `lg`, and drawer code is removed.
- [ ] Every interactive element meets 44×44px.
- [ ] Zero horizontal overflow at every tested width.
- [ ] All 26 modals use `Sheet` with working Escape, focus trap, and scroll lock.
- [ ] Safe-area insets respected in portrait and landscape.
- [ ] Reduced-motion honoured for all new animation.
- [ ] All 12 defects in §9 fixed.
- [ ] `npm run lint`, `tsc --noEmit`, and `npm test` pass.
- [ ] Desktop screenshots unchanged from the Phase 0 baseline.

---

## 13. Implementation notes — Phases 1–2 as built

Decisions taken while implementing that differ from, or refine, the plan above.

**`main` is no longer a scroll container.** It was `overflow-y-auto` inside a
non-scrolling flex column, so the page had two competing scroll roots. That
breaks iOS Safari address-bar collapse and pull-to-refresh, and it meant
`position: sticky` table headers would resolve against `main` rather than the
viewport. Scroll is now on the document, which is also what the dock's
`useScrollDirection` assumes. Consequences: the sidebar's `h-screen` became
`h-[100dvh]`, and the sticky table header offsets by `--spacing-header`.

**Dock z-index is `z-40` (FAB `z-35`), not `z-60`.** The 26 un-migrated modals
render at `z-50`, and page-level modals mount *before* the dock in the DOM, so
a `z-60` dock would paint over them. Both values move up once Phase 5 puts
every overlay on `Sheet`. This is tracked in the `MobileDock` comment.

**Slot gating moved from the dock to the More sheet.** Because the slot count is
fixed at four, there is nothing for `BILL_PAYMENT_ENABLED` or `isAdmin` to
gate. The automated test for those flags belongs to `MoreSheet`, not
`MobileDock` — the dock test asserts four slots, `aria-current`, and Renewals.

**Dock label is "Subs", not "Subscriptions".** At 320px a slot is ~76px wide
and holds ~60px of text; "Subscriptions" needs ~85px. All four labels stay
visible at 11px/600 rather than any slot collapsing to an icon.

**Added `?add=true` to `/subscriptions`.** The FAB needs a deep link that opens
the add flow, which did not exist. It uses the same render-phase adjustment as
the existing `?highlight`/`?detail` params.

**Header keeps a brand mark below `lg`.** The hamburger is gone, and the
sidebar that carries the SubHalt wordmark is hidden at those widths, which
would have left the header's left side empty.

**The 44px touch floor is unlayered and scoped to `max-width: 639px`.** This
reverses the note above. In `@layer base` the rule loses to the many components
that already declare `h-7` or `min-h-[34px]`, leaving dozens of sub-44px targets
untouched — 49 such sites at the time of the sweep. Unlayered, it outranks every
Tailwind utility, and because the media query excludes `sm` and up it never
competes with the deliberate compact sizes in `button.tsx` and
`custom-select.tsx`. `min-width` is set next to `min-height` so a `w-9 h-9` icon
button grows on both axes instead of stretching to 36x44. `data-touch="compact"`
remains the escape hatch. Verify with a real device, not just the desktop DOM.

**`vh` → `dvh` everywhere (26 sites).** `max-h-[90vh]` on a modal is larger than
the viewport iOS Safari actually shows once the browser chrome collapses, so the
bottom of the dialog sat under the address bar. Page roots moved to
`min-h-[85dvh]`.

**Page-level `pb-32`/`pb-24` removed.** `main` already reserves dock clearance via
`pb-[calc(var(--spacing-dock)+var(--spacing-safe-b)+5.5rem)]`. The per-page
padding stacked ~128px of dead space on top of it on phones.

**`overflow-x-hidden` → `overflow-x-clip` on page roots.** `hidden` establishes a
scroll container, which is exactly what `main` was removed to avoid: sticky table
headers inside it resolve against that container instead of the viewport. `clip`
contains the overflow without creating a scroll box.

**`/subscriptions` renders cards below `md`, ignoring the saved view mode.** The
table is `min-w-[700px]`, so it is unusable on a phone. The choice is read from a
`matchMedia('(min-width: 768px)')` subscription because it selects *which
component tree* renders, not just styling — CSS cannot do that. The view-mode
toggle is `hidden md:flex` to match.

**`/inbox/[id]` back link given a 44px target.** Inbox has no dock slot, so this is
the only route back to the list on a phone.

**Wide tables got a sticky first column, not card layouts.** `table-scroll` plus
`table-sticky-col` on the identity column (User / Name / Subscription Name) keeps
the row anchored while the remaining columns scroll, at far lower regression risk
than rewriting four tables. The history "restored" table did get a real `md:hidden`
card list because it is small and action-free. Admin card layouts remain open work
in Phase 6.

**`?add=true` is guarded by a `handled` flag, not a previous-value comparison.**
Seeding the comparison with `useState(paramAdd)` means a direct load of the URL
(refresh, or opening the FAB link in a new tab) sees no change and never opens the
modal. Matches the OAuth callback params below it.

**`MobileDock` takes a `moreOpen` prop.** `aria-expanded` was reading the slot's
`active` flag, which only says the current route is a More route — true whether or
not the sheet is showing. `Sheet` gained an optional `id` so the trigger can point
`aria-controls` at the panel.
