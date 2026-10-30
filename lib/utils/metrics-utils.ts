import type { AccountLink, SubscriptionRow } from '@/lib/services/subscription-service';
import { filterActiveSubscriptions, isOverdueSubscription, parseAccountLinks } from '@/lib/services/subscription-service';
import { convertAmount, formatCurrencyAmount, DEFAULT_EXCHANGE_RATES } from '@/lib/services/currency-service';
import { resolveRenewalDate } from '@/lib/utils/billing-dates';

export function getNormalizedMonthlyPrice(
  sub: SubscriptionRow,
  targetCurrency?: string,
  rates: Record<string, number> = DEFAULT_EXCHANGE_RATES
): number {
  return normalizedAccountPrice(null, sub, targetCurrency, rates);
}

/** Normalized monthly price for one account link, falling back to the subscription's own values. */
function normalizedAccountPrice(
  link: AccountLink | null,
  sub: SubscriptionRow,
  targetCurrency?: string,
  rates: Record<string, number> = DEFAULT_EXCHANGE_RATES
): number {
  const price = link?.price != null ? Number(link.price) : Number(sub.price) || 0;
  const cycle = (link?.billing_cycle || sub.billing_cycle || 'monthly').trim().toLowerCase();
  const currency = link?.currency || sub.currency || 'USD';

  let normalizedMonthly = price;
  switch (cycle) {
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
    return convertAmount(normalizedMonthly, currency, targetCurrency, rates);
  }

  return normalizedMonthly;
}

/** Whether a subscription is active: live history state, active/trial status, and not overdue. */
function isActiveSubscription(sub: SubscriptionRow): boolean {
  return (sub.status === 'active' || sub.status === 'trial') && !isOverdueSubscription(sub);
}

/** How many active accounts a single subscription row represents. A row with no account links counts as one. */
export function countActiveAccounts(sub: SubscriptionRow): number {
  const links = parseAccountLinks(sub);
  return links.length > 0 ? links.length : 1;
}

export function calculateMonthlySpend(
  subscriptions: SubscriptionRow[],
  targetCurrency?: string,
  rates: Record<string, number> = DEFAULT_EXCHANGE_RATES
): number {
  return filterActiveSubscriptions(subscriptions)
    .filter(isActiveSubscription)
    .reduce((total, sub) => {
      const links = parseAccountLinks(sub);
      if (links.length > 0) {
        return total + links.reduce((linkTotal, link) => linkTotal + normalizedAccountPrice(link, sub, targetCurrency, rates), 0);
      }
      return total + normalizedAccountPrice(null, sub, targetCurrency, rates);
    }, 0);
}

export function calculateAnnualSpend(
  subscriptions: SubscriptionRow[],
  targetCurrency?: string,
  rates: Record<string, number> = DEFAULT_EXCHANGE_RATES
): number {
  return calculateMonthlySpend(subscriptions, targetCurrency, rates) * 12;
}

export function getActiveCount(subscriptions: SubscriptionRow[]): number {
  return filterActiveSubscriptions(subscriptions)
    .filter(isActiveSubscription)
    .reduce((total, sub) => total + countActiveAccounts(sub), 0);
}

export function getUpcomingRenewalsCount(subscriptions: SubscriptionRow[], days = 30): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const futureDate = new Date();
  futureDate.setDate(now.getDate() + days);
  futureDate.setHours(23, 59, 59, 999);

  return subscriptions.filter((sub) => {
    if (sub.status === 'canceled') return false;
    // The automatic date — a cycle after the start — matching what the detail
    // sheet and the widgets themselves answer from, not the stored field.
    const nextBilling = new Date(resolveRenewalDate(sub));
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
  const activeSubs = filterActiveSubscriptions(subscriptions)
    .filter(isActiveSubscription);
  if (activeSubs.length === 0) return null;
  return activeSubs.reduce((max, sub) => {
    return maxAccountPrice(sub, targetCurrency, rates) > maxAccountPrice(max, targetCurrency, rates)
      ? sub
      : max;
  }, activeSubs[0]);
}

/** The highest normalized monthly price among a subscription's accounts (or the row itself if link-less). */
function maxAccountPrice(
  sub: SubscriptionRow,
  targetCurrency?: string,
  rates: Record<string, number> = DEFAULT_EXCHANGE_RATES
): number {
  const links = parseAccountLinks(sub);
  if (links.length > 0) {
    return Math.max(...links.map((link) => normalizedAccountPrice(link, sub, targetCurrency, rates)));
  }
  return normalizedAccountPrice(null, sub, targetCurrency, rates);
}

export function getMostExpensiveSubscriptions(
  subscriptions: SubscriptionRow[],
  targetCurrency?: string,
  rates: Record<string, number> = DEFAULT_EXCHANGE_RATES
): SubscriptionRow[] {
  const activeSubs = filterActiveSubscriptions(subscriptions)
    .filter(isActiveSubscription);
  if (activeSubs.length === 0) return [];

  let maxPrice = -1;
  activeSubs.forEach((sub) => {
    const price = maxAccountPrice(sub, targetCurrency, rates);
    if (price > maxPrice) {
      maxPrice = price;
    }
  });

  if (maxPrice <= 0) return [];

  return activeSubs.filter(
    (sub) => Math.abs(maxAccountPrice(sub, targetCurrency, rates) - maxPrice) < 0.001
  );
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return formatCurrencyAmount(amount, currency);
}
