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

/**
 * "Subscribe through Provider" — the add-subscription path that sends the user
 * to a provider's own page to sign up, then confirms the new subscription here.
 *
 * Off until the provider catalogue is worth sending anyone to. It only helps a
 * user who is about to start a brand-new subscription, it depends on a hardcoded
 * provider list that goes stale (a stale entry sends the user to a wrong or dead
 * page and they blame SubHalt), and the two paths that actually answer "what am
 * I already paying for?" — Add Manually and Import Receipt — do not need it.
 *
 * The bills catalogue is the same list, so this stays off until that feature is
 * switched on and the catalogue is being maintained again.
 *
 * To enable: set NEXT_PUBLIC_PROVIDER_SUBSCRIBE_ENABLED=true (requires a
 * rebuild), or flip the default below to true in the codebase.
 */
export const PROVIDER_SUBSCRIBE_ENABLED =
  (process.env.NEXT_PUBLIC_PROVIDER_SUBSCRIBE_ENABLED ?? 'false').toLowerCase() === 'true';