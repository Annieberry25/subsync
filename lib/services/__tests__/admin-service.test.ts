import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAdminOverview } from '@/lib/services/admin-service';

/**
 * `getAdminOverview` reads many tables through the service-role client. The
 * plan-status tiles used to call the unfiltered `count()` helper three times,
 * which made Paid/Pending/Failed all report the total number of plan rows.
 * These tests pin the per-status filtering, since the overview is the first
 * screen an admin opens and the wrong numbers still look plausible.
 */
type EqFilter = { column: string; value: unknown };

const mocks = vi.hoisted(() => ({
  /** Rows matched per `table` + `eq` filter, keyed as `table:value`. */
  counts: {} as Record<string, { count: number; error: unknown }>,
  eqCalls: [] as Array<{ table: string; filters: EqFilter[] }>,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const filters: EqFilter[] = [];
      // `select('id', { count: 'exact', head: true })` is a count query and
      // needs a `count` back; a plain `select('amount')` needs `data` rows.
      let isCountQuery = false;
      const builder = {
        select: (...args: unknown[]) => {
          isCountQuery = args.some(
            (a) => typeof a === 'object' && a !== null && 'count' in (a as Record<string, unknown>)
          );
          return builder;
        },
        eq: (column: string, value: unknown) => {
          filters.push({ column, value });
          return builder;
        },
        gte: () => builder,
        in: () => builder,
        order: () => builder,
        limit: () => builder,
        then: (resolve: (value: unknown) => unknown) => {
          mocks.eqCalls.push({ table, filters: [...filters] });
          if (!isCountQuery) return resolve({ data: [], error: null });

          const last = filters[filters.length - 1];
          const key = last ? `${table}:${String(last.value)}` : table;
          const hit = mocks.counts[key] ?? { count: 0, error: null };
          return resolve({ data: null, count: hit.count, error: hit.error });
        },
      };
      return builder;
    },
  }),
}));

vi.mock('@/lib/paystack/grants', () => ({ downgradeUserToFree: vi.fn() }));

beforeEach(() => {
  mocks.counts = {};
  mocks.eqCalls = [];
  mocks.counts['plan_subscriptions'] = { count: 9, error: null };
  mocks.counts['profiles'] = { count: 4, error: null };
  mocks.counts['plan_subscriptions:paid'] = { count: 5, error: null };
  mocks.counts['plan_subscriptions:pending'] = { count: 3, error: null };
  mocks.counts['plan_subscriptions:failed'] = { count: 1, error: null };
});

describe('getAdminOverview plan-status tiles', () => {
  it('counts each status separately instead of repeating the total', async () => {
    const overview = await getAdminOverview();

    expect(overview.paidPlans).toBe(5);
    expect(overview.pendingPlans).toBe(3);
    expect(overview.failedPlans).toBe(1);
    // None of the three may fall back to the 9 unfiltered plan rows.
    expect(new Set([overview.paidPlans, overview.pendingPlans, overview.failedPlans]).size).toBe(3);
    expect(overview.totalPlanSubscriptions).toBe(9);
  });

  it('queries plan_subscriptions with the expected status filter', async () => {
    await getAdminOverview();

    const planFilters = mocks.eqCalls
      .filter((c) => c.table === 'plan_subscriptions')
      .map((c) => c.filters.find((f) => f.column === 'status')?.value);

    expect(planFilters).toEqual(expect.arrayContaining(['paid', 'pending', 'failed']));
  });

  it('degrades to zero for a status whose count errors', async () => {
    mocks.counts['plan_subscriptions:failed'] = { count: 0, error: { message: 'boom' } };

    const overview = await getAdminOverview();

    expect(overview.failedPlans).toBe(0);
    // The other tiles are unaffected by one failing query.
    expect(overview.paidPlans).toBe(5);
  });
});
