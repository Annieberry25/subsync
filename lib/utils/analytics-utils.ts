import type { SubscriptionRow } from '@/lib/services/subscription-service';
import { calculateMonthlySpend, getNormalizedMonthlyPrice } from './metrics-utils';
import { DEFAULT_EXCHANGE_RATES } from '@/lib/services/currency-service';

export interface CategoryBreakdown {
  category: string;
  monthlySpend: number;
  percentage: number;
  count: number;
}

export function calculateCategoryBreakdown(
  subscriptions: SubscriptionRow[],
  targetCurrency?: string,
  rates: Record<string, number> = DEFAULT_EXCHANGE_RATES
): CategoryBreakdown[] {
  const activeSubs = subscriptions.filter((sub) => sub.status === 'active' || sub.status === 'trial');
  const totalMonthly = calculateMonthlySpend(subscriptions, targetCurrency, rates);

  const breakdownMap: Record<string, { monthlySpend: number; count: number }> = {};

  activeSubs.forEach((sub) => {
    const normalized = getNormalizedMonthlyPrice(sub, targetCurrency, rates);

    if (!breakdownMap[sub.category]) {
      breakdownMap[sub.category] = { monthlySpend: 0, count: 0 };
    }

    breakdownMap[sub.category].monthlySpend += normalized;
    breakdownMap[sub.category].count += 1;
  });

  return Object.entries(breakdownMap)
    .map(([category, data]) => ({
      category,
      monthlySpend: data.monthlySpend,
      percentage: totalMonthly > 0 ? (data.monthlySpend / totalMonthly) * 100 : 0,
      count: data.count,
    }))
    .sort((a, b) => b.monthlySpend - a.monthlySpend);
}
