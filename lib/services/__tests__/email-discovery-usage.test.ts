import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  countEmailDiscoveryThisMonth,
  countEmailDiscoverySinceHours,
  recordEmailDiscovery,
} from '@/lib/services/email-discovery-usage';

/**
 * `email_discovery_usage` backs two bounds on the inbound-email webhook: the
 * monthly `maxEmailDiscoveryPerMonth` quota and the per-hour burst limiter.
 * The table grants `SELECT`/`INSERT`/`DELETE` to `service_role` alone, so the
 * accounting has to happen through the admin client — a session-scoped read
 * would error and the quota would silently never trip. These tests pin that
 * everything goes through the service role and that the windows are computed
 * in UTC.
 */
const mocks = vi.hoisted(() => ({
  countResult: { count: 0, error: null as unknown },
  /** The userId the query was scoped to. */
  eqUserId: undefined as unknown,
  /** The `gte` lower bound the query used. */
  sinceValue: undefined as string | undefined,
  /** The row passed to `insert`. */
  insertRow: undefined as unknown,
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
      gte: (_column: string, value: string) => {
        mocks.sinceValue = value;
        return builder;
      },
      insert: (row: unknown) => {
        mocks.insertRow = row;
        return builder;
      },
      then: (resolve: (value: unknown) => unknown) => resolve(mocks.countResult),
    };
    return { from: () => builder };
  },
}));

beforeEach(() => {
  mocks.countResult = { count: 0, error: null };
  mocks.eqUserId = undefined;
  mocks.sinceValue = undefined;
  mocks.insertRow = undefined;
  mocks.usedAdminClient = false;
  mocks.serviceRoleKey = 'service-role-key';
});

describe('countEmailDiscoveryThisMonth', () => {
  it('reads through the service-role client, scoped to the user', async () => {
    await countEmailDiscoveryThisMonth('user-1');

    expect(mocks.usedAdminClient).toBe(true);
    expect(mocks.eqUserId).toBe('user-1');
  });

  it('returns the row count from the service-role read', async () => {
    mocks.countResult = { count: 7, error: null };

    await expect(countEmailDiscoveryThisMonth('user-1')).resolves.toBe(7);
  });

  it('fails open to zero when the service role key is missing', async () => {
    mocks.serviceRoleKey = undefined;

    await expect(countEmailDiscoveryThisMonth('user-1')).resolves.toBe(0);
    expect(mocks.usedAdminClient).toBe(false);
  });

  it('counts from the start of the current UTC month', async () => {
    await countEmailDiscoveryThisMonth('user-1', new Date('2026-09-30T23:59:59.000Z'));

    expect(mocks.sinceValue).toBe('2026-09-01T00:00:00.000Z');
  });
});

describe('countEmailDiscoverySinceHours', () => {
  it('computes the lower bound one hour before now, in UTC', async () => {
    await countEmailDiscoverySinceHours('user-1', 1, new Date('2026-10-01T12:00:00.000Z'));

    expect(mocks.sinceValue).toBe('2026-10-01T11:00:00.000Z');
  });

  it('fails open to zero when the service role key is missing', async () => {
    mocks.serviceRoleKey = undefined;

    await expect(countEmailDiscoverySinceHours('user-1', 1)).resolves.toBe(0);
    expect(mocks.usedAdminClient).toBe(false);
  });
});

describe('recordEmailDiscovery', () => {
  it('inserts the accounting row with the service role', async () => {
    mocks.countResult = { count: 0, error: null };
    await recordEmailDiscovery('user-1', 'email_forwarding');

    expect(mocks.usedAdminClient).toBe(true);
    expect(mocks.insertRow).toEqual({ user_id: 'user-1', source: 'email_forwarding' });
  });

  it('defaults the source to email_forwarding', async () => {
    await recordEmailDiscovery('user-1');

    expect(mocks.insertRow).toEqual({ user_id: 'user-1', source: 'email_forwarding' });
  });

  it('skips the write when the service role key is missing', async () => {
    mocks.serviceRoleKey = undefined;
    await recordEmailDiscovery('user-1');

    expect(mocks.usedAdminClient).toBe(false);
    expect(mocks.insertRow).toBeUndefined();
  });
});