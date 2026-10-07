import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ingestReceiptDraft } from '@/lib/services/receipt-ingestion';
import type { ReceiptDraft } from '@/lib/services/receipt-discovery';

/**
 * The email-forwarding webhook is the only unbounded ingress in the system:
 * `maxEmailDiscoveryPerMonth` (0 for Free, 100 for Plus) was declared but never
 * enforced, so a forwarded-receipt flood was free. These tests pin the webhook
 * path against the monthly quota, the per-hour burst cap, and the Gmail-monitor
 * carve-out (which is bounded by its daily cron and must not consume the
 * account).
 */
const mocks = vi.hoisted(() => ({
  countEmailDiscoverySinceHours: vi.fn(async () => 0),
  countEmailDiscoveryThisMonth: vi.fn(async () => 0),
  recordEmailDiscovery: vi.fn(async () => {}),
}));

vi.mock('@/lib/services/email-discovery-usage', () => ({
  countEmailDiscoverySinceHours: mocks.countEmailDiscoverySinceHours,
  countEmailDiscoveryThisMonth: mocks.countEmailDiscoveryThisMonth,
  recordEmailDiscovery: mocks.recordEmailDiscovery,
}));

vi.mock('@/lib/services/subscription-service', () => ({
  getKnownProviderWebsite: () => null as string | null,
}));

vi.mock('@/lib/env', () => ({
  env: {
    get NEXT_PUBLIC_SUPABASE_URL() {
      return 'https://example.supabase.co';
    },
    get SUPABASE_SERVICE_ROLE_KEY() {
      return 'service-role-key';
    },
  },
}));

const DRAFT: ReceiptDraft = {
  name: 'Netflix',
  price: 15.49,
  currency: 'USD',
  billingCycle: 'monthly',
  category: 'Streaming',
  from: 'billing@netflix.com',
  subject: 'Your Netflix receipt',
  date: '2026-10-01T00:00:00.000Z',
};

interface AdminConfig {
  profile?: {
    plan_tier: string | null;
    plan_expires_at: string | null;
    is_admin: boolean;
  } | null;
  activeNames?: string[];
  activeCount?: number;
  sub?: { id: string; name: string; price: number; currency: string; provider_url: string | null } | null;
  subError?: { message: string } | null;
  item?: { id: string } | null;
  inboxError?: { message: string } | null;
}

function makeAdmin(cfg: AdminConfig) {
  let table = '';
  let selectArgs: unknown[] = [];
  let op = '';
  const builder = {
    from(t: string) {
      table = t;
      return builder;
    },
    select(...args: unknown[]) {
      selectArgs = args;
      return builder;
    },
    eq() {
      return builder;
    },
    not() {
      return builder;
    },
    limit() {
      return builder;
    },
    maybeSingle() {
      return builder;
    },
    single() {
      return builder;
    },
    insert() {
      op = 'insert';
      return builder;
    },
    then(resolve: (value: unknown) => void) {
      if (table === 'profiles') {
        resolve(
          cfg.profile
            ? { data: cfg.profile, error: null }
            : { data: null, error: { message: 'profile not found' } }
        );
        return;
      }
      if (op === 'insert' && table === 'subscriptions') {
        resolve(cfg.subError ? { data: null, error: cfg.subError } : { data: cfg.sub, error: null });
        return;
      }
      if (op === 'insert' && table === 'inbox_items') {
        resolve(
          cfg.inboxError ? { data: null, error: cfg.inboxError } : { data: cfg.item, error: null }
        );
        return;
      }
      if (table === 'subscriptions' && selectArgs.length > 1) {
        resolve({ count: cfg.activeCount ?? 0 });
        return;
      }
      if (table === 'subscriptions') {
        resolve({ data: (cfg.activeNames ?? []).map((name) => ({ name })) });
        return;
      }
      resolve({ data: [], error: null });
    },
  };
  return builder;
}

/** A successfully-ingestable setup: free skipped for the quota path, sub + inbox items present. */
function plusAdmin() {
  return makeAdmin({
    profile: { plan_tier: 'plus', plan_expires_at: '2099-01-01T00:00:00.000Z', is_admin: false },
    activeNames: [],
    activeCount: 0,
    sub: { id: 'sub-1', name: 'Netflix', price: 15.49, currency: 'USD', provider_url: null },
    item: { id: 'item-1' },
  });
}

