export interface PlanLimits {
  maxSubscriptions: number;
  maxBills: number;
  maxReceiptScansPerMonth: number;
  maxEmailDiscoveryPerMonth: number;
  showAds: boolean;
  hasAdvancedInsights: boolean;
}

export const PLAN_LIMITS: Record<'free' | 'plus' | 'pro', PlanLimits> = {
  free: {
    maxSubscriptions: 5,
    maxBills: 10,
    maxReceiptScansPerMonth: 3,
    maxEmailDiscoveryPerMonth: 5,
    showAds: true,
    hasAdvancedInsights: false,
  },
  plus: {
    maxSubscriptions: 50,
    maxBills: 100,
    maxReceiptScansPerMonth: 50,
    maxEmailDiscoveryPerMonth: 100,
    showAds: false,
    hasAdvancedInsights: true,
  },
  pro: {
    maxSubscriptions: Infinity,
    maxBills: Infinity,
    maxReceiptScansPerMonth: Infinity,
    maxEmailDiscoveryPerMonth: Infinity,
    showAds: false,
    hasAdvancedInsights: true,
  },
};

export function getPlanLimits(tier: 'free' | 'plus' | 'pro' | string): PlanLimits {
  const normTier = (tier || 'free').toLowerCase();
  if (normTier === 'plus') return PLAN_LIMITS.plus;
  if (normTier === 'pro' || normTier === 'premium') return PLAN_LIMITS.pro;
  return PLAN_LIMITS.free;
}
