import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * POST /api/paystack/initialize is the only way a customer can start a
 * payment, so it is where "one plan per month" has to be enforced.
 *
 * Two regressions pin this file:
 *  - a customer whose grant never landed (profile still Free) could buy the
 *    same month again, because the guard only read the profile;
 *  - two checkouts could be started while the first was still being paid,
 *    which charges the same month twice.
 */
const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  isPaystackConfigured: vi.fn(() => true),
  getPlanCharge: vi.fn(),
  initializeTransaction: vi.fn(),
  verifyTransaction: vi.fn(),
  grantPlanSubscription: vi.fn(async () => true),
  markPlanSubscriptionFailed: vi.fn(async () => undefined),
  profile: null as Record<string, unknown> | null,
  /** FIFO of results for each plan_subscriptions lookup, in call order. */
  planLookups: [] as { data: Record<string, unknown> | null; error: { message: string } | null }[],
  planWriteError: null as { message: string } | null,
  planWrites: [] as { kind: 'insert' | 'update'; payload: Record<string, unknown> }[],
  fromCalls: [] as string[],
}));

vi.mock('@/lib/auth/access', () => ({
  getAuthUser: mocks.getAuthUser,
}));

vi.mock('@/lib/paystack', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/paystack')>();
  return {
    ...actual,
    isPaystackConfigured: mocks.isPaystackConfigured,
    getPlanCharge: mocks.getPlanCharge,
    initializeTransaction: mocks.initializeTransaction,
    verifyTransaction: mocks.verifyTransaction,
  };
});

vi.mock('@/lib/paystack/grants', () => ({
  grantPlanSubscription: mocks.grantPlanSubscription,
  markPlanSubscriptionFailed: mocks.markPlanSubscriptionFailed,
  downgradeUserToFree: vi.fn(),
  schedulePlanCancellation: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: {} }),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from(table: string) {
      mocks.fromCalls.push(table);

      const query: Record<string, unknown> = {};
      Object.assign(query, {
        select: () => query,
        eq: () => query,
        in: () => query,
        gt: () => query,
        gte: () => query,
        order: () => query,
        limit: () => query,
        maybeSingle: async () =>
          table === 'profiles'
            ? { data: mocks.profile, error: null }
            : (mocks.planLookups.shift() ?? { data: null, error: null }),
        insert: (payload: Record<string, unknown>) => {
          mocks.planWrites.push({ kind: 'insert', payload });
          return query;
        },
        update: (payload: Record<string, unknown>) => {
          mocks.planWrites.push({ kind: 'update', payload });
          return query;
        },
        // Writes are awaited for their `{ error }`, reads use maybeSingle().
        then: (
          onFulfilled: (value: unknown) => unknown,
          onRejected?: (reason: unknown) => unknown
        ) =>
          Promise.resolve({ data: null, error: mocks.planWriteError }).then(
            onFulfilled,
            onRejected
          ),
      });
      return query;
    },
  }),
}));

import { POST } from '@/app/api/paystack/initialize/route';

const REFERENCE = 'SUBHALT-abc123def456-1717171717171-A1B2C3D4E5F6';
const PAID_AT = '2026-10-01T10:00:00.000Z';

function makeRequest(): NextRequest {
  return new NextRequest('https://subhalt.xyz/api/paystack/initialize', { method: 'POST' });
}

