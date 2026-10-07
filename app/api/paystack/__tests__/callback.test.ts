import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * The regression this file exists for: a successful Paystack charge used to be
 * abandoned when the browser came back without a live session (or with an
 * amount/currency drift), so the customer was charged and the app never moved
 * off Free. The callback settles a payment the same way the webhook does — by
 * verifying against Paystack and matching the row recorded at checkout — so it
 * must never consult the session at all.
 */
const mocks = vi.hoisted(() => ({
  verifyTransaction: vi.fn(),
  isPaystackConfigured: vi.fn(() => true),
  grantPlanSubscription: vi.fn(async () => true),
  markPlanSubscriptionFailed: vi.fn(async () => undefined),
  maybeSingle: vi.fn(),
  sessionClientCreated: vi.fn(),
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
  markPlanSubscriptionFailed: mocks.markPlanSubscriptionFailed,
  downgradeUserToFree: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: mocks.maybeSingle }),
      }),
    }),
  }),
}));

// If the callback ever reaches for a browser session again, these tests fail:
// a session is not available on a cross-site return from Paystack.
vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => {
    mocks.sessionClientCreated(...args);
    return Promise.resolve({ auth: { getUser: async () => ({ data: { user: null } }) } });
  },
}));

import { GET } from '@/app/api/paystack/callback/route';

const REFERENCE = 'SUBHALT-abc123def456-1717171717171-A1B2C3D4E5F6';

function makeRequest(query: string): NextRequest {
  return new NextRequest(`https://subhalt.xyz/api/paystack/callback${query}`);
}

function storedRow(overrides: Record<string, unknown> = {}) {
  return {
    amount: 600000,
    currency: 'NGN',
    status: 'pending',
    user_id: 'user-1',
    ...overrides,
  };
}

function verifiedTx(overrides: Record<string, unknown> = {}) {
  return {
    status: 'success',
    reference: REFERENCE,
    // Realistic shape: Paystack reports the charge with its fee added on top
    // of what we initialized (stored row = 600000), so `amount` alone does not
    // equal the stored amount. `requestedAmount` is what we asked for.
    amount: 621000,
    requestedAmount: 600000,
    currency: 'NGN',
    customerEmail: 'a@b.co',
    paidAt: '2026-10-01T10:00:00.000Z',
    channel: 'card',
    ...overrides,
  };
}

function locationOf(response: Response): string {
  return response.headers.get('location') ?? '';
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isPaystackConfigured.mockReturnValue(true);
  mocks.maybeSingle.mockResolvedValue({ data: storedRow(), error: null });
  mocks.verifyTransaction.mockResolvedValue(verifiedTx());
  mocks.grantPlanSubscription.mockResolvedValue(true);
});

describe('GET /api/paystack/callback', () => {
  it('grants and redirects to paid on a verified charge, without any session', async () => {
    const response = await GET(makeRequest(`?reference=${REFERENCE}&trxref=${REFERENCE}`));

    expect(mocks.sessionClientCreated).not.toHaveBeenCalled();
    expect(mocks.verifyTransaction).toHaveBeenCalledWith(REFERENCE);
    expect(mocks.grantPlanSubscription).toHaveBeenCalledWith(
      REFERENCE,
      '2026-10-01T10:00:00.000Z'
    );
    expect(response.status).toBe(307);
    expect(locationOf(response)).toContain('billing=paid');
  });

  it('settles a payment that only carried trxref', async () => {
    const response = await GET(makeRequest(`?trxref=${REFERENCE}`));

    expect(mocks.verifyTransaction).toHaveBeenCalledWith(REFERENCE);
    expect(mocks.grantPlanSubscription).toHaveBeenCalledWith(REFERENCE, expect.any(String));
    expect(locationOf(response)).toContain('billing=paid');
  });

  it('reports an error when the reference has no stored row', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    const response = await GET(makeRequest(`?reference=${REFERENCE}`));

    expect(mocks.verifyTransaction).not.toHaveBeenCalled();
    expect(mocks.grantPlanSubscription).not.toHaveBeenCalled();
    expect(locationOf(response)).toContain('billing=error');
  });

  it('reports an error when verification cannot be reached', async () => {
    mocks.verifyTransaction.mockRejectedValue(new Error('Paystack unreachable'));

    const response = await GET(makeRequest(`?reference=${REFERENCE}`));

    expect(mocks.grantPlanSubscription).not.toHaveBeenCalled();
    expect(locationOf(response)).toContain('billing=error');
  });

  it('marks a failed charge failed and tells the customer no charge completed', async () => {
    mocks.verifyTransaction.mockResolvedValue(verifiedTx({ status: 'failed' }));

    const response = await GET(makeRequest(`?reference=${REFERENCE}`));

    expect(mocks.markPlanSubscriptionFailed).toHaveBeenCalledWith(REFERENCE);
    expect(mocks.grantPlanSubscription).not.toHaveBeenCalled();
    expect(locationOf(response)).toContain('billing=failed');
  });

  it('rejects a successful charge whose amount drifted from the stored row', async () => {
    mocks.verifyTransaction.mockResolvedValue(
      verifiedTx({ amount: 1, requestedAmount: 1 })
    );

    const response = await GET(makeRequest(`?reference=${REFERENCE}`));

    expect(mocks.grantPlanSubscription).not.toHaveBeenCalled();
    // The row stays pending so a later webhook or reconcile can settle it once
    // Paystack resolves the discrepancy — it must not be marked failed here.
    expect(mocks.markPlanSubscriptionFailed).not.toHaveBeenCalled();
    // The customer WAS charged, so it must not claim "no charge completed".
    expect(locationOf(response)).toContain('billing=error');
    expect(locationOf(response)).not.toContain('billing=failed');
  });

  it('still settles when the payload carries no requested_amount and the amounts agree', async () => {
    mocks.verifyTransaction.mockResolvedValue(
      verifiedTx({ amount: 600000, requestedAmount: null })
    );

    const response = await GET(makeRequest(`?reference=${REFERENCE}`));

    expect(mocks.grantPlanSubscription).toHaveBeenCalledWith(
      REFERENCE,
      '2026-10-01T10:00:00.000Z'
    );
    expect(locationOf(response)).toContain('billing=paid');
  });

  it('never demotes a row that was already settled', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: storedRow({ status: 'paid', amount: 1 }),
      error: null,
    });

    const response = await GET(makeRequest(`?reference=${REFERENCE}`));

    expect(mocks.markPlanSubscriptionFailed).not.toHaveBeenCalled();
    expect(locationOf(response)).toContain('billing=error');
  });

  it('reports an error rather than paid when the grant itself fails', async () => {
    mocks.grantPlanSubscription.mockResolvedValue(false);

    const response = await GET(makeRequest(`?reference=${REFERENCE}`));

    expect(locationOf(response)).toContain('billing=error');
    expect(locationOf(response)).not.toContain('billing=paid');
  });

  it('reports failed when the redirect carried no reference at all', async () => {
    const response = await GET(makeRequest(''));

    expect(mocks.verifyTransaction).not.toHaveBeenCalled();
    expect(locationOf(response)).toContain('billing=failed');
  });
});
