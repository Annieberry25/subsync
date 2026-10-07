import { describe, it, expect } from 'vitest';
import { generateTransactionReference, resolvePublicOrigin } from '@/lib/paystack';

describe('generateTransactionReference', () => {
  // Paystack rejects references outside [A-Za-z0-9.-=] with "Invalid character
  // in transaction reference". Underscore separators used to be generated here,
  // which makes the reference Paystack reports back diverge from the row we
  // stored — the callback then cannot find the payment at all.
  it('uses only characters Paystack accepts', () => {
    const reference = generateTransactionReference('550e8400-e29b-41d4-a716-446655440000');

    expect(reference).toMatch(/^[A-Za-z0-9.=-]+$/);
    expect(reference.startsWith('SUBHALT-')).toBe(true);
  });

  it('keeps a fragment of the user id and is unique per call', () => {
    const first = generateTransactionReference('550e8400-e29b-41d4-a716-446655440000');
    const second = generateTransactionReference('550e8400-e29b-41d4-a716-446655440000');

    expect(first).toContain('550e8400e29b');
    expect(first).not.toBe(second);
  });
});

describe('resolvePublicOrigin', () => {
  it('prefers forwarded headers so a proxied request returns to the public host', () => {
    const request = new Request('https://internal:3000/api/paystack/initialize', {
      headers: {
        'x-forwarded-host': 'subhalt.xyz',
        'x-forwarded-proto': 'https',
      },
    });

    expect(resolvePublicOrigin(request)).toBe('https://subhalt.xyz');
  });

  it('falls back to the request URL when nothing is forwarded', () => {
    const request = new Request('http://localhost:3000/api/paystack/initialize');

    expect(resolvePublicOrigin(request)).toBe('http://localhost:3000');
  });

  it('returns the configured site URL when the URL cannot be parsed', () => {
    const request = { headers: new Headers(), url: 'not-a-url' } as unknown as Request;

    expect(resolvePublicOrigin(request)).toMatch(/^https:\/\//);
  });
});
