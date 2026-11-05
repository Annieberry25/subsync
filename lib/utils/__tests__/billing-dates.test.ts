import { describe, it, expect } from 'vitest';
import { addCycleToDate, resolveRenewalDate } from '@/lib/utils/billing-dates';

describe('resolveRenewalDate', () => {
  it('prefers the stored renewal date over a cycle after an old start date', () => {
    expect(
      resolveRenewalDate({
        start_date: '2026-01-01',
        billing_cycle: 'monthly',
        next_billing_date: '2026-10-14',
      })
    ).toBe('2026-10-14');
  });

  it('computes a cycle after the start when no renewal is stored', () => {
    expect(
      resolveRenewalDate({
        start_date: '2026-09-03',
        billing_cycle: 'monthly',
        next_billing_date: null,
      })
    ).toBe('2026-10-03');
  });

  it('falls back to the stored date when the stored value is unusable', () => {
    expect(
      resolveRenewalDate({
        start_date: '2026-09-03',
        billing_cycle: 'monthly',
        next_billing_date: 'not-a-date',
      })
    ).toBe('2026-10-03');
  });

  it('returns an empty string when there is no date to answer with', () => {
    expect(resolveRenewalDate({})).toBe('');
  });
});

describe('addCycleToDate', () => {
  it('handles a month-end start without overflowing', () => {
    expect(addCycleToDate('2026-01-31', 'monthly')).toBe('2026-02-28');
  });

  it('handles yearly and quarterly cycles', () => {
    expect(addCycleToDate('2026-02-01', 'yearly')).toBe('2027-02-01');
    expect(addCycleToDate('2026-02-01', 'quarterly')).toBe('2026-05-01');
  });
});
