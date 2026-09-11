import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  updateSubscription,
  fetchSubscriptions,
  archiveSubscription,
  deleteSubscription,
  type SubscriptionRow,
} from '@/lib/services/subscription-service';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://placeholder.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';

const mocks = vi.hoisted(() => {
  let queue: unknown[] = [];

  const chain = {
    then: (resolve: (value: unknown) => void, reject: (reason?: unknown) => void) => {
      const next = queue.shift();
      if (next === undefined) {
        resolve({ data: null, error: null });
      } else if (next instanceof Error) {
        reject(next);
      } else {
        resolve(next);
      }
    },
    eq: vi.fn(function (...args: unknown[]) {
      void args;
      return chain;
    }),
    order: vi.fn(function (...args: unknown[]) {
      void args;
      return chain;
    }),
    single: vi.fn(function (...args: unknown[]) {
      void args;
      return chain;
    }),
    select: vi.fn(function (...args: unknown[]) {
      void args;
      return chain;
    }),
    insert: vi.fn(function (...args: unknown[]) {
      void args;
      return chain;
    }),
    update: vi.fn(function (...args: unknown[]) {
      void args;
      return chain;
    }),
    delete: vi.fn(function (...args: unknown[]) {
      void args;
      return chain;
    }),
  };

  const client = {
    from: vi.fn(function (table: unknown) {
      void table;
      return chain;
    }),
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user_1' } } })),
    },
  };

  return {
    chain,
    client,
    setResult(value: unknown) {
      queue = [value];
    },
    setResults(values: unknown[]) {
      queue = [...values];
    },
  };
});

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mocks.client,
}));

function makeSubRow(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
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
    next_billing_date: '2026-09-01',
    payment_method: 'Credit Card',
    provider_url: 'https://www.netflix.com',
    notes: null,
    account_links: null,
    receipts: null,
    is_synced: true,
    created_at: '2024-06-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe('updateSubscription', () => {
  it('returns the updated row on success', async () => {
    const updated = makeSubRow({ status: 'paused' });
    mocks.setResult({ data: updated, error: null });

    const result = await updateSubscription('sub_1', { status: 'paused' });

    expect(result.error).toBeNull();
    expect(result.data).toEqual(updated);
    expect(mocks.chain.update).toHaveBeenCalledWith({ status: 'paused' });
    expect(mocks.chain.eq).toHaveBeenCalledWith('id', 'sub_1');
  });

  it('propagates the DB error', async () => {
    mocks.setResult({ data: null, error: { message: 'boom' } });

    const result = await updateSubscription('sub_1', { status: 'paused' });

    expect(result.data).toBeNull();
    expect(result.error).not.toBeNull();
    expect(result.error?.message).toContain('boom');
  });
});

describe('fetchSubscriptions', () => {
  it('merges DB rows with cached local subscriptions', async () => {
    const dbRow = makeSubRow({ id: 'sub_db' });
    const localRow = makeSubRow({ id: 'sub_local', name: 'Local Only' });
    window.localStorage.setItem('subsync_subscriptions', JSON.stringify([localRow]));
    mocks.setResult({ data: [dbRow], error: null });

    const result = await fetchSubscriptions();

    expect(result.error).toBeNull();
    expect(result.data?.map((sub) => sub.id)).toEqual(['sub_local', 'sub_db']);
    expect(result.data).toContainEqual(dbRow);
    expect(result.data).toContainEqual(localRow);
  });
});

describe('archiveSubscription', () => {
  it('writes archived history metadata into the notes passed to updateSubscription', async () => {
    const row = makeSubRow({ status: 'trial' });
    mocks.setResults([
      { data: row, error: null },
      { data: row, error: null },
    ]);

    const result = await archiveSubscription('sub_1');

    expect(result.error).toBeNull();
    expect(result.data).toEqual(row);
    const notesArg = mocks.chain.update.mock.calls[0][0] as { notes: string };
    expect(notesArg.notes).toContain('[HistoryState:');
    expect(notesArg.notes).toContain('"state":"archived"');
    expect(notesArg.notes).toContain('"previousStatus":"trial"');
  });

  it('returns an error when the subscription cannot be fetched', async () => {
    mocks.setResult({ data: null, error: { message: 'missing' } });

    const result = await archiveSubscription('sub_missing');

    expect(result.data).toBeNull();
    expect(result.error?.message).toContain('missing');
  });
});

describe('deleteSubscription', () => {
  it('surfaces the DB error', async () => {
    mocks.setResult({ error: { message: 'nope' } });

    const result = await deleteSubscription('sub_1');

    expect(result.error?.message).toContain('nope');
  });

  it('returns a null error on success', async () => {
    mocks.setResult({ error: null });

    const result = await deleteSubscription('sub_1');

    expect(result.error).toBeNull();
  });
});