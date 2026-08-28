import { describe, it, expect } from 'vitest';
import type { SubscriptionRow } from '@/lib/services/subscription-service';
import {
  getNormalizedMonthlyPrice,
  calculateMonthlySpend,
  calculateAnnualSpend,
  getActiveCount,
  getUpcomingRenewalsCount,
  calculatePotentialSavings,
  getMostExpensiveSubscription,
  getMostExpensiveSubscriptions,
  formatCurrency,
} from '@/lib/utils/metrics-utils';

function makeSub(
  overrides: Partial<SubscriptionRow> & { price: number; billing_cycle: SubscriptionRow['billing_cycle'] }
): SubscriptionRow {
  return {
    id: 'sub_1',
    user_id: 'user_1',
    name: 'Test',
    price: overrides.price,
    currency: 'USD',
    billing_cycle: overrides.billing_cycle,
    status: 'active',
    next_billing_date: new Date().toISOString().split('T')[0],
    start_date: new Date().toISOString().split('T')[0],
    end_date: null,
    category: 'Software',
    custom_category: null,
    is_recurring: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    account_links: null,
    archived_at: null,
    deleted_at: null,
    notes: null,
    ...overrides,
  };
}

describe('getNormalizedMonthlyPrice', () => {
  it('returns the price for monthly billing', () => {
    const sub = makeSub({ price: 10, billing_cycle: 'monthly' });
    expect(getNormalizedMonthlyPrice(sub)).toBe(10);
  });

  it('divides yearly price by 12', () => {
    const sub = makeSub({ price: 120, billing_cycle: 'yearly' });
    expect(getNormalizedMonthlyPrice(sub)).toBe(10);
  });

  it('divides quarterly price by 3', () => {
    const sub = makeSub({ price: 30, billing_cycle: 'quarterly' });
    expect(getNormalizedMonthlyPrice(sub)).toBe(10);
  });

  it('multiplies weekly price to a monthly equivalent', () => {
    const sub = makeSub({ price: 3, billing_cycle: 'weekly' });
    expect(getNormalizedMonthlyPrice(sub)).toBe((3 * 52) / 12);
  });
});

describe('calculateMonthlySpend', () => {
  it('sums normalized prices of active and trial subscriptions only', () => {
    const subs = [
      makeSub({ id: 'a', price: 10, billing_cycle: 'monthly', status: 'active' }),
      makeSub({ id: 'b', price: 120, billing_cycle: 'yearly', status: 'trial' }),
      makeSub({ id: 'c', price: 500, billing_cycle: 'monthly', status: 'paused' }),
      makeSub({ id: 'd', price: 500, billing_cycle: 'monthly', status: 'canceled' }),
    ];
    expect(calculateMonthlySpend(subs)).toBe(20);
  });
});

describe('calculateAnnualSpend', () => {
  it('returns 12x the monthly spend', () => {
    const subs = [makeSub({ price: 10, billing_cycle: 'monthly', status: 'active' })];
    expect(calculateAnnualSpend(subs)).toBe(120);
  });
});

describe('getActiveCount', () => {
  it('counts active and trial subscriptions', () => {
    const subs = [
      makeSub({ status: 'active' }),
      makeSub({ status: 'trial' }),
      makeSub({ status: 'paused' }),
    ];
    expect(getActiveCount(subs)).toBe(2);
  });
});

describe('getUpcomingRenewalsCount', () => {
  it('counts non-canceled subscriptions renewing within the window', () => {
    const today = new Date();
    const in5Days = new Date(today);
    in5Days.setDate(today.getDate() + 5);
    const in90Days = new Date(today);
    in90Days.setDate(today.getDate() + 90);

    const subs = [
      makeSub({ status: 'active', next_billing_date: in5Days.toISOString().split('T')[0] }),
      makeSub({ status: 'canceled', next_billing_date: in5Days.toISOString().split('T')[0] }),
      makeSub({ status: 'active', next_billing_date: in90Days.toISOString().split('T')[0] }),
    ];
    expect(getUpcomingRenewalsCount(subs, 30)).toBe(1);
  });
});

describe('calculatePotentialSavings', () => {
  it('sums normalized prices of paused and trial subscriptions', () => {
    const subs = [
      makeSub({ price: 20, billing_cycle: 'monthly', status: 'paused' }),
      makeSub({ price: 30, billing_cycle: 'monthly', status: 'trial' }),
      makeSub({ price: 9000, billing_cycle: 'monthly', status: 'active' }),
    ];
    expect(calculatePotentialSavings(subs)).toBe(50);
  });
});

describe('getMostExpensiveSubscription', () => {
  it('returns the highest normalized-priced active subscription', () => {
    const subs = [
      makeSub({ id: 'a', price: 10, billing_cycle: 'monthly', status: 'active' }),
      makeSub({ id: 'b', price: 200, billing_cycle: 'yearly', status: 'active' }),
      makeSub({ id: 'c', price: 9999, billing_cycle: 'monthly', status: 'paused' }),
    ];
    const result = getMostExpensiveSubscription(subs);
    expect(result?.id).toBe('b');
  });

  it('returns null when there are no active subscriptions', () => {
    expect(getMostExpensiveSubscription([])).toBeNull();
  });
});

describe('getMostExpensiveSubscriptions', () => {
  it('returns all subscriptions tied at the max normalized price', () => {
    const subs = [
      makeSub({ id: 'a', price: 120, billing_cycle: 'yearly', status: 'active' }),
      makeSub({ id: 'b', price: 5, billing_cycle: 'monthly', status: 'active' }),
      makeSub({ id: 'c', price: 120, billing_cycle: 'yearly', status: 'active' }),
    ];
    const ids = getMostExpensiveSubscriptions(subs).map((s) => s.id).sort();
    expect(ids).toEqual(['a', 'c']);
  });
});

describe('formatCurrency', () => {
  it('formats USD amounts', () => {
    expect(formatCurrency(12.5, 'USD')).toBe('$12.50');
  });

  it('formats NGN with the naira symbol', () => {
    expect(formatCurrency(1500, 'NGN')).toBe('₦1,500.00');
  });
});
