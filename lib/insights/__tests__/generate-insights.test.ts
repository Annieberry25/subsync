import { describe, it, expect } from 'vitest';
import {
  buildInsights,
  getTopInsight,
  getPushableInsight,
} from '@/lib/insights/generate-insights';
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
