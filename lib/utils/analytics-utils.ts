import type { SubscriptionRow } from '@/lib/services/subscription-service';
import { calculateMonthlySpend } from './metrics-utils';

export interface CategoryBreakdown {
  category: string;
  monthlySpend: number;
  percentage: number;
  count: number;
}

export function calculateCategoryBreakdown(subscriptions: SubscriptionRow[]): CategoryBreakdown[] {
  const activeSubs = subscriptions.filter((sub) => sub.status === 'active' || sub.status === 'trial');
  const totalMonthly = calculateMonthlySpend(subscriptions);

  const breakdownMap: Record<string, { monthlySpend: number; count: number }> = {};

  activeSubs.forEach((sub) => {
    const price = Number(sub.price) || 0;
    let normalized = price;

    switch (sub.billing_cycle) {
      case 'weekly':
        normalized = (price * 52) / 12;
        break;
      case 'quarterly':
        normalized = price / 3;
        break;
      case 'yearly':
        normalized = price / 12;
        break;
      case 'monthly':
      case 'custom':
      default:
        normalized = price;
        break;
    }

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
