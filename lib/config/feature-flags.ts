/**
 * Feature flags for SubHalt.
 *
 * Bills & Payments is gated behind BILL_PAYMENT_ENABLED while it is in
 * active development. When disabled, the feature is hidden from the app:
 *   - "Bills & Payments" nav item (and submenu) in the sidebar
 *   - /bills, /bills/pay, /bills/history routes (redirect to "/")
 *   - /bills entry in the sitemap
 *
 * To enable: set NEXT_PUBLIC_BILL_PAYMENT_ENABLED=true (requires a rebuild),
 * or flip the default below to true in the codebase.
 */
export const BILL_PAYMENT_ENABLED =
  (process.env.NEXT_PUBLIC_BILL_PAYMENT_ENABLED ?? 'false').toLowerCase() === 'true';