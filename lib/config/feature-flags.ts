/**
 * Feature flags for SubHalt.
 *
 * A plain flag (PROVIDER_SUBSCRIBE_ENABLED) is either shipped or not, for
 * everyone. A feature defined in FEATURE_FLAGS can additionally be admin-only
 * while it is being tried out on a real account: it is hidden from everyone
 * else, and the API routes enforce the same rule so hiding the button is not
 * the only guard.
 */

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

/**
 * Features that are built but not released to every account yet.
 *
 * A flag can be `enabled` (shipped at all) and `adminOnly` (only accounts with
 * profiles.is_admin see and can use it). Admin-only is how a feature is tried
 * out on a real account before it is announced: it is hidden from everyone
 * else, and the API routes enforce the same rule so hiding the button is not
 * the only guard.
 *
 * Releasing a feature needs no component change:
 *   - NEXT_PUBLIC_BILL_PAYMENT_ADMIN_ONLY=false
 *   - NEXT_PUBLIC_GMAIL_CONNECT_ADMIN_ONLY=false
 *   - NEXT_PUBLIC_EMAIL_FORWARDING_ADMIN_ONLY=false
 * (or flip the default below), then rebuild.
 */
export type FeatureKey = 'billsPayments' | 'gmailConnect' | 'emailForwarding';

export interface FeatureDefinition {
  enabled: boolean;
  adminOnly: boolean;
}

export const FEATURE_FLAGS: Record<FeatureKey, FeatureDefinition> = {
  /* Bills & Payments is still in development: on, but only for admins.
     Set NEXT_PUBLIC_BILL_PAYMENT_ENABLED=false to hide it from admins too. */
  billsPayments: {
    enabled: (process.env.NEXT_PUBLIC_BILL_PAYMENT_ENABLED ?? 'true').toLowerCase() === 'true',
    adminOnly:
      (process.env.NEXT_PUBLIC_BILL_PAYMENT_ADMIN_ONLY ?? 'true').toLowerCase() === 'true',
  },
  gmailConnect: {
    enabled: (process.env.NEXT_PUBLIC_GMAIL_CONNECT_ENABLED ?? 'true').toLowerCase() === 'true',
    adminOnly:
      (process.env.NEXT_PUBLIC_GMAIL_CONNECT_ADMIN_ONLY ?? 'true').toLowerCase() === 'true',
  },
  emailForwarding: {
    enabled:
      (process.env.NEXT_PUBLIC_EMAIL_FORWARDING_ENABLED ?? 'true').toLowerCase() === 'true',
    adminOnly:
      (process.env.NEXT_PUBLIC_EMAIL_FORWARDING_ADMIN_ONLY ?? 'true').toLowerCase() === 'true',
  },
};

/** Whether `isAdmin` may use the feature, given how its flag is configured. */
export function isFeatureAvailable(key: FeatureKey, isAdmin: boolean): boolean {
  const feature = FEATURE_FLAGS[key];
  if (!feature.enabled) return false;
  return isAdmin || !feature.adminOnly;
}