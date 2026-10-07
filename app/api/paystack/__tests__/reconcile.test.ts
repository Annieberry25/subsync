import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * POST /api/paystack/reconcile is the safety net for a payment the callback and
 * the (unregistered) webhook both missed: it re-checks the customer's recent
 * rows against Paystack and re-runs the idempotent grant. Without it a charge
 * that landed between the session expiring and the redirect being rate limited
 * was permanently stuck on Free.
 */
const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  verifyTransaction: vi.fn(),
  isPaystackConfigured: vi.fn(() => true),
  grantPlanSubscription: vi.fn(async () => true),
  subscriptionRows: [] as Record<string, unknown>[],
  subscriptionError: null as { message: string } | null,
  profile: null as Record<string, unknown> | null,
  fromCalls: [] as string[],
}));

vi.mock('@/lib/auth/access', () => ({
  getAuthUser: mocks.getAuthUser,
}));

vi.mock('@/lib/paystack', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/paystack')>();
  return {
    ...actual,
    verifyTransaction: mocks.verifyTransaction,
    isPaystackConfigured: mocks.isPaystackConfigured,
  };
});

vi.mock('@/lib/paystack/grants', () => ({
  grantPlanSubscription: mocks.grantPlanSubscription,
  markPlanSubscriptionFailed: vi.fn(),
  downgradeUserToFree: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: {} }),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from(table: string) {
      mocks.fromCalls.push(table);

      if (table === 'profiles') {
        const profileQuery: Record<string, unknown> = {
          select: () => profileQuery,
          eq: () => profileQuery,
          maybeSingle: async () => ({ data: mocks.profile, error: null }),
        };
        return profileQuery;
      }

      const listQuery: Record<string, unknown> = {
        select: () => listQuery,
        eq: () => listQuery,
        gte: () => listQuery,
        in: () => listQuery,
        order: () => ({
          then: (
            onFulfilled: (value: unknown) => unknown,
            onRejected?: (reason: unknown) => unknown
          ) =>
            Promise.resolve({ data: mocks.subscriptionRows, error: mocks.subscriptionError }).then(
              onFulfilled,
              onRejected
            ),
        }),
      };
      return listQuery;
    },
  }),
}));

import { POST } from '@/app/api/paystack/reconcile/route';

const REFERENCE = 'SUBHALT-abc123def456-1717171717171-A1B2C3D4E5F6';

function futureDate(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function pastDate(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isPaystackConfigured.mockReturnValue(true);
  mocks.getAuthUser.mockResolvedValue({ id: 'user-1' });
  mocks.grantPlanSubscription.mockResolvedValue(true);
  mocks.subscriptionRows = [];
  mocks.subscriptionError = null;
  mocks.profile = { plan_tier: 'free', plan_expires_at: null };
});

