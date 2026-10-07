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
  insertCalls: [] as { table: string; payload: Record<string, unknown> }[],
  selectRows: {} as Record<string, Record<string, unknown> | null>,
  updateErrors: {} as Record<string, { message: string } | null>,
  insertErrors: {} as Record<string, { message: string } | null>,
  authError: null as { message: string } | null,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from(table: string) {
      return {
        select: () => {
          const chain = {
            eq: () => chain,
            limit: () => chain,
            maybeSingle: async () => ({ data: mocks.selectRows[table] ?? null, error: null }),
          };
          return chain;
        },
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
        insert: (payload: Record<string, unknown>) => {
          mocks.insertCalls.push({ table, payload });
          const settle = async () => ({ error: mocks.insertErrors[table] ?? null });
          return {
            then(
              onFulfilled: Parameters<Promise<{ error: { message: string } | null }>['then']>[0],
              onRejected: Parameters<Promise<{ error: { message: string } | null }>['then']>[1]
            ) {
              return settle().then(onFulfilled, onRejected);
            },
          };
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
  mocks.insertCalls.length = 0;
  mocks.selectRows = { plan_subscriptions: { user_id: 'user-1', plan: 'plus' } };
  mocks.updateErrors = {};
  mocks.insertErrors = {};
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
    mocks.selectRows.plan_subscriptions = null;

    const granted = await grantPlanSubscription('REF-1', null);

    expect(granted).toBe(false);
    expect(mocks.updateCalls).toHaveLength(0);
    expect(mocks.insertCalls).toHaveLength(0);
  });

  it('lists the purchase in the subscription table, derived from the payment', async () => {
    const granted = await grantPlanSubscription('REF-1', '2026-10-01T10:00:00.000Z');

    expect(granted).toBe(true);

    const listInserts = mocks.insertCalls.filter((call) => call.table === 'subscriptions');
    expect(listInserts).toHaveLength(1);
    expect(listInserts[0].payload).toMatchObject({
      user_id: 'user-1',
      name: 'SubHalt',
      price: 3.99,
      currency: 'USD',
      billing_cycle: 'monthly',
      status: 'active',
      start_date: '2026-10-01',
      next_billing_date: '2026-10-31',
    });
  });

  it('updates an existing subscription entry instead of duplicating it', async () => {
    mocks.selectRows.subscriptions = { id: 'list-row-1' };

    const granted = await grantPlanSubscription('REF-1', '2026-10-01T10:00:00.000Z');

    expect(granted).toBe(true);
    expect(mocks.insertCalls).toHaveLength(0);

    const listUpdates = updatesFor('subscriptions');
    expect(listUpdates).toHaveLength(1);
    expect(listUpdates[0].filters).toContainEqual(['id', 'list-row-1']);
    expect(listUpdates[0].payload).toMatchObject({ next_billing_date: '2026-10-31' });
  });

  it('reports failure when the subscription entry write is rejected', async () => {
    mocks.insertErrors = { subscriptions: { message: 'permission denied' } };

    const granted = await grantPlanSubscription('REF-1', null);

    expect(granted).toBe(false);
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
