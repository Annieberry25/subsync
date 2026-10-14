import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  sendPush: vi.fn(),
  isPushConfigured: vi.fn(() => true),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/email/send', () => ({ sendRenewalReminderEmail: mocks.sendEmail }));
vi.mock('@/lib/push/send', () => ({
  sendPushToUser: mocks.sendPush,
  isPushConfigured: mocks.isPushConfigured,
}));

import { runRenewalReminders } from '@/lib/reminders/run-reminders';

/**
 * A tiny stand-in for the Supabase query builder.
 *
 * The engine chains `.from(t).select().neq().gte().lte().limit()` and awaits the
 * result, so the mock has to be both chainable and thenable. `resultFor` sees the
 * method names and any write payload, which is enough to tell a read from a write
 * on the same table.
 */
function tableMock(resultFor: (calls: string[], writePayload: unknown) => unknown) {
  const calls: string[] = [];
  let writePayload: unknown;
  const builder: Record<string, unknown> = {};
  const methods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'neq', 'gte', 'lte', 'gt', 'lt', 'eq', 'in',
    'limit', 'order', 'single', 'maybeSingle', 'filter', 'or',
  ];
  for (const method of methods) {
    builder[method] = (...args: unknown[]) => {
      calls.push(method);
      if (method === 'insert' || method === 'upsert') writePayload = args[0];
      return builder;
    };
  }
  builder.then = (resolve: (value: unknown) => unknown) => resolve(resultFor(calls, writePayload));
  return builder;
}

interface DbState {
  subs: Array<Record<string, unknown>>;
  prefs: Array<Record<string, unknown>>;
  profiles: Array<Record<string, unknown>>;
  deliveries: Array<Record<string, unknown>>;
  inboxExisting: Array<Record<string, unknown>>;
}

const inserted = {
  inbox: [] as Array<Record<string, unknown>>,
  activity: [] as Array<Record<string, unknown>>,
  deliveries: [] as Array<Record<string, unknown>>,
};

function makeSupabase(state: DbState) {
  return {
    from(table: string) {
      if (table === 'subscriptions') return tableMock(() => ({ data: state.subs, error: null }));
      if (table === 'subscription_reminders') return tableMock(() => ({ data: state.prefs, error: null }));
      if (table === 'profiles') return tableMock(() => ({ data: state.profiles, error: null }));
      if (table === 'reminder_deliveries') {
        return tableMock((calls, payload) => {
          if (calls.includes('insert')) {
            inserted.deliveries.push(payload as Record<string, unknown>);
            return { data: { id: `claim-${inserted.deliveries.length}` }, error: null };
          }
          return { data: state.deliveries, error: null };
        });
      }
      if (table === 'activity_log') {
        return tableMock((_calls, payload) => {
          inserted.activity.push(payload as Record<string, unknown>);
          return { data: null, error: null };
        });
      }
      if (table === 'inbox_items') {
        return tableMock((calls, payload) => {
          if (calls.includes('insert')) {
            inserted.inbox.push(payload as Record<string, unknown>);
            return { data: null, error: null };
          }
          return { data: state.inboxExisting, error: null };
        });
      }
      return tableMock(() => ({ data: [], error: null }));
    },
  };
}

function baseState(): DbState {
  return {
    subs: [
      {
        id: 's1',
        user_id: 'u1',
        name: 'Netflix',
        price: 15.99,
        currency: 'USD',
        next_billing_date: '2026-10-14',
        status: 'active',
      },
    ],
    prefs: [],
    profiles: [{ id: 'u1', email: 'u1@example.com' }],
    deliveries: [],
    inboxExisting: [],
  };
}

beforeEach(() => {
  inserted.inbox.length = 0;
  inserted.activity.length = 0;
  inserted.deliveries.length = 0;
  mocks.sendEmail.mockReset();
  mocks.sendPush.mockReset();
  mocks.isPushConfigured.mockReturnValue(true);
});