describe('POST /api/paystack/reconcile', () => {
  it('rejects an unauthenticated caller', async () => {
    mocks.getAuthUser.mockResolvedValue(null);

    const response = await POST();

    expect(response.status).toBe(401);
    expect(mocks.grantPlanSubscription).not.toHaveBeenCalled();
  });

  it('is a no-op when the customer has no recent checkout', async () => {
    const response = await POST();

    expect(await response.json()).toEqual({ granted: false });
    expect(mocks.verifyTransaction).not.toHaveBeenCalled();
    expect(mocks.grantPlanSubscription).not.toHaveBeenCalled();
  });

  it('repairs a settled row whose profile write never landed', async () => {
    const paidAt = pastDate(1);
    mocks.subscriptionRows = [
      {
        paystack_reference: REFERENCE,
        status: 'paid',
        amount: 600000,
        currency: 'NGN',
        paid_at: paidAt,
        expires_at: futureDate(29),
        created_at: paidAt,
      },
    ];

    const response = await POST();

    expect(await response.json()).toEqual({ granted: true });
    expect(mocks.grantPlanSubscription).toHaveBeenCalledWith(REFERENCE, paidAt);
    expect(mocks.fromCalls).toContain('profiles');
    // Already settled: no need to ask Paystack anything.
    expect(mocks.verifyTransaction).not.toHaveBeenCalled();
  });

  it('does not re-grant an expired settled row', async () => {
    mocks.subscriptionRows = [
      {
        paystack_reference: REFERENCE,
        status: 'paid',
        amount: 600000,
        currency: 'NGN',
        paid_at: pastDate(40),
        expires_at: pastDate(10),
        created_at: pastDate(40),
      },
    ];

    const response = await POST();

    expect(await response.json()).toEqual({ granted: false });
    expect(mocks.grantPlanSubscription).not.toHaveBeenCalled();
  });

  it('leaves an already-active Plus account alone', async () => {
    mocks.profile = { plan_tier: 'plus', plan_expires_at: futureDate(10) };
    mocks.subscriptionRows = [
      {
        paystack_reference: REFERENCE,
        status: 'pending',
        amount: 600000,
        currency: 'NGN',
        paid_at: null,
        expires_at: null,
        created_at: pastDate(1),
      },
    ];

    const response = await POST();

    expect(await response.json()).toEqual({ granted: false });
    expect(mocks.verifyTransaction).not.toHaveBeenCalled();
    expect(mocks.grantPlanSubscription).not.toHaveBeenCalled();
  });

  it('recovers a pending row Paystack says was already paid', async () => {
    const paidAt = pastDate(1);
    mocks.subscriptionRows = [
      {
        paystack_reference: REFERENCE,
        status: 'pending',
        amount: 600000,
        currency: 'NGN',
        paid_at: null,
        expires_at: null,
        created_at: paidAt,
      },
    ];
    mocks.verifyTransaction.mockResolvedValue({
      status: 'success',
      reference: REFERENCE,
      // Fee reported on top of the 600000 we initialized.
      amount: 621000,
      requestedAmount: 600000,
      currency: 'NGN',
      paidAt,
      customerEmail: null,
      channel: 'card',
    });

    const response = await POST();

    expect(await response.json()).toEqual({ granted: true });
    expect(mocks.verifyTransaction).toHaveBeenCalledWith(REFERENCE);
    expect(mocks.grantPlanSubscription).toHaveBeenCalledWith(REFERENCE, paidAt);
  });

  it('recovers a successful charge the webhook wrongly marked failed', async () => {
    const paidAt = pastDate(1);
    mocks.subscriptionRows = [
      {
        paystack_reference: REFERENCE,
        status: 'failed',
        amount: 600000,
        currency: 'NGN',
        paid_at: null,
        expires_at: null,
        created_at: paidAt,
      },
    ];
    mocks.verifyTransaction.mockResolvedValue({
      status: 'success',
      reference: REFERENCE,
      amount: 621000,
      requestedAmount: 600000,
      currency: 'NGN',
      paidAt,
      customerEmail: null,
      channel: 'card',
    });

    const response = await POST();

    expect(await response.json()).toEqual({ granted: true });
    expect(mocks.grantPlanSubscription).toHaveBeenCalledWith(REFERENCE, paidAt);
  });

  it('leaves a row that really did fail marked failed', async () => {
    mocks.subscriptionRows = [
      {
        paystack_reference: REFERENCE,
        status: 'failed',
        amount: 600000,
        currency: 'NGN',
        paid_at: null,
        expires_at: null,
        created_at: pastDate(1),
      },
    ];
    mocks.verifyTransaction.mockResolvedValue({
      status: 'failed',
      reference: REFERENCE,
      amount: 600000,
      requestedAmount: 600000,
      currency: 'NGN',
      paidAt: null,
      customerEmail: null,
      channel: 'card',
    });

    const response = await POST();

    expect(await response.json()).toEqual({ granted: false });
    expect(mocks.grantPlanSubscription).not.toHaveBeenCalled();
  });

  it('skips a pending row whose charge does not match what we stored', async () => {
    mocks.subscriptionRows = [
      {
        paystack_reference: REFERENCE,
        status: 'pending',
        amount: 600000,
        currency: 'NGN',
        paid_at: null,
        expires_at: null,
        created_at: pastDate(1),
      },
    ];
    mocks.verifyTransaction.mockResolvedValue({
      status: 'success',
      reference: REFERENCE,
      amount: 1,
      requestedAmount: 1,
      currency: 'NGN',
      paidAt: pastDate(1),
      customerEmail: null,
      channel: 'card',
    });

    const response = await POST();

    expect(await response.json()).toEqual({ granted: false });
    expect(mocks.grantPlanSubscription).not.toHaveBeenCalled();
  });

  it('keeps going when verification for one reference fails', async () => {
    mocks.subscriptionRows = [
      {
        paystack_reference: REFERENCE,
        status: 'pending',
        amount: 600000,
        currency: 'NGN',
        paid_at: null,
        expires_at: null,
        created_at: pastDate(1),
      },
    ];
    mocks.verifyTransaction.mockRejectedValue(new Error('Paystack unreachable'));

    const response = await POST();

    expect(await response.json()).toEqual({ granted: false });
    expect(mocks.grantPlanSubscription).not.toHaveBeenCalled();
  });

  it('reports a read failure instead of claiming nothing was owed', async () => {
    mocks.subscriptionError = { message: 'permission denied' };

    const response = await POST();

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: expect.any(String) });
  });
});
