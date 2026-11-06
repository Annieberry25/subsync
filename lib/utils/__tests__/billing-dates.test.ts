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

  it('keeps the same day of month for a monthly cycle (6 Nov -> 6 Dec)', () => {
    expect(addCycleToDate('2026-11-06', 'monthly')).toBe('2026-12-06');
    expect(addCycleToDate('2026-12-06', 'monthly')).toBe('2027-01-06');
  });

  it('keeps the same day for yearly, quarterly and weekly cycles from 6 Nov', () => {
    expect(addCycleToDate('2026-11-06', 'yearly')).toBe('2027-11-06');
    expect(addCycleToDate('2026-11-06', 'quarterly')).toBe('2027-02-06');
    expect(addCycleToDate('2026-11-06', 'weekly')).toBe('2026-11-13');
  });

  it('clamps leap-day and month-end starts', () => {
    expect(addCycleToDate('2028-02-29', 'yearly')).toBe('2029-02-28');
    expect(addCycleToDate('2028-01-31', 'monthly')).toBe('2028-02-29');
    expect(addCycleToDate('2026-11-30', 'quarterly')).toBe('2027-02-28');
  });
});
