export function addCycleToDate(isoDate: string, cycle: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return '';

  const date = new Date(Date.UTC(year, month - 1, day));

  /*
   * Cycles arrive from provider lists, imported receipts and old rows, so the
   * casing and wording vary ('Yearly', 'annual', 'year'). Normalize once:
   * anything that is not yearly/quarterly/weekly renews a month later.
   */
  const step = (cycle || '').trim().toLowerCase();
  const isYearly = step === 'yearly' || step === 'annual' || step === 'year';
  const isQuarterly = step === 'quarterly' || step === 'quarter';
  const isWeekly = step === 'weekly' || step === 'week';

  if (isYearly) {
    const lastDay = new Date(
      Date.UTC(date.getUTCFullYear() + 1, date.getUTCMonth() + 1, 0)
    ).getUTCDate();
    date.setUTCDate(1);
    date.setUTCFullYear(date.getUTCFullYear() + 1);
    date.setUTCDate(Math.min(day, lastDay));
    return date.toISOString().split('T')[0];
  }

  if (isQuarterly) {
    const targetMonth = date.getUTCMonth() + 3;
    const lastDay = new Date(
      Date.UTC(date.getUTCFullYear(), targetMonth + 1, 0)
    ).getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(targetMonth);
    date.setUTCDate(Math.min(day, lastDay));
    return date.toISOString().split('T')[0];
  }

  if (isWeekly) {
    date.setUTCDate(date.getUTCDate() + 7);
    return date.toISOString().split('T')[0];
  }

  const targetMonth = date.getUTCMonth() + 1;
  const lastDay = new Date(
    Date.UTC(date.getUTCFullYear(), targetMonth + 1, 0)
  ).getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(targetMonth);
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString().split('T')[0];
}
