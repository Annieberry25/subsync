export interface PlanLimits {
  maxSubscriptions: number;
  maxBills: number;
  maxReceiptScansPerMonth: number;
  maxEmailDiscoveryPerMonth: number;
  /** Account links per single subscription. Free is one, Plus is unlimited. */
  maxAccountLinksPerSubscription: number;
  showAds: boolean;
  hasAdvancedInsights: boolean;
  /** Gmail Connect: OAuth grant, inbox scanning, automatic detection. */
  hasGmailConnect: boolean;
  /** Email Forwarding: the personal auto-import address for receipt forwarding. */
  hasEmailForwarding: boolean;
}

export const PLAN_LIMITS: Record<'free' | 'plus' | 'pro', PlanLimits> = {
  free: {
    // Mirrors FREE_SUBSCRIPTION_LIMIT in lib/constants.ts (which derives from
    // this row), so the enforced and advertised free-tier caps are one value.
    maxSubscriptions: 3,
    maxBills: 10,
    maxReceiptScansPerMonth: 3,
    maxEmailDiscoveryPerMonth: 0,
    // One account per subscription on free; a second is an upgrade prompt.
    maxAccountLinksPerSubscription: 1,
    showAds: true,
    hasAdvancedInsights: false,
    // Both are Plus-only. Free stays on the basic paths: add manually, import a
    // receipt, subscribe through a provider.
    hasGmailConnect: false,
    hasEmailForwarding: false,
  },
  plus: {
    maxSubscriptions: 50,
    maxBills: 100,
    maxReceiptScansPerMonth: 50,
    maxEmailDiscoveryPerMonth: 100,
    maxAccountLinksPerSubscription: Infinity,
    showAds: false,
    hasAdvancedInsights: true,
    hasGmailConnect: true,
    hasEmailForwarding: true,
  },
  pro: {
    maxSubscriptions: Infinity,
    maxBills: Infinity,
    maxReceiptScansPerMonth: Infinity,
    maxEmailDiscoveryPerMonth: Infinity,
    maxAccountLinksPerSubscription: Infinity,
    showAds: false,
    hasAdvancedInsights: true,
    hasGmailConnect: true,
    hasEmailForwarding: true,
  },
};

/** Free caps users at three subscriptions; anything past that is a Plus upgrade. */
export const FREE_SUBSCRIPTION_LIMIT = PLAN_LIMITS.free.maxSubscriptions;

/**
 * Feature keys used to mark a UI affordance as Plus-only. Kept as a union so a
 * typo fails to compile rather than silently rendering no badge.
 */
export type PlusFeature = 'gmail' | 'emailForwarding' | 'advancedInsights';

/**
 * Whether a feature is included in the user's plan. Single source of truth for
 * both the "PLUS" badge on locked affordances and the gate that blocks the
 * action, so a badge can never disagree with the enforcement.
 */
export function hasPlanFeature(
  tier: string,
  feature: PlusFeature,
  isAdmin = false
): boolean {
  const limits = getPlanLimits(tier, isAdmin);
  switch (feature) {
    case 'gmail':
      return limits.hasGmailConnect;
    case 'emailForwarding':
      return limits.hasEmailForwarding;
    case 'advancedInsights':
      return limits.hasAdvancedInsights;
    default:
      return false;
  }
}

/**
 * Admin gets every paid capability, regardless of plan_tier.
 *
 * Deliberately resolved here rather than at each call site. The tier is read in
 * half a dozen places (the write-path cap, the UI gates, the ad banner, the
 * Gmail and forwarding prompts) and threading an `isAdmin` flag through all of
 * them is how one of them gets missed — which is what happened: an admin was
 * capped at three subscriptions while also being the only account able to manage
 * everyone's.
 *
 * An operator account that cannot use the product it operates is not a tier, it
 * is a lockout.
 */
export const ADMIN_EFFECTIVE_TIER = 'pro';

export function getPlanLimits(
  tier: 'free' | 'plus' | 'pro' | string,
  isAdmin = false
): PlanLimits {
  if (isAdmin) return PLAN_LIMITS[ADMIN_EFFECTIVE_TIER];
  const normTier = (tier || 'free').toLowerCase();
  if (normTier === 'plus') return PLAN_LIMITS.plus;
  if (normTier === 'pro' || normTier === 'premium') return PLAN_LIMITS.pro;
  return PLAN_LIMITS.free;
}

/**
 * The tier a caller should enforce against: admin's effective tier, otherwise
 * their stored one. Use this at every enforcement point so admin access cannot
 * be forgotten in one of them.
 */
export function getEffectiveTier(tier: string | null | undefined, isAdmin = false): string {
  return isAdmin ? ADMIN_EFFECTIVE_TIER : tier || 'free';
}

/**
 * True when a user has reached the active-subscription cap for their tier.
 * Paid tiers (maxSubscriptions: Infinity) never cap. Shared by the UI gates
 * and the write-path enforcement so every caller agrees on the same limit.
 */
export function hasReachedSubscriptionCap(opts: {
  tier: string;
  activeCount: number;
  isAdmin?: boolean;
}): boolean {
  const { maxSubscriptions } = getPlanLimits(opts.tier, opts.isAdmin);
  return maxSubscriptions !== Infinity && opts.activeCount >= maxSubscriptions;
}

/**
 * True when a subscription already has as many account links as the tier allows.
 * Free allows one; a second attempt is an upgrade prompt rather than a silent
 * save-time rejection, so the user finds out while they are looking at the
 * control rather than after filling in the form.
 */
export function hasReachedAccountLinkCap(opts: {
  tier: string;
  linkCount: number;
  isAdmin?: boolean;
}): boolean {
  const { maxAccountLinksPerSubscription } = getPlanLimits(opts.tier, opts.isAdmin);
  return (
    maxAccountLinksPerSubscription !== Infinity &&
    opts.linkCount >= maxAccountLinksPerSubscription
  );
}