function futureDate(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function pastDate(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function paidTx(overrides: Record<string, unknown> = {}) {
  return {
    status: 'success',
    reference: REFERENCE,
    // Fee reported on top of the 600000 we initialized.
    amount: 621000,
    requestedAmount: 600000,
    currency: 'NGN',
    paidAt: PAID_AT,
    customerEmail: null,
    channel: 'card',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isPaystackConfigured.mockReturnValue(true);
  mocks.getAuthUser.mockResolvedValue({ id: 'user-1', email: 'a@b.co' });
  mocks.profile = { plan_tier: 'free', plan_expires_at: null };
  mocks.planLookups = [];
  mocks.planWriteError = null;
  mocks.planWrites = [];
  mocks.fromCalls = [];
  mocks.getPlanCharge.mockResolvedValue({
    amount: 600000,
    currency: 'NGN',
    usdAmount: 3.99,
    usdCurrency: 'USD',
  });
  mocks.initializeTransaction.mockResolvedValue({
    authorization_url: 'https://checkout.paystack.com/abc',
    access_code: 'access-abc',
    reference: null,
  });
  mocks.verifyTransaction.mockResolvedValue(paidTx());
  mocks.grantPlanSubscription.mockResolvedValue(true);
});

describe('POST /api/paystack/initialize', () => {
  it('rejects an unauthenticated caller', async () => {
    mocks.getAuthUser.mockResolvedValue(null);

    const response = await POST(makeRequest());

    expect(response.status).toBe(401);
    expect(mocks.planWrites).toHaveLength(0);
    expect(mocks.initializeTransaction).not.toHaveBeenCalled();
  });

  it('refuses checkout when payments are not configured', async () => {
    mocks.isPaystackConfigured.mockReturnValue(false);

    const response = await POST(makeRequest());

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ configured: false });
  });

  it('blocks a new checkout while the profile is on an active plus plan', async () => {
    mocks.profile = { plan_tier: 'plus', plan_expires_at: futureDate(20) };

    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ alreadyActive: true });
    expect(mocks.planWrites).toHaveLength(0);
    expect(mocks.initializeTransaction).not.toHaveBeenCalled();
  });

  it('blocks a new checkout from the payment rows when the profile lags behind', async () => {
    // Profile says Free (the half-applied grant), but the paid row still has
    // its 30 days to run: paying again would buy the same month twice.
    const expiresAt = futureDate(20);
    mocks.planLookups = [{ data: { expires_at: expiresAt }, error: null }];

    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      alreadyActive: true,
      expiresAt,
    });
    expect(mocks.verifyTransaction).not.toHaveBeenCalled();
    expect(mocks.planWrites).toHaveLength(0);
    expect(mocks.initializeTransaction).not.toHaveBeenCalled();
  });

  it('settles a recent checkout Paystack already charged instead of starting a second one', async () => {
    mocks.planLookups = [
      { data: null, error: null },
      {
        data: {
          paystack_reference: REFERENCE,
          amount: 600000,
          currency: 'NGN',
          created_at: pastDate(5),
        },
        error: null,
      },
    ];

    const response = await POST(makeRequest());

    expect(await response.json()).toEqual({ alreadyActive: true });
    expect(mocks.verifyTransaction).toHaveBeenCalledWith(REFERENCE);
    expect(mocks.grantPlanSubscription).toHaveBeenCalledWith(REFERENCE, PAID_AT);
    expect(mocks.planWrites).toHaveLength(0);
    expect(mocks.initializeTransaction).not.toHaveBeenCalled();
  });

  it('refuses to start another checkout while the previous payment is still in flight', async () => {
    mocks.planLookups = [
      { data: null, error: null },
      {
        data: {
          paystack_reference: REFERENCE,
          amount: 600000,
          currency: 'NGN',
          created_at: pastDate(1),
        },
        error: null,
      },
    ];
    mocks.verifyTransaction.mockResolvedValue(paidTx({ status: 'pending', amount: 600000 }));

    const response = await POST(makeRequest());

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ pendingConfirmation: true });
    expect(mocks.planWrites).toHaveLength(0);
    expect(mocks.initializeTransaction).not.toHaveBeenCalled();
  });

  it('retires an abandoned checkout and starts a fresh one', async () => {
    mocks.planLookups = [
      { data: null, error: null },
      {
        data: {
          paystack_reference: REFERENCE,
          amount: 600000,
          currency: 'NGN',
          created_at: pastDate(10),
        },
        error: null,
      },
    ];
    mocks.verifyTransaction.mockResolvedValue(paidTx({ status: 'abandoned', amount: 600000 }));

    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      authorizationUrl: 'https://checkout.paystack.com/abc',
    });
    expect(mocks.markPlanSubscriptionFailed).toHaveBeenCalledWith(REFERENCE);
    const insert = mocks.planWrites.find((write) => write.kind === 'insert');
    expect(insert).toBeTruthy();
    expect(insert?.payload).toMatchObject({ user_id: 'user-1', status: 'pending' });
  });

  it('blocks a checkout that may still be in flight when verification is unavailable', async () => {
    mocks.planLookups = [
      { data: null, error: null },
      {
        data: {
          paystack_reference: REFERENCE,
          amount: 600000,
          currency: 'NGN',
          created_at: pastDate(1),
        },
        error: null,
      },
    ];
    mocks.verifyTransaction.mockRejectedValue(new Error('Paystack unreachable'));

    const response = await POST(makeRequest());

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ pendingConfirmation: true });
    // Too recent to be abandoned: a payment may be landing right now.
    expect(mocks.markPlanSubscriptionFailed).not.toHaveBeenCalled();
    expect(mocks.initializeTransaction).not.toHaveBeenCalled();
  });

  it('retires a stale checkout that cannot be verified and proceeds', async () => {
    mocks.planLookups = [
      { data: null, error: null },
      {
        data: {
          paystack_reference: REFERENCE,
          amount: 600000,
          currency: 'NGN',
          created_at: pastDate(20),
        },
        error: null,
      },
    ];
    mocks.verifyTransaction.mockRejectedValue(new Error('Paystack unreachable'));

    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      authorizationUrl: 'https://checkout.paystack.com/abc',
    });
    expect(mocks.markPlanSubscriptionFailed).toHaveBeenCalledWith(REFERENCE);
  });

  it('starts checkout normally when nothing is outstanding', async () => {
    mocks.planLookups = [
      { data: null, error: null },
      { data: null, error: null },
    ];

    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      authorizationUrl: 'https://checkout.paystack.com/abc',
    });
    expect(mocks.verifyTransaction).not.toHaveBeenCalled();
    expect(mocks.planWrites.filter((write) => write.kind === 'insert')).toHaveLength(1);
  });

  it('reports a failed row write instead of offering a payable link', async () => {
    mocks.planWriteError = { message: 'permission denied' };

    const response = await POST(makeRequest());

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: expect.any(String) });
    expect(mocks.initializeTransaction).not.toHaveBeenCalled();
  });
});
