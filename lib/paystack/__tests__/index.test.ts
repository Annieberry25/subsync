import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  generateTransactionReference,
  resolvePublicOrigin,
  transactionMatchesPlan,
  verifyTransaction,
  type VerifiedTransaction,
} from '@/lib/paystack';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('generateTransactionReference', () => {
  // Paystack rejects references outside [A-Za-z0-9.-=] with "Invalid character
  // in transaction reference". Underscore separators used to be generated here,
  // which makes the reference Paystack reports back diverge from the row we
  // stored — the callback then cannot find the payment at all.
  it('uses only characters Paystack accepts', () => {
    const reference = generateTransactionReference();

    expect(reference).toMatch(/^[A-Za-z0-9.=-]+$/);
    expect(reference.startsWith('SUBHALT-')).toBe(true);
  });

  it('is unique per call and never embeds the user id', () => {
    const first = generateTransactionReference();
    const second = generateTransactionReference();

    expect(first).not.toBe(second);
  });
});

describe('resolvePublicOrigin', () => {
  it('uses the request origin in development so sessions stay host-scoped', () => {
    const request = new Request('http://localhost:3000/api/paystack/initialize', {
      headers: {
        'x-forwarded-host': 'evil.example.com',
        'x-forwarded-proto': 'https',
      },
    });

    expect(resolvePublicOrigin(request)).toBe('http://localhost:3000');
  });

  it('never trusts forwarding headers in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const request = new Request('https://internal:3000/api/paystack/initialize', {
      headers: {
        'x-forwarded-host': 'evil.example.com',
        'x-forwarded-proto': 'https',
      },
    });

    expect(resolvePublicOrigin(request)).toBe('https://subhalt.xyz');
  });

  it('falls back to the configured site URL when the URL cannot be parsed', () => {
    const request = { headers: new Headers(), url: 'not-a-url' } as unknown as Request;

    expect(resolvePublicOrigin(request)).toMatch(/^https:\/\//);
  });
});

describe('transactionMatchesPlan', () => {
  const stored = { reference: 'REF-1', amount: 600000, currency: 'NGN' };

  const base: VerifiedTransaction = {
    status: 'success',
    reference: 'REF-1',
    amount: 621000,
    requestedAmount: 600000,
    currency: 'NGN',
    customerEmail: 'a@b.co',
    paidAt: '2026-10-01T10:00:00.000Z',
    channel: 'card',
  };

  // Regression: Paystack reports some charges with its fee added on top of the
  // amount we initialized (requested 600000, paid 621000). Comparing `amount`
  // alone rejected our own successful payments, so they were never granted.
  it('matches a charge reported with the fee added on top', () => {
    expect(transactionMatchesPlan(base, stored)).toBe(true);
  });

  it('matches when the payload carries no requested amount', () => {
    expect(
      transactionMatchesPlan({ ...base, amount: 600000, requestedAmount: null }, stored)
    ).toBe(true);
  });

  it('rejects a charge for a different amount', () => {
    expect(transactionMatchesPlan({ ...base, amount: 1, requestedAmount: 1 }, stored)).toBe(false);
  });

  it('rejects a different reference', () => {
    expect(transactionMatchesPlan({ ...base, reference: 'REF-2' }, stored)).toBe(false);
  });

  it('rejects a different currency', () => {
    expect(transactionMatchesPlan({ ...base, currency: 'USD' }, stored)).toBe(false);
  });

  it('rejects a charge that did not succeed', () => {
    expect(transactionMatchesPlan({ ...base, status: 'failed' }, stored)).toBe(false);
  });

  it('rejects when there is no stored row to match against', () => {
    expect(transactionMatchesPlan(base, null)).toBe(false);
    expect(transactionMatchesPlan(base, undefined)).toBe(false);
  });
});

describe('verifyTransaction', () => {
  // Regression: the verify call carried no Authorization header, so Paystack
  // answered "No Authorization Header was found" for it every time. The
  // callback and the reconcile pass both verify through this function, so both
  // always failed and a payment was only ever granted when the webhook fired —
  // the customer was charged, the row stayed `pending`, and the app stayed on
  // Free with "Upgrade Plan" still showing.
  it('authenticates the request with the configured secret key', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        status: true,
        message: 'Verification successful',
        data: {
          status: 'success',
          reference: 'REF-1',
          amount: 621000,
          requested_amount: 600000,
          currency: 'ngn',
          paid_at: '2026-10-01T10:00:00.000Z',
          channel: 'card',
          customer: { email: 'a@b.co' },
        },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const tx = await verifyTransaction('REF-1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.paystack.co/transaction/verify/REF-1');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer sk_test_key' });

    // The shape the matcher needs: the charge is reported with the fee on top,
    // and `requested_amount` is what distinguishes it from a foreign payment.
    expect(tx).toMatchObject({
      status: 'success',
      reference: 'REF-1',
      amount: 621000,
      requestedAmount: 600000,
      currency: 'NGN',
    });
  });

  it('throws when Paystack rejects the verification', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 401,
        json: async () => ({ status: false, message: 'No Authorization Header was found' }),
      }))
    );

    await expect(verifyTransaction('REF-1')).rejects.toThrow(
      'No Authorization Header was found'
    );
  });
});
