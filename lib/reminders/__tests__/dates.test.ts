import { describe, it, expect } from 'vitest';
import {
  addDays,
  daysBetween,
  daysUntilRenewal,
  minutesUntilRenewal,
  parseIsoDate,
  triggerDateFromMinutes,
  utcToday,
} from '@/lib/reminders/dates';

/**
 * The point of these helpers is that the answer does not depend on the hour the
 * cron happens to run, so the tests deliberately pin times at both ends of a UTC
 * day and across month/year boundaries.
 */
describe('reminder date helpers', () => {
  it('parses the leading date of a date or timestamp string', () => {
    expect(parseIsoDate('2026-10-21')).toEqual({ year: 2026, month: 10, day: 21 });
    expect(parseIsoDate('2026-10-21T15:30:00.000Z')).toEqual({
      year: 2026,
      month: 10,
      day: 21,
    });
    expect(parseIsoDate(null)).toBeNull();
    expect(parseIsoDate('not-a-date')).toBeNull();
  });

  it('reports today in UTC regardless of the clock time', () => {
    expect(utcToday(new Date('2026-03-01T00:00:01Z'))).toBe('2026-03-01');
    expect(utcToday(new Date('2026-03-01T23:59:59Z'))).toBe('2026-03-01');
  });

  it('adds and subtracts days across month and year boundaries', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-09', 10)).toBe('2026-03-19');
  });

  it('counts whole calendar days, not elapsed time', () => {
    expect(daysBetween('2026-03-01', '2026-03-11')).toBe(10);
    expect(daysBetween('2026-03-11', '2026-03-01')).toBe(-10);
    expect(daysBetween('2026-03-01', '2026-03-01')).toBe(0);
  });

  it('gives the same day count at midnight and at 23:59', () => {
    const renewal = '2026-03-11';
    expect(daysUntilRenewal(renewal, new Date('2026-03-01T00:00:00Z'))).toBe(10);
    expect(daysUntilRenewal(renewal, new Date('2026-03-01T23:59:59Z'))).toBe(10);
  });

  it('derives the trigger day from the lead offset', () => {
    expect(addDays('2026-03-11', -10)).toBe('2026-03-01');
    expect(addDays('2026-03-11', -3)).toBe('2026-03-08');
  });

  it('measures minutes to a renewal anchored at midnight UTC', () => {
    const renewal = '2026-03-11';
    expect(minutesUntilRenewal(renewal, new Date('2026-03-10T12:00:00Z'))).toBe(720);
    expect(minutesUntilRenewal(renewal, new Date('2026-03-11T00:00:00Z'))).toBe(0);
    expect(minutesUntilRenewal(renewal, new Date('2026-03-11T03:00:00Z'))).toBe(-180);
  });

  it('derives the trigger day from a minute lead', () => {
    expect(triggerDateFromMinutes('2026-03-11', 1440)).toBe('2026-03-10');
    expect(triggerDateFromMinutes('2026-03-11', 720)).toBe('2026-03-10');
    expect(triggerDateFromMinutes('2026-03-11', 180)).toBe('2026-03-10');
  });
});
