import { describe, it, expect, vi } from 'vitest';
import {
  monthlyEquivalent,
  compactSubscription,
  parseToolArgs,
  runReadTool,
  describeWriteTool,
  executeWriteTool,
  type AiToolContext,
} from '@/lib/ai/tools';
import type { SubscriptionRow } from '@/lib/services/subscription-service';

const TODAY = '2026-10-17';

function makeSubRow(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
  return {
    id: 'sub_1',
    user_id: 'u1',
    name: 'Netflix',
    price: 15.99,
    currency: 'USD',
    billing_cycle: 'monthly',
    category: 'Streaming',
    status: 'active',
    start_date: '2026-01-01',
    end_date: null,
    next_billing_date: '2026-11-01',
    payment_method: null,
    provider_url: null,
    notes: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as SubscriptionRow;
}

/**
 * Chainable Supabase stand-in: queued results are consumed in call order,
 * payloads records the argument of each insert/update/... call.
 */
function createSupabaseMock() {
  const results: unknown[] = [];
  const payloads: Record<string, unknown[]> = {};
  let index = 0;

  function nextResult() {
    const result = results[index] ?? results[results.length - 1] ?? { data: null, error: null };
    index += 1;
    return result;
  }

  const from = vi.fn(() => {
    const builder: Record<string, unknown> = {};
    for (const op of ['select', 'eq', 'not', 'order', 'limit', 'gte', 'lte', 'insert', 'update']) {
      builder[op] = (...args: unknown[]) => {
        (payloads[op] ||= []).push(args[0]);
        return builder;
      };
    }
    builder.maybeSingle = () => Promise.resolve(nextResult());
    builder.single = () => Promise.resolve(nextResult());
    builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(nextResult()).then(resolve, reject);
    return builder;
  });

  return {
    client: { from } as never,
    queue: (...r: unknown[]) => results.push(...r),
    payloads,
  };
}

function makeCtx(mock: ReturnType<typeof createSupabaseMock>, overrides: Partial<AiToolContext> = {}): AiToolContext {
  return {
    supabase: mock.client,
    userId: 'u1',
    tier: 'plus',
    isAdmin: false,
    actionsEnabled: true,
    displayCurrency: 'USD',
    today: TODAY,
    ...overrides,
  };
}

describe('monthlyEquivalent', () => {
  it('normalizes each cycle to a monthly amount', () => {
    expect(monthlyEquivalent(10, 'monthly')).toBe(10);
    expect(monthlyEquivalent(120, 'yearly')).toBe(10);
    expect(monthlyEquivalent(12, 'weekly')).toBe(52);
    expect(monthlyEquivalent(30, 'quarterly')).toBe(10);
  });

  it('returns null for custom cycles that cannot be normalized', () => {
    expect(monthlyEquivalent(10, 'custom')).toBeNull();
  });
});

describe('compactSubscription', () => {
  it('serializes only the fields the model should see', () => {
    expect(compactSubscription(makeSubRow())).toEqual({
      id: 'sub_1',
      name: 'Netflix',
      price: 15.99,
      currency: 'USD',
      billing_cycle: 'monthly',
      category: 'Streaming',
      status: 'active',
      next_billing_date: '2026-11-01',
    });
  });
});

describe('parseToolArgs', () => {
  it('rejects a write call missing required fields', () => {
    const result = parseToolArgs('create_subscription', { name: 'Netflix', price: 10 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('next_billing_date');
  });

  it('coerces string numbers, applies defaults, and strips unknown keys', () => {
    const result = parseToolArgs('create_subscription', {
      name: 'Spotify',
      price: '12.50',
      next_billing_date: '2026-11-01',
      injection: 'ignore me',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.price).toBe(12.5);
      expect(result.data.billing_cycle).toBe('monthly');
      expect(result.data.status).toBe('active');
      expect(result.data.category).toBe('Other');
      expect(result.data).not.toHaveProperty('injection');
    }
  });

  it('rejects an unknown tool', () => {
    expect(parseToolArgs('drop_tables', {}).ok).toBe(false);
  });
});

describe('runReadTool', () => {
  it('filters subscriptions by name without touching other rows', async () => {
    const mock = createSupabaseMock();
    mock.queue({
      data: [makeSubRow(), makeSubRow({ id: 'sub_2', name: 'Spotify', category: 'Software' })],
      error: null,
    });
    const result = await runReadTool('list_subscriptions', { query: 'net' }, makeCtx(mock));
    expect(result.total_matches).toBe(1);
    expect((result.subscriptions as { name: string }[])[0].name).toBe('Netflix');
  });

  it('reports a read error as a tool error instead of throwing', async () => {
    const mock = createSupabaseMock();
    mock.queue({ data: null, error: { message: 'boom' } });
    const result = await runReadTool('get_spending_summary', {}, makeCtx(mock));
    expect(result.error).toBe('boom');
  });
});

describe('describeWriteTool', () => {
  it('builds a cancellation card from the real row', async () => {
    const mock = createSupabaseMock();
    mock.queue({ data: makeSubRow(), error: null });
    const described = await describeWriteTool('cancel_subscription', { id: 'sub_1' }, makeCtx(mock));
    expect('error' in described).toBe(false);
    if ('error' in described) return;
    expect(described.title).toBe('Cancel Netflix');
    expect(described.details).toContainEqual({ label: 'Status', value: 'active → canceled' });
    expect(described.details).toContainEqual({ label: 'End date', value: TODAY });
  });

  it('refuses to describe a cancellation for a subscription that does not exist', async () => {
    const mock = createSupabaseMock();
    mock.queue({ data: null, error: null });
    const described = await describeWriteTool('cancel_subscription', { id: 'missing' }, makeCtx(mock));
    expect('error' in described).toBe(true);
  });

  it('drops no-op updates instead of proposing an empty change', async () => {
    const mock = createSupabaseMock();
    mock.queue({ data: makeSubRow(), error: null });
    const described = await describeWriteTool('update_subscription', { id: 'sub_1', price: 15.99 }, makeCtx(mock));
    expect('error' in described).toBe(true);
  });
});

describe('executeWriteTool', () => {
  it('does not cap a free user past the old subscription limit, so the create still writes', async () => {
    const mock = createSupabaseMock();
    mock.queue({ count: 25, error: null });
    mock.queue({ data: makeSubRow({ id: 'sub_new', name: 'Disney+' }), error: null });
    const result = await executeWriteTool(
      'create_subscription',
      { name: 'Disney+', price: 9.99, next_billing_date: '2026-11-20' },
      makeCtx(mock, { tier: 'free' })
    );
    expect(result.ok).toBe(true);
    expect(mock.payloads.insert?.[0]).toMatchObject({ name: 'Disney+' });
  });

  it('inserts a new subscription with server-side defaults', async () => {
    const mock = createSupabaseMock();
    mock.queue({ count: 1, error: null });
    mock.queue({ data: makeSubRow({ id: 'sub_new', name: 'Spotify' }), error: null });
    const result = await executeWriteTool(
      'create_subscription',
      { name: 'Spotify', price: 9.99, next_billing_date: '2026-11-20' },
      makeCtx(mock)
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.message).toBe('Added Spotify.');
    expect(mock.payloads.insert?.[0]).toMatchObject({
      user_id: 'u1',
      name: 'Spotify',
      price: 9.99,
      currency: 'USD',
      billing_cycle: 'monthly',
      status: 'active',
      start_date: TODAY,
      is_synced: true,
    });
  });

  it('cancels by writing canceled status and an end date scoped to the user', async () => {
    const mock = createSupabaseMock();
    mock.queue({ data: makeSubRow(), error: null });
    mock.queue({ data: makeSubRow({ status: 'canceled', end_date: TODAY }), error: null });
    const result = await executeWriteTool('cancel_subscription', { id: 'sub_1' }, makeCtx(mock));
    expect(result.ok).toBe(true);
    expect(mock.payloads.update?.[0]).toEqual({ status: 'canceled', end_date: TODAY });
    // Both the read and the write are scoped to the signed-in user.
    expect((mock.payloads.eq ?? []).filter((v) => v === 'user_id')).toHaveLength(2);
  });
});
