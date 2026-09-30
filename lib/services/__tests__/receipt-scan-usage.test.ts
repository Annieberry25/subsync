import { describe, it, expect, beforeEach, vi } from 'vitest';
import { countReceiptScansThisMonth, startOfCurrentMonthUtc } from '@/lib/services/receipt-scan-usage';

/**
 * The receipt-scan quota was declared in the plan limits and enforced by
 * `/api/receipts/extract`, but the count was read through the caller's
 * RLS-scoped session client while `receipt_scan_usage` grants `SELECT` to
 * `service_role` alone. Every read failed with a permission error, the
 * function failed open to `0`, and the quota never tripped: free accounts
 * could make unbounded provider-backed vision calls.
 *
 * These tests pin that the read goes through the service role and that the
 * month boundary is computed in UTC.
 */
const mocks = vi.hoisted(() => ({
  countResult: { count: 0, error: null as unknown },
  /** The userId the read was scoped to. */
  eqUserId: undefined as unknown,
  /** The client handed to the query chain. */
  usedAdminClient: false,
  serviceRoleKey: 'service-role-key' as string | undefined,
}));

vi.mock('@/lib/env', () => ({
  env: {
    get NEXT_PUBLIC_SUPABASE_URL() {
      return 'https://example.supabase.co';
    },
    get SUPABASE_SERVICE_ROLE_KEY() {
      return mocks.serviceRoleKey;
    },
  },
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    mocks.usedAdminClient = true;
    const builder = {
      select: () => builder,
      eq: (_column: string, value: unknown) => {
        mocks.eqUserId = value;
        return builder;
      },
      gte: () => builder,
      then: (resolve: (value: unknown) => unknown) => resolve(mocks.countResult),
    };
    return { from: () => builder };
  },
}));

beforeEach(() => {
  mocks.countResult = { count: 0, error: null };
  mocks.eqUserId = undefined;
  mocks.usedAdminClient = false;
  mocks.serviceRoleKey = 'service-role-key';
});

describe('countReceiptScansThisMonth', () => {
  it('reads through the service-role client, not the session client', async () => {
    await countReceiptScansThisMonth('user-1');

    expect(mocks.usedAdminClient).toBe(true);
    // The quota row is scoped to the verified user, never to request input.
    expect(mocks.eqUserId).toBe('user-1');
  });

  it('returns the row count from the service-role read', async () => {
    mocks.countResult = { count: 7, error: null };

    await expect(countReceiptScansThisMonth('user-1')).resolves.toBe(7);
  });

  it('fails open to zero when the service role key is missing', async () => {
    mocks.serviceRoleKey = undefined;

    await expect(countReceiptScansThisMonth('user-1')).resolves.toBe(0);
    // It must not silently fall back to the session client, which cannot read.
    expect(mocks.usedAdminClient).toBe(false);
  });

  it('fails open to zero when the count errors', async () => {
    mocks.serviceRoleKey = 'service-role-key';
    mocks.countResult = { count: 0, error: { message: 'permission denied' } };

    await expect(countReceiptScansThisMonth('user-1')).resolves.toBe(0);
    // The read was actually attempted; the zero came from the error path.
    expect(mocks.usedAdminClient).toBe(true);
  });

  it('counts from the start of the current UTC month', async () => {
    const now = new Date('2026-09-30T23:59:59.000Z');

    expect(startOfCurrentMonthUtc(now)).toBe('2026-09-01T00:00:00.000Z');
  });

  it('treats a month boundary in UTC, not local time', () => {
    // 00:30 on the 1st in UTC is still the previous month west of Greenwich.
    expect(startOfCurrentMonthUtc(new Date('2026-10-01T00:30:00.000Z'))).toBe(
      '2026-10-01T00:00:00.000Z'
    );
  });
});
