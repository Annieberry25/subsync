import { describe, it, expect } from 'vitest';
import { isoWeekStart } from '@/lib/utils/iso-week';

/**
 * The window the weekly-recap cron keys its idempotency marker on. A boundary
 * that did not reset each Monday would suppress the recap for the rest of the
 * week after one early run, and a boundary that moved between two runs of the
 * same week would let the same recap send twice.
 */
describe('isoWeekStart', () => {
  const weekStart = (iso: string) => isoWeekStart(new Date(`${iso}T12:00:00Z`));

  it('returns the Monday of the week containing a Wednesday', () => {
    expect(weekStart('2026-10-07')).toBe('2026-10-05T00:00:00.000Z');
  });

  it('returns the same day for a Monday', () => {
    expect(weekStart('2026-10-05')).toBe('2026-10-05T00:00:00.000Z');
  });

  it('rolls back to the previous Monday for a Sunday', () => {
    expect(weekStart('2026-10-11')).toBe('2026-10-05T00:00:00.000Z');
  });

  it('gives one Monday per calendar week, so a re-run cannot double-send', () => {
    expect(weekStart('2026-10-06')).toBe(weekStart('2026-10-11'));
  });

  it('advances by exactly seven days between weeks', () => {
    const thisWeek = new Date(weekStart('2026-10-07'));
    const nextWeek = new Date(weekStart('2026-10-14'));
    expect(nextWeek.getTime() - thisWeek.getTime()).toBe(7 * 86400000);
  });

  it('handles a date on a year boundary without crossing into the wrong year', () => {
    // 2027-01-01 is a Friday, so its week starts on 2026-12-28.
    expect(isoWeekStart(new Date('2027-01-01T12:00:00Z'))).toBe('2026-12-28T00:00:00.000Z');
  });

  it('is stable across times of day within the same UTC day', () => {
    expect(isoWeekStart(new Date('2026-10-07T00:00:01Z'))).toBe(
      isoWeekStart(new Date('2026-10-07T23:59:59Z'))
    );
  });
});
