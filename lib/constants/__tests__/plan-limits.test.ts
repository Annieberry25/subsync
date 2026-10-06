import {
  getPlanLimits,
  hasReachedSubscriptionCap,
  hasReachedAccountLinkCap,
  hasPlanFeature,
  getEffectiveTier,
  ADMIN_EFFECTIVE_TIER,
  FREE_SUBSCRIPTION_LIMIT,
  PLAN_LIMITS,
} from '@/lib/constants/plan-limits';

describe('plan limit aliasing (FREE_SUBSCRIPTION_LIMIT parity)', () => {
  it('keeps the free active-subscription cap at 3', () => {
    expect(PLAN_LIMITS.free.maxSubscriptions).toBe(3);
  });

  it('caps free tier at its own limit value', () => {
    expect(hasReachedSubscriptionCap({ tier: 'free', activeCount: 2 })).toBe(false);
    expect(hasReachedSubscriptionCap({ tier: 'free', activeCount: 3 })).toBe(true);
    expect(hasReachedSubscriptionCap({ tier: 'free', activeCount: 40 })).toBe(true);
  });

  it('caps Plus at its own 50 limit, Project/premium unlimited', () => {
    expect(hasReachedSubscriptionCap({ tier: 'plus', activeCount: 49 })).toBe(false);
    expect(hasReachedSubscriptionCap({ tier: 'plus', activeCount: 50 })).toBe(true);
    expect(hasReachedSubscriptionCap({ tier: 'plus', activeCount: 10_000 })).toBe(true);
    expect(hasReachedSubscriptionCap({ tier: 'pro', activeCount: 10_000 })).toBe(false);
    expect(hasReachedSubscriptionCap({ tier: 'premium', activeCount: 10_000 })).toBe(false);
  });

  it('treats unknown or empty tiers as free', () => {
    expect(hasReachedSubscriptionCap({ tier: '', activeCount: 3 })).toBe(true);
    expect(hasReachedSubscriptionCap({ tier: 'banana', activeCount: 0 })).toBe(false);
  });

  it('exports the free cap through getPlanLimits too', () => {
    expect(getPlanLimits('free').maxSubscriptions).toBe(
      hasReachedSubscriptionCap({ tier: 'free', activeCount: 3 }) ? 3 : 3
    );
    expect(getPlanLimits('plus').hasAdvancedInsights).toBe(true);
  });
});

describe('hasPlanFeature', () => {
  it('gates Gmail Connect and Email Forwarding to Plus', () => {
    expect(hasPlanFeature('free', 'gmail')).toBe(false);
    expect(hasPlanFeature('free', 'emailForwarding')).toBe(false);

    expect(hasPlanFeature('plus', 'gmail')).toBe(true);
    expect(hasPlanFeature('plus', 'emailForwarding')).toBe(true);

    expect(hasPlanFeature('pro', 'gmail')).toBe(true);
    expect(hasPlanFeature('premium', 'emailForwarding')).toBe(true);
  });

  it('keeps advanced insights Plus-only', () => {
    expect(hasPlanFeature('free', 'advancedInsights')).toBe(false);
    expect(hasPlanFeature('plus', 'advancedInsights')).toBe(true);
  });

  it('treats an unknown tier as free so nothing unlocks by accident', () => {
    expect(hasPlanFeature('', 'gmail')).toBe(false);
    expect(hasPlanFeature('banana', 'emailForwarding')).toBe(false);
  });

  it('gives free no email discovery allowance', () => {
    expect(getPlanLimits('free').maxEmailDiscoveryPerMonth).toBe(0);
    expect(getPlanLimits('plus').maxEmailDiscoveryPerMonth).toBeGreaterThan(0);
  });

  it('exposes the free cap as a named constant of three', () => {
    expect(FREE_SUBSCRIPTION_LIMIT).toBe(3);
    expect(FREE_SUBSCRIPTION_LIMIT).toBe(PLAN_LIMITS.free.maxSubscriptions);
  });
});

describe('hasReachedAccountLinkCap', () => {
  it('allows one account per subscription on free and stops the second', () => {
    expect(hasReachedAccountLinkCap({ tier: 'free', linkCount: 0 })).toBe(false);
    expect(hasReachedAccountLinkCap({ tier: 'free', linkCount: 1 })).toBe(true);
    expect(hasReachedAccountLinkCap({ tier: 'free', linkCount: 5 })).toBe(true);
  });

  it('never caps Plus or Pro, who can hold several accounts', () => {
    expect(hasReachedAccountLinkCap({ tier: 'plus', linkCount: 1 })).toBe(false);
    expect(hasReachedAccountLinkCap({ tier: 'plus', linkCount: 50 })).toBe(false);
    expect(hasReachedAccountLinkCap({ tier: 'pro', linkCount: 1_000 })).toBe(false);
  });

  it('treats an unknown tier as free so nobody gets extra accounts by accident', () => {
    expect(hasReachedAccountLinkCap({ tier: '', linkCount: 1 })).toBe(true);
    expect(hasReachedAccountLinkCap({ tier: 'banana', linkCount: 1 })).toBe(true);
  });
});

describe('admin access', () => {
  it('resolves an admin to the unlimited tier regardless of stored tier', () => {
    expect(getEffectiveTier('free', true)).toBe(ADMIN_EFFECTIVE_TIER);
    expect(getEffectiveTier('plus', true)).toBe(ADMIN_EFFECTIVE_TIER);
    expect(getEffectiveTier(null, true)).toBe(ADMIN_EFFECTIVE_TIER);
  });

  it('leaves a non-admin tier untouched', () => {
    expect(getEffectiveTier('free', false)).toBe('free');
    expect(getEffectiveTier('plus', false)).toBe('plus');
    expect(getEffectiveTier(undefined, false)).toBe('free');
  });

  it('does not cap an admin subscription count even far past the free limit', () => {
    // The regression this guards: the operator account was capped at three
    // subscriptions while being the only account able to manage everyone's.
    expect(hasReachedSubscriptionCap({ tier: 'free', activeCount: 3, isAdmin: true })).toBe(false);
    expect(hasReachedSubscriptionCap({ tier: 'free', activeCount: 40, isAdmin: true })).toBe(false);
    // Without the flag the same count is still capped.
    expect(hasReachedSubscriptionCap({ tier: 'free', activeCount: 3 })).toBe(true);
  });

  it('does not cap an admin account links per subscription', () => {
    expect(hasReachedAccountLinkCap({ tier: 'free', linkCount: 1, isAdmin: true })).toBe(false);
    expect(hasReachedAccountLinkCap({ tier: 'free', linkCount: 9, isAdmin: true })).toBe(false);
    expect(hasReachedAccountLinkCap({ tier: 'free', linkCount: 1 })).toBe(true);
  });

  it('unlocks every Plus-only feature for an admin on the free tier', () => {
    expect(hasPlanFeature('free', 'gmail', true)).toBe(true);
    expect(hasPlanFeature('free', 'emailForwarding', true)).toBe(true);
    expect(hasPlanFeature('free', 'advancedInsights', true)).toBe(true);
    // Same feature on the same stored tier without the flag stays locked.
    expect(hasPlanFeature('free', 'gmail')).toBe(false);
  });

  it('drops ads for an admin, since ads are a paid-tier perk', () => {
    expect(getPlanLimits('free', true).showAds).toBe(false);
    expect(getPlanLimits('free', true).maxBills).toBe(Infinity);
  });
});