/**
 * Renewal two days out at 39 hours, run at 09:00. At that point the 2-day stage
 * and the 10-day nudge are due and the 1-day stage is not, which keeps the
 * expected channel counts unambiguous.
 */
const RUN_AT = new Date('2026-10-12T09:00:00Z');

describe('runRenewalReminders — in-app inbox', () => {
  it('writes one inbox notice per due stage when the automatic reminder goes out by email', async () => {
    mocks.sendPush.mockResolvedValue({ sent: 0, failed: 0, removed: 0, skipped: true });
    mocks.sendEmail.mockResolvedValue({ ok: true });

    const report = await runRenewalReminders({
      supabase: makeSupabase(baseState()) as never,
      now: RUN_AT,
    });

    expect(report.emailsSent).toBe(1);
    expect(report.pushSent).toBe(0);
    // One notice for the 2d stage and one for the 10-day nudge: the inbox carries
    // each stage rather than collapsing the renewal to a single row.
    expect(inserted.inbox).toHaveLength(2);
    expect(inserted.inbox[0]).toMatchObject({
      user_id: 'u1',
      type: 'renewal',
      subscription_name: 'Netflix',
    });
    // The History feed is still mirrored separately.
    expect(inserted.activity).toHaveLength(1);
  });

  it('collapses an opt-in reminder into an automatic stage that already covers it', async () => {
    const state = baseState();
    state.prefs.push({
      subscription_id: 's1',
      email_enabled: true,
      email_lead_minutes: 2 * 24 * 60,
      push_enabled: false,
      push_lead_minutes: 2 * 24 * 60,
    });
    mocks.sendPush.mockResolvedValue({ sent: 0, failed: 0, removed: 0, skipped: true });
    mocks.sendEmail.mockResolvedValue({ ok: true });

    const report = await runRenewalReminders({
      supabase: makeSupabase(state) as never,
      now: RUN_AT,
    });

    // The opt-in chose the 2-day lead, which the automatic stage already sends, so
    // there is still exactly one email and no extra notice.
    expect(report.emailsSent).toBe(1);
    expect(inserted.inbox).toHaveLength(2);
  });

  it('does not duplicate a notice a later run already wrote for the renewal', async () => {
    const state = baseState();
    state.inboxExisting = [{ id: 'existing-notice' }];
    mocks.sendPush.mockResolvedValue({ sent: 0, failed: 0, removed: 0, skipped: true });
    mocks.sendEmail.mockResolvedValue({ ok: true });

    const report = await runRenewalReminders({
      supabase: makeSupabase(state) as never,
      now: RUN_AT,
    });

    expect(report.emailsSent).toBe(1);
    expect(inserted.inbox).toHaveLength(0);
  });

  it('still writes an inbox row when no external channel could deliver', async () => {
    mocks.sendPush.mockResolvedValue({ sent: 0, failed: 0, removed: 0, skipped: true });
    mocks.sendEmail.mockResolvedValue({ ok: false, skipped: true });

    const report = await runRenewalReminders({
      supabase: makeSupabase(baseState()) as never,
      now: RUN_AT,
    });

    // Nothing left the app, but the in-app inbox is itself a channel.
    expect(report.emailsSent).toBe(0);
    expect(report.pushSent).toBe(0);
    expect(inserted.inbox).toHaveLength(2);
    expect(inserted.inbox[0]).toMatchObject({ user_id: 'u1', type: 'renewal' });
  });

  it('writes nothing to the inbox on a dry run', async () => {
    mocks.sendPush.mockResolvedValue({ sent: 0, failed: 0, removed: 0, skipped: true });
    mocks.sendEmail.mockResolvedValue({ ok: true });

    await runRenewalReminders({
      supabase: makeSupabase(baseState()) as never,
      now: RUN_AT,
      dryRun: true,
    });

    expect(inserted.inbox).toHaveLength(0);
  });
});
