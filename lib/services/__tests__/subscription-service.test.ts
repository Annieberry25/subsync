import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  updateSubscription,
  createSubscription,
  fetchSubscriptions,
  getCachedSubscriptions,
  isOverdueSubscription,
  archiveSubscription,
  deleteSubscription,
  softDeleteSubscription,
  restoreSubscription,
  parseAttachedReceipts,
  type SubscriptionRow,
} from '@/lib/services/subscription-service';
import { clearUserScopedStorage } from '@/lib/auth/user-storage';

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
    not: vi.fn(function (...args: unknown[]) {
      void args;
      return chain;
    }),
    order: vi.fn(function (...args: unknown[]) {
      void args;
      return chain;
    }),
    limit: vi.fn(function (...args: unknown[]) {
      void args;
      return chain;
    }),
    single: vi.fn(function (...args: unknown[]) {
      void args;
      return chain;
    }),
    maybeSingle: vi.fn(function (...args: unknown[]) {
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
    window.localStorage.setItem('subhalt_subscriptions', JSON.stringify([localRow]));
    mocks.setResult({ data: [dbRow], error: null });

    const result = await fetchSubscriptions();

    expect(result.error).toBeNull();
    expect(result.data?.map((sub) => sub.id)).toEqual(['sub_local', 'sub_db']);
    expect(result.data).toContainEqual(dbRow);
    expect(result.data).toContainEqual(localRow);
  });

  /**
   * RLS already enforces `auth.uid() = user_id`, but the browser client uses the
   * publishable key. An unfiltered `select('*')` is exactly the query that would
   * expose every row in the table if that policy were ever dropped or made
   * permissive, so the scope is stated explicitly as well.
   */
  it('scopes the query to the signed-in user', async () => {
    mocks.setResult({ data: [], error: null });

    await fetchSubscriptions();

    expect(mocks.chain.eq).toHaveBeenCalledWith('user_id', 'user_1');
  });

  /**
   * The regression that motivated all of this. With no session the cache is the
   * previous account's data, so answering with it showed one user another's
   * subscriptions.
   */
  it('returns nothing rather than the cache when there is no session', async () => {
    mocks.client.auth.getUser.mockResolvedValueOnce({ data: { user: null } } as never);
    window.localStorage.setItem(
      'subhalt_subscriptions',
      JSON.stringify([makeSubRow({ id: 'sub_other', user_id: 'someone_else' })])
    );

    const result = await fetchSubscriptions();

    expect(result.data).toEqual([]);
    expect(window.localStorage.getItem('subhalt_subscriptions')).toBe('[]');
  });

  it('never merges a cached row belonging to another user', async () => {
    const dbRow = makeSubRow({ id: 'sub_db' });
    const foreignRow = makeSubRow({ id: 'sub_foreign', user_id: 'someone_else', name: 'Theirs' });
    window.localStorage.setItem('subhalt_subscriptions', JSON.stringify([foreignRow]));
    mocks.setResult({ data: [dbRow], error: null });

    const result = await fetchSubscriptions();

    expect(result.data?.map((sub) => sub.id)).toEqual(['sub_db']);
    expect(result.data).not.toContainEqual(foreignRow);
  });

  it('does not fall back to the cache when the query fails', async () => {
    window.localStorage.setItem(
      'subhalt_subscriptions',
      JSON.stringify([makeSubRow({ id: 'sub_cached' })])
    );
    mocks.setResult({ data: null, error: { message: 'JWT expired' } });

    const result = await fetchSubscriptions();

    // An auth failure is one of the reasons the cache cannot be trusted here.
    expect(result.data).toEqual([]);
    expect(result.error?.message).toContain('JWT expired');
  });

  /**
   * The half of the logout bug that clearing localStorage did not fix.
   *
   * `getCachedSubscriptions()` falls back to a module-level array when the
   * storage key is absent, so after sign-out wiped storage the previous account's
   * subscriptions were still resident in the tab and were handed straight back to
   * the next person to sign in on that browser.
   */
  it('drops the in-memory copy when the user cache is cleared', async () => {
    const row = makeSubRow({ id: 'sub_1' });
    window.localStorage.setItem('subhalt_subscriptions', JSON.stringify([row]));
    expect(getCachedSubscriptions()).toEqual([row]);

    // This is what sign-out and the account-switch backstop both call.
    clearUserScopedStorage();

    // Storage is gone, and so is the memory copy: nothing of the old account is
    // left to be read.
    expect(window.localStorage.getItem('subhalt_subscriptions')).toBeNull();
    expect(getCachedSubscriptions()).toBeNull();
  });
});

