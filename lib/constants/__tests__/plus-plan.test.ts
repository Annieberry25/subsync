import { describe, it, expect } from 'vitest';
import { buildPlusSubscriptionRecord, PLUS_PLAN } from '@/lib/constants/plus-plan';

describe('buildPlusSubscriptionRecord', () => {
  it('keys next billing to the real plan expiry', () => {
    const record = buildPlusSubscriptionRecord({
      paidAt: new Date('2026-10-01T10:00:00.000Z'),
      expiresAt: '2026-11-06T12:26:41.000Z',
    });

    expect(record).toMatchObject({
      name: 'SubHalt',
      price: PLUS_PLAN.price,
      currency: PLUS_PLAN.currency,
      start_date: '2026-10-01',
      next_billing_date: '2026-11-06',
      status: 'active',
      billing_cycle: 'monthly',
      category: 'Software',
    });
  });

  it('falls back to the plan duration when no expiry is known', () => {
    const record = buildPlusSubscriptionRecord({
      paidAt: new Date('2026-10-01T10:00:00.000Z'),
    });

    expect(record.next_billing_date).toBe('2026-10-31');
  });

  it('treats an unparseable expiry as unknown', () => {
    const record = buildPlusSubscriptionRecord({
      paidAt: new Date('2026-10-01T10:00:00.000Z'),
      expiresAt: 'not-a-date',
    });

    expect(record.next_billing_date).toBe('2026-10-31');
  });

  it('keeps the notes readable in the Plan column', () => {
    const record = buildPlusSubscriptionRecord({});

    expect(record.notes).toBe('SubHalt Plus (monthly)');
    expect(record.payment_method).toBe('Card');
    expect(record.provider_url).toMatch(/^https?:\/\//);
  });
});
