/**
 * Monday 00:00 UTC of the week containing `date`.
 *
 * Used as an idempotency window rather than an ISO week label. The label is
 * correct but needs a date comparison a database cannot make against a string, so
 * the Monday boundary gives the same "once per week" guarantee with a plain `gte`
 * on a real timestamp.
 *
 * Lives outside its one caller's route module so it can be tested without
 * importing the route: importing the route pulls in `lib/env`, which throws at
 * load time when the environment has not been loaded.
 */
export function isoWeekStart(date: Date): string {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber);
  return target.toISOString();
}
