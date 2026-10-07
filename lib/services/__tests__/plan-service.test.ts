import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchSubscriptions: vi.fn(),
  createSubscription: vi.fn(),
  recordActivity: vi.fn(),
}));

vi.mock('@/lib/services/subscription-service', () => ({
  fetchSubscriptions: (...args: unknown[]) => mocks.fetchSubscriptions(...args),
  createSubscription: (...args: unknown[]) => mocks.createSubscription(...args),
}));

vi.mock('@/lib/services/activity-service', () => ({
  recordActivity: (...args: unknown[]) => mocks.recordActivity(...args),
}));

import { syncPlusPurchaseRecord } from '@/lib/services/plan-service';

const addInboxItem = vi.fn();

beforeEach(() => {
  mocks.fetchSubscriptions.mockReset();
  mocks.createSubscription.mockReset();
  mocks.recordActivity.mockReset();
  addInboxItem.mockReset();

  mocks.fetchSubscriptions.mockResolvedValue({ data: [], error: null });
  mocks.createSubscription.mockResolvedValue({ data: { id: 'row-1' }, error: null, synced: true });
  mocks.recordActivity.mockResolvedValue(undefined);
});

describe('syncPlusPurchaseRecord', () => {
  it('creates the subscription entry with the real plan expiry, not a +30d guess', async () => {
    await syncPlusPurchaseRecord({
      addInboxItem,
      planExpiresAt: '2026-11-06T12:26:41.000Z',
    });

    expect(mocks.createSubscription).toHaveBeenCalledTimes(1);
    const payload = mocks.createSubscription.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      name: 'SubHalt',
      price: 3.99,
      currency: 'USD',
      billing_cycle: 'monthly',
      category: 'Software',
      status: 'active',
      next_billing_date: '2026-11-06',
    });
    expect(payload.start_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('falls back to the plan duration when no expiry is known', async () => {
    await syncPlusPurchaseRecord({ addInboxItem });

    const payload = mocks.createSubscription.mock.calls[0][0] as Record<string, unknown>;
    const start = new Date(String(payload.start_date));
    const next = new Date(String(payload.next_billing_date));
    const diffDays = Math.round((next.getTime() - start.getTime()) / 86_400_000);
    expect(diffDays).toBe(30);
  });

  it('does not duplicate the entry when the server already listed the purchase', async () => {
    mocks.fetchSubscriptions.mockResolvedValue({
      data: [{ id: 'server-row', name: 'subhalt' }],
      error: null,
    });

    await syncPlusPurchaseRecord({ addInboxItem });

    expect(mocks.createSubscription).not.toHaveBeenCalled();
    expect(mocks.recordActivity).toHaveBeenCalledTimes(1);
    expect(addInboxItem).toHaveBeenCalledTimes(1);
  });

  it('surfaces a rejected entry write so the caller can warn', async () => {
    mocks.createSubscription.mockResolvedValue({
      data: null,
      error: new Error('Upgrade to Plus to track more than 5 subscriptions.'),
      synced: false,
    });

    await expect(syncPlusPurchaseRecord({ addInboxItem })).rejects.toThrow(
      'Upgrade to Plus'
    );
    expect(addInboxItem).not.toHaveBeenCalled();
  });
});
