import { describe, it, expect } from 'vitest';
import {
  buildInsights,
  getTopInsight,
  getPushableInsight,
} from '@/lib/insights/generate-insights';
import { isoWeekStart } from '@/app/api/cron/weekly-recap/route';
import type { SubscriptionRow } from '@/lib/services/subscription-service';

function makeSub(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
  return {
    id: 'sub_1',
    user_id: 'user_1',
    name: 'Netflix',
    price: 15.99,
    currency: 'USD',
    billing_cycle: 'monthly',
    category: 'Streaming',
    status: 'active',
    start_date: '2024-06-01',
    end_date: null,
    next_billing_date: '2026-12-01',
    payment_method: 'Credit Card',
    provider_url: null,
    notes: null,
    account_links: null,
    receipts: null,
    is_synced: true,
    created_at: '2024-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
    ...overrides,
  } as SubscriptionRow;
}

describe('insight generation', () => {
  it('returns nothing to say for no subscriptions beyond the getting-started hint', () => {
    const insights = buildInsights([]);
    expect(insights).toHaveLength(1);
    expect(insights[0].id).toBe('no-subscriptions');
  });

  it('detects an exact duplicate by name', () => {
    const insights = buildInsights([
      makeSub({ id: 'a', name: 'Netflix' }),
      makeSub({ id: 'b', name: 'netflix' }),
    ]);
    expect(insights[0].id).toBe('duplicate-services-exact');
    expect(insights[0].category).toBe('actionable');
  });

  it('ranks actionable insights above informational ones', () => {
    const insights = buildInsights([
      makeSub({ id: 'a', name: 'Netflix' }),
      makeSub({ id: 'b', name: 'Netflix' }),
      makeSub({ id: 'c', name: 'Spotify', category: 'Music', billing_cycle: 'yearly' }),
    ]);
    expect(getTopInsight([
      makeSub({ id: 'a', name: 'Netflix' }),
      makeSub({ id: 'b', name: 'Netflix' }),
      makeSub({ id: 'c', name: 'Spotify', category: 'Music', billing_cycle: 'yearly' }),
    ])?.id).toBe('duplicate-services-exact');

    // Sorted, so every actionable entry precedes every informational one.
    const firstInformational = insights.findIndex((i) => i.category === 'informational');
    const lastActionable = insights.map((i) => i.category).lastIndexOf('actionable');
    if (firstInformational !== -1 && lastActionable !== -1) {
      expect(lastActionable).toBeLessThan(firstInformational);
    }
  });

  /**
   * The push is an interruption. Sending "your annual projection" or "everything
   * looks good" teaches people to dismiss notifications unread, which costs the
   * channel for the messages that matter.
   */
  it('only offers an actionable insight for the push', () => {
    const calm = [makeSub({ id: 'a', name: 'Netflix' })];
    // A single healthy subscription yields only neutral/informational candidates.
    expect(getPushableInsight(calm)).toBeNull();

    const duplicated = [makeSub({ id: 'a', name: 'Netflix' }), makeSub({ id: 'b', name: 'Netflix' })];
    expect(getPushableInsight(duplicated)?.id).toBe('duplicate-services-exact');
  });

  it('never pushes the neutral fallback', () => {
    const subs = [makeSub({ id: 'a', name: 'Netflix' })];
    const ids = buildInsights(subs).map((i) => i.id);
    expect(ids).toContain('everything-looks-good');
    expect(ids).not.toContain('no-subscriptions');
  });
});

/**
 * The weekly-recap cron's idempotency window. Asserted here rather than left to the
 * route's own tests because a window that does not reset each Monday would suppress
 * the recap for the remaining days of the week after a single early run — and the
 * route has no other logic worth a suite of its own.
 */
describe('isoWeekStart', () => {
  const weekStart = (iso: string) => isoWeekStart(new Date(`${iso}T12:00:00Z`));

  it('returns the Monday of the week containing a Wednesday', () => {
    expect(weekStart('2026-10-07')).toBe('2026-10-05T00:00:00.000Z');
  });

  it('returns the same day for a Monday', () => {
    expect(weekStart('2026-10-05')).toBe('2026-10-05T00:00:00.000Z');
  });

  it('rolls back to the previous Monday for a Sunday', () => {
    expect(weekStart('2026-10-11')).toBe('2026-10-05T00:00:00.000Z');
  });

  it('gives one Monday per calendar week, so a re-run cannot double-send', () => {
    expect(weekStart('2026-10-06')).toBe(weekStart('2026-10-11'));
  });

  it('advances by exactly seven days between weeks', () => {
    const thisWeek = new Date(weekStart('2026-10-07'));
    const nextWeek = new Date(weekStart('2026-10-14'));
    expect(nextWeek.getTime() - thisWeek.getTime()).toBe(7 * 86400000);
  });
});

describe('isoWeekStart edge cases', () => {
  it('handles a date on a year boundary without crossing into the wrong year', () => {
    // 2027-01-01 is a Friday, so its week starts on 2026-12-28.
    expect(isoWeekStart(new Date('2027-01-01T12:00:00Z'))).toBe('2026-12-28T00:00:00.000Z');
  });

  it('is stable across times of day within the same UTC day', () => {
    expect(isoWeekStart(new Date('2026-10-07T00:00:01Z'))).toBe(
      isoWeekStart(new Date('2026-10-07T23:59:59Z'))
    );
  });
});