beforeEach(() => {
  mocks.countEmailDiscoverySinceHours.mockReset();
  mocks.countEmailDiscoveryThisMonth.mockReset();
  mocks.recordEmailDiscovery.mockReset();
  mocks.countEmailDiscoverySinceHours.mockResolvedValue(0);
  mocks.countEmailDiscoveryThisMonth.mockResolvedValue(0);
  mocks.recordEmailDiscovery.mockResolvedValue(undefined);
});

describe('ingestReceiptDraft · email-forwarding quota', () => {
  it('blocks a Free user immediately: 0 forwarded receipts allowed per month', async () => {
    const admin = makeAdmin({
      profile: { plan_tier: null, plan_expires_at: null, is_admin: false },
    });

    const result = await ingestReceiptDraft(admin, 'user-1', DRAFT, 'Email Forwarding');

    expect(result.status).toBe('limit_reached');
    expect(result.error).toContain('0');
    expect(mocks.recordEmailDiscovery).not.toHaveBeenCalled();
  });

  it('lets a Plus user under the 100/month quota proceed and record the discovery', async () => {
    mocks.countEmailDiscoveryThisMonth.mockResolvedValue(5);

    const result = await ingestReceiptDraft(plusAdmin(), 'user-1', DRAFT, 'Email Forwarding');

    expect(result.status).toBe('created');
    expect(result.subscriptionId).toBe('sub-1');
    expect(mocks.recordEmailDiscovery).toHaveBeenCalledWith('user-1', 'email_forwarding');
  });

  it('returns limit_reached once the Plus user hits 100 forwarded receipts this month', async () => {
    mocks.countEmailDiscoveryThisMonth.mockResolvedValue(100);

    const result = await ingestReceiptDraft(plusAdmin(), 'user-1', DRAFT, 'Email Forwarding');

    expect(result.status).toBe('limit_reached');
    expect(mocks.recordEmailDiscovery).not.toHaveBeenCalled();
  });

  it('does not record the discovery when the insert fails', async () => {
    const admin = makeAdmin({
      profile: { plan_tier: 'plus', plan_expires_at: '2099-01-01T00:00:00.000Z', is_admin: false },
      subError: { message: 'constraint violation' },
    });

    const result = await ingestReceiptDraft(admin, 'user-1', DRAFT, 'Email Forwarding');

    expect(result.status).toBe('invalid');
    expect(mocks.recordEmailDiscovery).not.toHaveBeenCalled();
  });
});

describe('ingestReceiptDraft · burst limiter', () => {
  it('returns rate_limited when the 1-hour window is saturated', async () => {
    mocks.countEmailDiscoverySinceHours.mockResolvedValue(30);

    const result = await ingestReceiptDraft(plusAdmin(), 'user-1', DRAFT, 'Email Forwarding');

    expect(result.status).toBe('rate_limited');
    expect(mocks.recordEmailDiscovery).not.toHaveBeenCalled();
  });

  it('still checks the burst window first even when the monthly quota has headroom', async () => {
    mocks.countEmailDiscoverySinceHours.mockResolvedValue(45);

    const result = await ingestReceiptDraft(plusAdmin(), 'user-1', DRAFT, 'Email Forwarding');

    expect(result.status).toBe('rate_limited');
  });
});

describe('ingestReceiptDraft · Gmail monitoring is not conflated with the quota', () => {
  it('ignores the email-forwarding quota and does not consume the account', async () => {
    // A free user, but the source is the daily cron — the quota must not apply.
    mocks.countEmailDiscoveryThisMonth.mockResolvedValue(999);

    const admin = makeAdmin({
      profile: { plan_tier: null, plan_expires_at: null, is_admin: false },
      activeCount: 0,
      sub: { id: 'sub-1', name: 'Netflix', price: 15.49, currency: 'USD', provider_url: null },
      item: { id: 'item-1' },
    });

    const result = await ingestReceiptDraft(admin, 'user-1', DRAFT, 'Gmail Monitoring');

    expect(result.status).toBe('created');
    expect(mocks.countEmailDiscoveryThisMonth).not.toHaveBeenCalled();
    expect(mocks.recordEmailDiscovery).not.toHaveBeenCalled();
  });
});