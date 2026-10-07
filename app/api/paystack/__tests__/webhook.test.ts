import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * The webhook is the settlement path that survives a closed browser, and it is
 * the one that produced the bug this file pins: a `charge.success` whose
 * reported amount did not equal the stored row (Paystack charges some payments
 * with its fee added on top of the amount we initialized) was treated as "not
 * our payment" and the row was demoted to `failed` — five successful charges
 * became five rows no settlement path would ever look at again.
 *
 * Rule under test: charge.success never demotes a row, and it grants on the
 * requested amount.
 */
const mocks = vi.hoisted(() => ({
  verifyWebhookSignature: vi.fn(() => true),
  grantPlanSubscription: vi.fn(async () => true),
  markPlanSubscriptionFailed: vi.fn(async () => undefined),
  maybeSingle: vi.fn(),
}));

vi.mock('@/lib/paystack', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/paystack')>();
  return {
    ...actual,
    verifyWebhookSignature: mocks.verifyWebhookSignature,
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

import { POST } from '@/app/api/paystack/webhook/route';

const REFERENCE = 'SUBHALT-abc123def456-1717171717171-A1B2C3D4E5F6';

function makeRequest(payload: unknown): NextRequest {
  return new NextRequest('https://subhalt.xyz/api/paystack/webhook', {
    method: 'POST',
    headers: { 'x-paystack-signature': 'test-signature' },
    body: JSON.stringify(payload),
  });
}

function successEvent(overrides: Record<string, unknown> = {}) {
  return {
    event: 'charge.success',
    data: {
      status: 'success',
      reference: REFERENCE,
      // Charge reported with the fee on top of the 600000 we initialized.
      amount: 621000,
      requested_amount: 600000,
      currency: 'NGN',
      paid_at: '2026-10-01T10:00:00.000Z',
      ...overrides,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verifyWebhookSignature.mockReturnValue(true);
  mocks.grantPlanSubscription.mockResolvedValue(true);
  mocks.maybeSingle.mockResolvedValue({
    data: { amount: 600000, currency: 'NGN', status: 'pending' },
    error: null,
  });
});

describe('POST /api/paystack/webhook', () => {
  it('rejects a payload without a valid signature', async () => {
    mocks.verifyWebhookSignature.mockReturnValue(false);

    const response = await POST(makeRequest(successEvent()));

    expect(response.status).toBe(401);
    expect(mocks.grantPlanSubscription).not.toHaveBeenCalled();
  });

  it('grants a charge whose reported amount includes the fee', async () => {
    const response = await POST(makeRequest(successEvent()));

    expect(response.status).toBe(200);
    expect(mocks.grantPlanSubscription).toHaveBeenCalledWith(
      REFERENCE,
      '2026-10-01T10:00:00.000Z'
    );
    expect(mocks.markPlanSubscriptionFailed).not.toHaveBeenCalled();
  });

  it('never demotes a pending row whose payload does not match', async () => {
    const response = await POST(makeRequest(successEvent({ amount: 1, requested_amount: 1 })));

    // Acknowledged (no useless retries) but no grant, and above all no demotion:
    // the row stays pending for reconcile, which verifies against Paystack.
    expect(response.status).toBe(200);
    expect(mocks.grantPlanSubscription).not.toHaveBeenCalled();
    expect(mocks.markPlanSubscriptionFailed).not.toHaveBeenCalled();
  });

  it('ignores a success event for a row we have never seen', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    const response = await POST(makeRequest(successEvent()));

    expect(response.status).toBe(200);
    expect(mocks.grantPlanSubscription).not.toHaveBeenCalled();
    expect(mocks.markPlanSubscriptionFailed).not.toHaveBeenCalled();
  });

  it('ignores a success event without a reference', async () => {
    const response = await POST(makeRequest(successEvent({ reference: undefined })));

    expect(response.status).toBe(200);
    expect(mocks.grantPlanSubscription).not.toHaveBeenCalled();
  });

  it('returns 500 when the grant fails so Paystack retries', async () => {
    mocks.grantPlanSubscription.mockResolvedValue(false);

    const response = await POST(makeRequest(successEvent()));

    expect(response.status).toBe(500);
  });
});