describe('isOverdueSubscription', () => {
  const now = new Date('2026-10-04T12:00:00');

  it('treats a past billing date as overdue', () => {
    expect(
      isOverdueSubscription({ status: 'active', next_billing_date: '2026-10-03' }, now)
    ).toBe(true);
  });

  it('does not treat today as overdue', () => {
    // Midnight today must not read as overdue, or every subscription looks late
    // for the whole day.
    expect(
      isOverdueSubscription({ status: 'active', next_billing_date: '2026-10-04' }, now)
    ).toBe(false);
  });

  it('ignores canceled rows', () => {
    expect(
      isOverdueSubscription({ status: 'canceled', next_billing_date: '2020-01-01' }, now)
    ).toBe(false);
  });

  it('treats a paused but unpaid row as overdue', () => {
    expect(
      isOverdueSubscription({ status: 'paused', next_billing_date: '2026-01-01' }, now)
    ).toBe(true);
  });

  it('does not throw on an unparseable date', () => {
    expect(
      isOverdueSubscription({ status: 'active', next_billing_date: 'not-a-date' }, now)
    ).toBe(false);
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

  it('preserves attached receipts while adding the archived marker', async () => {
    const row = makeSubRow({
      status: 'active',
      receipts: [{ id: 'r1', fileName: 'invoice.pdf', uploadDate: '2026-01-01' }],
    });
    mocks.setResults([
      { data: row, error: null },
      { data: row, error: null },
    ]);

    await archiveSubscription('sub_1');

    const notesArg = mocks.chain.update.mock.calls[0][0] as { notes: string };
    expect(notesArg.notes).toContain('[HistoryState:');
    expect(notesArg.notes).toContain('[AttachedReceipts:');
    expect(notesArg.notes).toContain('invoice.pdf');
  });
});

describe('softDeleteSubscription', () => {
  it('preserves attached receipts while adding the deleted marker', async () => {
    const row = makeSubRow({
      status: 'active',
      receipts: [{ id: 'r1', fileName: 'keepme.pdf', uploadDate: '2026-01-01' }],
    });
    mocks.setResults([
      { data: row, error: null },
      { data: row, error: null },
    ]);

    await softDeleteSubscription('sub_1');

    const notesArg = mocks.chain.update.mock.calls[0][0] as { notes: string };
    expect(notesArg.notes).toContain('"state":"deleted"');
    expect(notesArg.notes).toContain('keepme.pdf');
  });
});

describe('restoreSubscription', () => {
  it('clears the history marker but keeps attached receipts', async () => {
    const row = makeSubRow({
      status: 'active',
      notes: 'user note\n[HistoryState: {"state":"archived","previousStatus":"trial"}]',
      receipts: [{ id: 'r1', fileName: 'restore.pdf', uploadDate: '2026-01-01' }],
    });
    mocks.setResults([
      { data: row, error: null },
      { data: row, error: null },
    ]);

    await restoreSubscription('sub_1');

    const notesArg = mocks.chain.update.mock.calls[0][0] as { notes: string };
    expect(notesArg.notes).not.toContain('[HistoryState:');
    expect(notesArg.notes).toContain('[AttachedReceipts:');
    expect(notesArg.notes).toContain('restore.pdf');
    expect(notesArg.notes).toContain('user note');
  });

  it('restores the previous status carried by the history marker', async () => {
    const row = makeSubRow({
      status: 'active',
      notes: '[HistoryState: {"state":"archived","previousStatus":"paused"}]',
    });
    mocks.setResults([
      { data: row, error: null },
      { data: row, error: null },
    ]);

    await restoreSubscription('sub_1');

    const updateArg = mocks.chain.update.mock.calls[0][0] as { status?: string };
    expect(updateArg.status).toBe('paused');
  });
});

/**
 * The write path is where the cap is enforced, so admin has to bypass it here and
 * not only in the UI. It was enforced here against plan_tier alone, so the
 * operator account was refused a fourth subscription while the interface said
 * nothing about limits — a lockout on the account that runs the app.
 */
describe('createSubscription plan cap', () => {
  const draft = {
    name: 'Disney Plus',
    price: 9.99,
    currency: 'USD',
    billing_cycle: 'monthly',
    category: 'Streaming',
    next_billing_date: '2026-11-01',
  };

  it('refuses a free user past three active subscriptions', async () => {
    mocks.setResults([
      { data: { plan_tier: 'free', is_admin: false }, error: null },
      { count: 3, data: null, error: null },
    ]);

    const result = await createSubscription(draft);

    expect(result.error?.message).toContain('Upgrade to Plus');
  });

  it('allows an admin on the free tier past the cap', async () => {
    const created = makeSubRow({ id: 'sub_new', name: 'Disney Plus' });
    mocks.setResults([
      { data: { plan_tier: 'free', is_admin: true }, error: null },
      { count: 25, data: null, error: null },
      { data: created, error: null },
    ]);

    const result = await createSubscription(draft);

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe('sub_new');
    expect(result.synced).toBe(true);
  });

  it('still caps a non-admin on the free tier with the same row count', async () => {
    mocks.setResults([
      { data: { plan_tier: 'free', is_admin: false }, error: null },
      { count: 25, data: null, error: null },
    ]);

    const result = await createSubscription(draft);

    expect(result.error?.message).toContain('Upgrade to Plus');
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