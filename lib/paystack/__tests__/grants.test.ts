import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The grant path used to await nothing and check nothing: a rejected `profiles`
 * or auth write still returned "granted", so plan_subscriptions said `paid`
 * while the account stayed on Free — the exact "payment didn't reflect" symptom.
 */
const mocks = vi.hoisted(() => ({
  updateCalls: [] as {
    table: string;
    payload: Record<string, unknown>;
    filters: [string, unknown][];
  }[],
  selectRow: null as Record<string, unknown> | null,
  updateErrors: {} as Record<string, { message: string } | null>,
  authError: null as { message: string } | null,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from(table: string) {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: mocks.selectRow, error: null }),
          }),
        }),
        update: (payload: Record<string, unknown>) => {
          const record = { table, payload, filters: [] as [string, unknown][] };
          mocks.updateCalls.push(record);
          const settle = async () => ({ error: mocks.updateErrors[table] ?? null });
          const chain: {
            eq: (col: string, val: unknown) => typeof chain;
            in: (col: string, val: unknown) => typeof chain;
            then: Promise<{ error: { message: string } | null }>['then'];
          } = {
            eq: (col, val) => {
              record.filters.push([col, val]);
              return chain;
            },
            in: (col, val) => {
              record.filters.push([col, val]);
              return chain;
            },
            then(onFulfilled, onRejected) {
              return settle().then(onFulfilled, onRejected);
            },
          };
          return chain;
        },
      };
    },
    auth: {
      admin: {
        updateUserById: async () => ({ error: mocks.authError }),
      },
    },
  }),
}));

import {
  grantPlanSubscription,
  markPlanSubscriptionFailed,
} from '@/lib/paystack/grants';

function updatesFor(table: string) {
  return mocks.updateCalls.filter((call) => call.table === table);
}

beforeEach(() => {
  mocks.updateCalls.length = 0;
  mocks.selectRow = { user_id: 'user-1', plan: 'plus' };
  mocks.updateErrors = {};
  mocks.authError = null;
});

describe('grantPlanSubscription', () => {
  it('grants with an expiry keyed to the payment, not to when the grant ran', async () => {
    const granted = await grantPlanSubscription('REF-1', '2026-10-01T10:00:00.000Z');

    expect(granted).toBe(true);

    const subscriptions = updatesFor('plan_subscriptions');
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0].payload).toMatchObject({
      status: 'paid',
      paid_at: '2026-10-01T10:00:00.000Z',
      expires_at: '2026-10-31T10:00:00.000Z',
    });
    expect(subscriptions[0].filters).toContainEqual(['paystack_reference', 'REF-1']);

    const profiles = updatesFor('profiles');
    expect(profiles).toHaveLength(1);
    expect(profiles[0].payload).toMatchObject({
      plan_tier: 'plus',
      plan_expires_at: '2026-10-31T10:00:00.000Z',
    });
  });

  it('reports failure when the profiles write is rejected', async () => {
    mocks.updateErrors = { profiles: { message: 'permission denied' } };

    const granted = await grantPlanSubscription('REF-1', null);

    expect(granted).toBe(false);
  });

  it('reports failure when the subscription write is rejected', async () => {
    mocks.updateErrors = { plan_subscriptions: { message: 'permission denied' } };

    const granted = await grantPlanSubscription('REF-1', null);

    expect(granted).toBe(false);
    // Nothing else may be written once the first update failed.
    expect(updatesFor('profiles')).toHaveLength(0);
  });

  it('reports failure when the auth metadata write is rejected', async () => {
    mocks.authError = { message: 'user not found' };

    const granted = await grantPlanSubscription('REF-1', null);

    expect(granted).toBe(false);
  });

  it('grants nothing for an unknown reference', async () => {
    mocks.selectRow = null;

    const granted = await grantPlanSubscription('REF-1', null);

    expect(granted).toBe(false);
    expect(mocks.updateCalls).toHaveLength(0);
  });
});

describe('markPlanSubscriptionFailed', () => {
  it('only demotes rows that are still pending', async () => {
    await markPlanSubscriptionFailed('REF-1');

    const updates = updatesFor('plan_subscriptions');
    expect(updates).toHaveLength(1);
    expect(updates[0].payload).toEqual({ status: 'failed' });
    expect(updates[0].filters).toContainEqual(['paystack_reference', 'REF-1']);
    expect(updates[0].filters).toContainEqual(['status', 'pending']);
  });
});
