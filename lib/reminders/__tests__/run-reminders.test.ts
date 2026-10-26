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
      // eq records its column and value so a mock can actually filter on it.
      // Without that, a user-scoped run would look like it covered everyone and
      // the scoping test could not tell a working filter from an ignored one.
      calls.push(method === 'eq' ? `eq:${String(args[0])}=${String(args[1])}` : method);
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
  /** Read renewal notices, used to gate the second call on the day before. */
  inboxRead: Array<Record<string, unknown>>;
}

const inserted = {
  inbox: [] as Array<Record<string, unknown>>,
  activity: [] as Array<Record<string, unknown>>,
  deliveries: [] as Array<Record<string, unknown>>,
};

function makeSupabase(state: DbState) {
  return {
    from(table: string) {
      if (table === 'subscriptions') {
        return tableMock((calls) => {
          // Honour an explicit user_id filter, so a scoped run is observably scoped.
          const scoped = calls.find((c) => c.startsWith('eq:user_id='));
          if (!scoped) return { data: state.subs, error: null };
          const wanted = scoped.slice('eq:user_id='.length);
          return { data: state.subs.filter((s) => s.user_id === wanted), error: null };
        });
      }
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
          // An eq on is_read distinguishes the "has the notice been opened"
          // lookup from the duplicate check for writing a notice.
          if (calls.includes('eq:is_read=true')) return { data: state.inboxRead, error: null };
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
    inboxRead: [],
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
  it('writes one inbox notice when the automatic reminder goes out by email', async () => {
    mocks.sendPush.mockResolvedValue({ sent: 0, failed: 0, removed: 0, skipped: true });
    mocks.sendEmail.mockResolvedValue({ ok: true });

    const report = await runRenewalReminders({
      supabase: makeSupabase(baseState()) as never,
      now: RUN_AT,
    });

    expect(report.emailsSent).toBe(1);
    expect(report.pushSent).toBe(0);
    // One notice: only the most urgent due stage is scheduled per channel, and
    // both channels of that single stage share the one notice.
    expect(inserted.inbox).toHaveLength(1);
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
    expect(inserted.inbox).toHaveLength(1);
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
    expect(inserted.inbox).toHaveLength(1);
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

/**
 * The second call on the day before is the last thing standing between a user
 * and an unannounced charge. It used to be withheld when the earlier in-app
 * notice had been opened — a proxy for "they saw it" that cannot detect a push
 * the device accepted and never displayed. It is now gated only on the
 * subscription still being active.
 */
describe('runRenewalReminders — second call gate', () => {
  const EVENING = new Date('2026-10-13T21:00:00Z');

  it('sends the second call when the renewal notice has not been read', async () => {
    mocks.sendPush.mockResolvedValue({ sent: 1, failed: 0, removed: 0, skipped: false });
    mocks.sendEmail.mockResolvedValue({ ok: true });

    const report = await runRenewalReminders({
      supabase: makeSupabase(baseState()) as never,
      now: EVENING,
    });

    expect(report.items.some((i) => i.leadMinutes === 720 && i.channel === 'push')).toBe(true);
    expect(report.items.some((i) => i.reason === 'subscription_not_active')).toBe(false);
  });

  it('still sends the second call when the earlier notice was already opened', async () => {
    // The regression this covers: a read inbox row used to silence the final
    // warning, which is how a charge could arrive with nothing delivered.
    const state = baseState();
    state.inboxRead = [{ id: 'already-read' }];
    mocks.sendPush.mockResolvedValue({ sent: 1, failed: 0, removed: 0, skipped: false });
    mocks.sendEmail.mockResolvedValue({ ok: true });

    const report = await runRenewalReminders({
      supabase: makeSupabase(state) as never,
      now: EVENING,
    });

    expect(report.items.some((i) => i.reason === 'renewal_notice_already_read')).toBe(false);
    expect(report.items.some((i) => i.leadMinutes === 720 && i.action === 'sent')).toBe(true);
  });

  it('withholds the second call when the subscription is no longer active', async () => {
    const state = baseState();
    state.subs = [{ ...state.subs[0], status: 'paused' }];
    mocks.sendPush.mockResolvedValue({ sent: 1, failed: 0, removed: 0, skipped: false });
    mocks.sendEmail.mockResolvedValue({ ok: true });

    const report = await runRenewalReminders({
      supabase: makeSupabase(state) as never,
      now: EVENING,
    });

    expect(report.items.some((i) => i.reason === 'subscription_not_active')).toBe(true);
    expect(report.items.some((i) => i.leadMinutes === 720 && i.action === 'sent')).toBe(false);
  });
});

/**
 * A user-triggered run is reachable from the browser, so the scoping is the only
 * thing standing between one account and another's notifications. It has to be a
 * filter on the query, not a post-filter, or a later code change could reintroduce
 * a leak without any test noticing.
 */
describe('runRenewalReminders — user scoping', () => {
  it('covers only the requested account when scoped', async () => {
    const state = baseState();
    state.subs = [
      { ...state.subs[0], id: 'mine', user_id: 'u1', name: 'Mine' },
      { ...state.subs[0], id: 'theirs', user_id: 'u2', name: 'Theirs' },
    ];
    state.profiles = [
      { id: 'u1', email: 'u1@example.com' },
      { id: 'u2', email: 'u2@example.com' },
    ];
    mocks.sendPush.mockResolvedValue({ sent: 0, failed: 0, removed: 0, skipped: true });
    mocks.sendEmail.mockResolvedValue({ ok: true });

    const report = await runRenewalReminders({
      supabase: makeSupabase(state) as never,
      now: RUN_AT,
      userId: 'u1',
    });

    expect(report.considered).toBe(1);
    expect(report.items.every((i) => i.name === 'Mine')).toBe(true);
    expect(inserted.deliveries.every((d) => d.user_id === 'u1')).toBe(true);
  });

  it('covers every account when no scope is given', async () => {
    const state = baseState();
    state.subs = [
      { ...state.subs[0], id: 'mine', user_id: 'u1', name: 'Mine' },
      { ...state.subs[0], id: 'theirs', user_id: 'u2', name: 'Theirs' },
    ];
    state.profiles = [
      { id: 'u1', email: 'u1@example.com' },
      { id: 'u2', email: 'u2@example.com' },
    ];
    mocks.sendPush.mockResolvedValue({ sent: 0, failed: 0, removed: 0, skipped: true });
    mocks.sendEmail.mockResolvedValue({ ok: true });

    const report = await runRenewalReminders({
      supabase: makeSupabase(state) as never,
      now: RUN_AT,
    });

    expect(report.considered).toBe(2);
  });
});

/*
 * The repayment day itself: the charge's own date speaks — one push to wake
 * the day, the day's single email, one more push twelve hours later — and a
 * paused row is not warned about its own charge.
 */
describe('runRenewalReminders — the repayment day', () => {
  it('sends one push and the email at the morning run, one more push twelve hours later', async () => {
    const state = baseState();
    state.subs = [{ ...state.subs[0], next_billing_date: '2026-10-12' }];
    mocks.sendPush.mockResolvedValue({ sent: 1, failed: 0, removed: 0, skipped: false });
    mocks.sendEmail.mockResolvedValue({ ok: true });

    const morning = await runRenewalReminders({
      supabase: makeSupabase(state) as never,
      now: new Date('2026-10-12T09:00:00Z'),
    });

    expect(morning.pushSent).toBe(1);
    expect(morning.emailsSent).toBe(1);
    expect((mocks.sendPush.mock.calls[0]?.[1] as { title?: string }).title).toBe(
      'Netflix renews today'
    );

    // The morning's claims persist for the evening run, as they would in the
    // ledger.
    state.deliveries = inserted.deliveries.map((d) => ({ ...d }));

    const evening = await runRenewalReminders({
      supabase: makeSupabase(state) as never,
      now: new Date('2026-10-12T21:00:00Z'),
    });

    expect(evening.pushSent).toBe(1);
    expect(evening.emailsSent).toBe(0);
    expect((mocks.sendPush.mock.calls[1]?.[1] as { url?: string }).url).toContain(
      'highlight='
    );
  });

  it('says nothing on the day of the charge for a subscription that cannot charge', async () => {
    const state = baseState();
    state.subs = [{ ...state.subs[0], next_billing_date: '2026-10-12', status: 'paused' }];
    mocks.sendPush.mockResolvedValue({ sent: 1, failed: 0, removed: 0, skipped: false });
    mocks.sendEmail.mockResolvedValue({ ok: true });

    const report = await runRenewalReminders({
      supabase: makeSupabase(state) as never,
      now: new Date('2026-10-12T09:00:00Z'),
    });

    expect(report.pushSent).toBe(0);
    expect(report.emailsSent).toBe(0);
    expect(report.items.some((i) => i.reason === 'subscription_not_active')).toBe(true);
  });
});

/*
 * The overdue stages: a lapsed renewal is pushed once a day — one row per day
 * in the ledger — and emailed once for the lapse. Past the horizon the engine
 * does not even fetch the row.
 */
describe('runRenewalReminders — overdue', () => {
  it('pushes every overdue day and emails once for the lapse', async () => {
    const state = baseState();
    // 11 days overdue at the first run: echoes of an old Apex bill.
    state.subs = [{ ...state.subs[0], next_billing_date: '2026-10-01' }];
    mocks.sendPush.mockResolvedValue({ sent: 1, failed: 0, removed: 0, skipped: false });
    mocks.sendEmail.mockResolvedValue({ ok: true });

    const firstDay = await runRenewalReminders({
      supabase: makeSupabase(state) as never,
      now: new Date('2026-10-12T09:00:00Z'),
    });

    expect(firstDay.pushSent).toBe(1);
    expect(firstDay.emailsSent).toBe(1);
    expect((mocks.sendPush.mock.calls[0]?.[1] as { title?: string }).title).toBe(
      'Netflix is overdue'
    );

    state.deliveries = inserted.deliveries.map((d) => ({ ...d }));

    const nextDay = await runRenewalReminders({
      supabase: makeSupabase(state) as never,
      now: new Date('2026-10-13T09:00:00Z'),
    });

    expect(nextDay.pushSent).toBe(1);
    expect(nextDay.emailsSent).toBe(0);
  });

  it('does not wake a lapse that runs past the horizon', async () => {
    const state = baseState();
    // 2026-09-12 is 31 days before the run below: beyond the planner's thirty-
    // day overdue horizon (the query floor keeps most of those rows out too,
    // but the planner is the hard gate).
    state.subs = [{ ...state.subs[0], next_billing_date: '2026-09-12' }];
    mocks.sendPush.mockResolvedValue({ sent: 1, failed: 0, removed: 0, skipped: false });
    mocks.sendEmail.mockResolvedValue({ ok: true });

    const report = await runRenewalReminders({
      supabase: makeSupabase(state) as never,
      now: new Date('2026-10-13T09:00:00Z'),
    });

    expect(report.pushSent).toBe(0);
    expect(report.emailsSent).toBe(0);
    // The run's own trace only explains itself (renewal_passed); nothing was
    // scheduled to send.
    expect(report.items.some((i) => i.action === 'sent' || i.action === 'would_send')).toBe(false);
    expect(inserted.inbox).toHaveLength(0);
  });
});
