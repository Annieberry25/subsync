import type { SubscriptionRow } from '@/lib/services/subscription-service';
import { convertAmount, formatCurrencyAmount, DEFAULT_EXCHANGE_RATES } from '@/lib/services/currency-service';

export function getNormalizedMonthlyPrice(
  sub: SubscriptionRow,
  targetCurrency?: string,
  rates: Record<string, number> = DEFAULT_EXCHANGE_RATES
): number {
  const price = Number(sub.price) || 0;
  let normalizedMonthly = price;

  switch (sub.billing_cycle) {
    case 'weekly':
      normalizedMonthly = (price * 52) / 12;
      break;
    case 'quarterly':
      normalizedMonthly = price / 3;
      break;
    case 'yearly':
      normalizedMonthly = price / 12;
      break;
    case 'monthly':
    case 'custom':
    default:
      normalizedMonthly = price;
      break;
  }

  if (targetCurrency) {
    return convertAmount(normalizedMonthly, sub.currency || 'USD', targetCurrency, rates);
  }

  return normalizedMonthly;
}

export function calculateMonthlySpend(
  subscriptions: SubscriptionRow[],
  targetCurrency?: string,
  rates: Record<string, number> = DEFAULT_EXCHANGE_RATES
): number {
  return subscriptions
    .filter((sub) => sub.status === 'active' || sub.status === 'trial')
    .reduce((total, sub) => total + getNormalizedMonthlyPrice(sub, targetCurrency, rates), 0);
}

export function calculateAnnualSpend(
  subscriptions: SubscriptionRow[],
  targetCurrency?: string,
  rates: Record<string, number> = DEFAULT_EXCHANGE_RATES
): number {
  return calculateMonthlySpend(subscriptions, targetCurrency, rates) * 12;
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

export function calculatePotentialSavings(
  subscriptions: SubscriptionRow[],
  targetCurrency?: string,
  rates: Record<string, number> = DEFAULT_EXCHANGE_RATES
): number {
  return subscriptions
    .filter((sub) => sub.status === 'paused' || sub.status === 'trial')
    .reduce((total, sub) => total + getNormalizedMonthlyPrice(sub, targetCurrency, rates), 0);
}

export function getMostExpensiveSubscription(
  subscriptions: SubscriptionRow[],
  targetCurrency?: string,
  rates: Record<string, number> = DEFAULT_EXCHANGE_RATES
): SubscriptionRow | null {
  const activeSubs = subscriptions.filter((sub) => sub.status === 'active' || sub.status === 'trial');
  if (activeSubs.length === 0) return null;
  return activeSubs.reduce((max, sub) => {
    return getNormalizedMonthlyPrice(sub, targetCurrency, rates) > getNormalizedMonthlyPrice(max, targetCurrency, rates)
      ? sub
      : max;
  }, activeSubs[0]);
}

export function getMostExpensiveSubscriptions(
  subscriptions: SubscriptionRow[],
  targetCurrency?: string,
  rates: Record<string, number> = DEFAULT_EXCHANGE_RATES
): SubscriptionRow[] {
  const activeSubs = subscriptions.filter((sub) => sub.status === 'active' || sub.status === 'trial');
  if (activeSubs.length === 0) return [];

  let maxPrice = -1;
  activeSubs.forEach((sub) => {
    const price = getNormalizedMonthlyPrice(sub, targetCurrency, rates);
    if (price > maxPrice) {
      maxPrice = price;
    }
  });

  if (maxPrice <= 0) return [];

  return activeSubs.filter(
    (sub) => Math.abs(getNormalizedMonthlyPrice(sub, targetCurrency, rates) - maxPrice) < 0.001
  );
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return formatCurrencyAmount(amount, currency);
}
