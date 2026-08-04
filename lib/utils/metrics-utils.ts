import type { SubscriptionRow } from '@/lib/services/subscription-service';

export function calculateMonthlySpend(subscriptions: SubscriptionRow[]): number {
  return subscriptions
    .filter((sub) => sub.status === 'active' || sub.status === 'trial')
    .reduce((total, sub) => {
      const price = Number(sub.price) || 0;
      switch (sub.billing_cycle) {
        case 'weekly':
          return total + (price * 52) / 12;
        case 'quarterly':
          return total + price / 3;
        case 'yearly':
          return total + price / 12;
        case 'monthly':
        case 'custom':
        default:
          return total + price;
      }
    }, 0);
}

export function calculateAnnualSpend(subscriptions: SubscriptionRow[]): number {
  return calculateMonthlySpend(subscriptions) * 12;
}

export function getActiveCount(subscriptions: SubscriptionRow[]): number {
  return subscriptions.filter((sub) => sub.status === 'active' || sub.status === 'trial').length;
}

export function getUpcomingRenewalsCount(subscriptions: SubscriptionRow[], days = 30): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const futureDate = new Date();
  futureDate.setDate(now.getDate() + days);
  futureDate.setHours(23, 59, 59, 999);

  return subscriptions.filter((sub) => {
    if (sub.status === 'canceled') return false;
    const nextBilling = new Date(sub.next_billing_date);
    return nextBilling >= now && nextBilling <= futureDate;
  }).length;
}

export function getNormalizedMonthlyPrice(sub: SubscriptionRow): number {
  const price = Number(sub.price) || 0;
  switch (sub.billing_cycle) {
    case 'weekly':
      return (price * 52) / 12;
    case 'quarterly':
      return price / 3;
    case 'yearly':
      return price / 12;
    case 'monthly':
    case 'custom':
    default:
      return price;
  }
}

export function calculatePotentialSavings(subscriptions: SubscriptionRow[]): number {
  return subscriptions
    .filter((sub) => sub.status === 'paused' || sub.status === 'trial')
    .reduce((total, sub) => total + getNormalizedMonthlyPrice(sub), 0);
}

export function getMostExpensiveSubscription(subscriptions: SubscriptionRow[]): SubscriptionRow | null {
  const activeSubs = subscriptions.filter((sub) => sub.status === 'active' || sub.status === 'trial');
  if (activeSubs.length === 0) return null;
  return activeSubs.reduce((max, sub) => {
    return getNormalizedMonthlyPrice(sub) > getNormalizedMonthlyPrice(max) ? sub : max;
  }, activeSubs[0]);
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

