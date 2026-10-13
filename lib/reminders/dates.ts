/**
 * Calendar-date arithmetic for reminders, in UTC.
 *
 * Reminders are a question of "which calendar day is it", not "how many
 * milliseconds from now". Comparing `Date` timestamps gets this wrong at the
 * edges: a renewal stored as a DATE parses to midnight UTC, the current time is
 * somewhere mid-day, and rounding the difference can land a 10-day reminder on
 * day 9 or day 11 depending on the hour the cron happens to run. That is the
 * off-by-one this module exists to remove.
 *
 * Every function here works on `YYYY-MM-DD` strings and does its arithmetic with
 * `Date.UTC` on the parsed parts, so the server's local timezone never enters the
 * calculation.
 */

/** A calendar date with no time and no zone, as `YYYY-MM-DD`. */
export type IsoDate = string;

interface DateParts {
  year: number;
  month: number;
  day: number;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;

/** Parses the leading `YYYY-MM-DD` of a date or timestamp string. */
export function parseIsoDate(value: string | null | undefined): DateParts | null {
  if (!value) return null;
  const match = DATE_RE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/** UTC-midnight epoch millis for a `YYYY-MM-DD` string, or NaN if unparseable. */
function utcMidnightMs(value: string): number {
  const parts = parseIsoDate(value);
  if (!parts) return NaN;
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

function formatUtc(ms: number): IsoDate {
  const d = new Date(ms);
  const year = d.getUTCFullYear().toString().padStart(4, '0');
  const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = d.getUTCDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Today's calendar date in UTC. */
export function utcToday(now: Date = new Date()): IsoDate {
  return formatUtc(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** `date` shifted by `days` (may be negative), staying on calendar days. */
export function addDays(date: IsoDate, days: number): IsoDate {
  return formatUtc(utcMidnightMs(date) + days * 86400000);
}

/**
 * Whole calendar days from `from` to `to`. Positive when `to` is later.
 *
 * Both operands are normalised to UTC midnight first, so this is exact and
 * immune to the time of day the caller happens to run.
 */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  const a = utcMidnightMs(from);
  const b = utcMidnightMs(to);
  if (Number.isNaN(a) || Number.isNaN(b)) return NaN;
  return Math.round((b - a) / 86400000);
}

/** Days from `now` until `renewalDate`. 0 is today, negative is past. */
export function daysUntilRenewal(renewalDate: IsoDate, now: Date = new Date()): number {
  return daysBetween(utcToday(now), renewalDate);
}

/** The calendar day a reminder with `leadDays` should fire for a renewal. */
export function triggerDate(renewalDate: IsoDate, leadDays: number): IsoDate {
  return addDays(renewalDate, -leadDays);
}

/**
 * Whole (rounded) minutes from `now` until midnight UTC of `renewalDate`.
 *
 * A renewal is stored as a DATE with no time, so it is anchored to the start of
 * that calendar day in UTC. Positive is before the renewal, negative is after.
 * This is what lets a reminder fire at an hour offset (12h, 3h) rather than only
 * on a calendar day: the day is the anchor, the offset is measured in minutes.
 */
export function minutesUntilRenewal(renewalDate: IsoDate, now: Date = new Date()): number {
  const t = utcMidnightMs(renewalDate);
  if (Number.isNaN(t)) return NaN;
  return Math.round((t - now.getTime()) / 60000);
}

/** The calendar day a reminder with `leadMinutes` fires for a renewal. */
export function triggerDateFromMinutes(renewalDate: IsoDate, leadMinutes: number): IsoDate {
  return formatUtc(utcMidnightMs(renewalDate) - leadMinutes * 60000);
}
