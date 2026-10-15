import { describe, it, expect } from 'vitest';
import {
  planReminders,
  deliveryKey,
  autoLeadMinutesFor,
  AUTO_LEAD_MINUTES_MONTHLY,
  AUTO_LEAD_MINUTES_ANNUAL,
UPCOMING_LEAD_MINUTES,
  SECOND_CALL_LEAD_MINUTES,
  DEFAULT_USER_LEAD_MINUTES,
  type PlannerSubscription,
  type PlannerPreference,
} from '@/lib/reminders/plan';

const NOW = new Date('2026-03-01T12:00:00Z');
const DAY = 24 * 60;

function run(
  subs: PlannerSubscription[],
  prefs: PlannerPreference[],
  delivered: string[] = [],
  now: Date = NOW
) {
  return planReminders({
    subscriptions: subs,
    preferences: new Map(prefs.map((p) => [p.subscriptionId, p])),
    alreadyDelivered: new Set(delivered),
    now,
  });
}

function sub(
  id: string,
  renewalDate: string,
  billingCycle = 'monthly'
): PlannerSubscription {
  return { id, userId: 'u1', name: 'Netflix', price: 10, currency: 'USD', renewalDate, billingCycle };
}

function pref(overrides: Partial<PlannerPreference> = {}): PlannerPreference {
  return {
    subscriptionId: 's1',
    pushEnabled: false,
    pushLeadMinutes: DEFAULT_USER_LEAD_MINUTES,
    emailEnabled: false,
    emailLeadMinutes: DEFAULT_USER_LEAD_MINUTES,
    ...overrides,
  };
}

describe('autoLeadMinutesFor', () => {
  it('stages monthly renewals at 2 days and 1 day', () => {
    expect(autoLeadMinutesFor('monthly')).toEqual([...AUTO_LEAD_MINUTES_MONTHLY]);
    expect(AUTO_LEAD_MINUTES_MONTHLY).toEqual([2 * DAY, 1 * DAY]);
  });

  it('stages annual renewals at 7 days and 1 day', () => {
    expect(autoLeadMinutesFor('yearly')).toEqual([...AUTO_LEAD_MINUTES_ANNUAL]);
    expect(autoLeadMinutesFor('annual')).toEqual([...AUTO_LEAD_MINUTES_ANNUAL]);
    expect(AUTO_LEAD_MINUTES_ANNUAL).toEqual([7 * DAY, 1 * DAY]);
  });

  /**
   * Only the two cycle names the app stores are treated as annual. An unknown or
   * missing cycle falls back to the monthly set rather than silently widening the
   * notice for a row whose cycle was never set.
   */
  it('falls back to the monthly set for anything else', () => {
    expect(autoLeadMinutesFor('quarterly')).toEqual([2 * DAY, 1 * DAY]);
    expect(autoLeadMinutesFor('')).toEqual([2 * DAY, 1 * DAY]);
    expect(autoLeadMinutesFor(null)).toEqual([2 * DAY, 1 * DAY]);
  });
});

describe('planReminders (automatic stages)', () => {
  /**
   * Stages are separated by the daily cron, not by the window alone: the engine
   * treats any run inside a lead window as due (the catch-up rule), so on the day
   * a stage fires, every *later* stage would also read as due. The delivery
   * ledger is what stops them piling up — the 2d stage is recorded, so the next
   * day's run only owes the 1d stage.
   */
  const RENEWAL = '2026-03-05';
  const TWO_DAYS_OUT = new Date('2026-03-03T09:00:00Z');
  const ONE_DAY_OUT = new Date('2026-03-04T09:00:00Z');

  it('sends the 2-day monthly stage on push and email', () => {
    const { planned } = run([sub('s1', RENEWAL)], [], [], TWO_DAYS_OUT);

    const auto = planned.filter((p) => p.leadMinutes === 2 * DAY);
    expect(auto.map((p) => p.channel).sort()).toEqual(['email', 'push']);
  });

  /**
   * Ten days out on a daily cron, the 10-day nudge is the only thing due, so it
   * wins on its own channel. Later, once a closer stage is due, it is superseded
   * instead of arriving late.
   */
  it('sends the 10-day nudge on push only', () => {
    const { planned } = run([sub('s1', '2026-03-11')], [], [], new Date('2026-03-01T09:00:00Z'));

    expect(planned.filter((p) => p.leadMinutes === UPCOMING_LEAD_MINUTES).map((p) => p.channel)).toEqual([
      'push',
    ]);
    expect(planned.some((p) => p.channel === 'email')).toBe(false);
  });

  it('sends only the 1-day push the next day, the single automatic email already went at 2 days', () => {
    const twoDayKey = deliveryKey('s1', RENEWAL, 2 * DAY, 'push');
    const twoDayEmailKey = deliveryKey('s1', RENEWAL, 2 * DAY, 'email');
    const upcomingKey = deliveryKey('s1', RENEWAL, UPCOMING_LEAD_MINUTES, 'push');

    const { planned, skipped } = run(
      [sub('s1', RENEWAL)],
      [],
      [twoDayKey, twoDayEmailKey, upcomingKey],
      ONE_DAY_OUT
    );

    // The automatic email is a single send at the earliest stage, so there is no
    // second automatic email waiting at the 1-day mark.
    expect(planned.map((p) => p.leadMinutes)).toEqual([1 * DAY]);
    expect(planned.map((p) => p.channel)).toEqual(['push']);
    expect(
      skipped
        .filter((s) => s.reason === 'already_delivered')
        .map((s) => s.leadMinutes)
        .sort((a, b) => a - b)
    ).toEqual([2 * DAY, 2 * DAY, UPCOMING_LEAD_MINUTES]);
  });

  it('uses the annual stages for an annual subscription', () => {
    const { planned } = run([sub('s1', '2026-03-10', 'yearly')], [], [], new Date('2026-03-03T09:00:00Z'));

    const annual = planned.filter((p) => p.leadMinutes === 7 * DAY);
    expect(annual.map((p) => p.channel).sort()).toEqual(['email', 'push']);
    // The monthly-only 2d stage must not fire for an annual charge.
    expect(planned.some((p) => p.leadMinutes === 2 * DAY)).toBe(false);
  });

  it('never re-sends a stage already delivered for this renewal', () => {
    const key = deliveryKey('s1', RENEWAL, 2 * DAY, 'push');
    const { planned, skipped } = run([sub('s1', RENEWAL)], [], [key], TWO_DAYS_OUT);

    expect(planned.some((p) => p.leadMinutes === 2 * DAY && p.channel === 'push')).toBe(false);
    expect(skipped.find((s) => s.leadMinutes === 2 * DAY && s.channel === 'push')?.reason).toBe(
      'already_delivered'
    );
  });

  /**
   * The burst this prevents. With every stage's window open at once the engine
   * planned all of them, which delivered five notifications for one charge and a
   * "10 days before" push the day before the charge.
   */
  it('sends only the most urgent stage when several windows are open at once', () => {
    const { planned, skipped } = run([sub('s1', RENEWAL)], [], [], TWO_DAYS_OUT);

    expect(planned.map((p) => [p.leadMinutes, p.channel])).toEqual([
      [2 * DAY, 'push'],
      [2 * DAY, 'email'],
    ]);

    // The 10-day nudge is dropped, and reported as superseded rather than silently
    // vanishing.
    const superseded = skipped.filter((s) => s.reason === 'superseded_by_closer_stage');
    expect(superseded.map((s) => s.leadMinutes)).toEqual([UPCOMING_LEAD_MINUTES]);
    expect(superseded[0].channel).toBe('push');
  });

  it('collapses a late run to the single closest push stage, alongside the one automatic email', () => {
    // The day before the renewal: 2d, 1d and 10d are all open at once.
    const { planned } = run([sub('s1', RENEWAL)], [], [], ONE_DAY_OUT);

    // Push collapses to the closest stage it owes. Email has only one stage in
    // total, so there is nothing to collapse: it is still owed exactly one send.
    expect(planned.map((p) => [p.leadMinutes, p.channel]).sort()).toEqual([
      [1 * DAY, 'push'],
      [2 * DAY, 'email'],
    ]);
  });

  /**
   * The second call on the day before. Its window is [12:00, 24:00) the day
   * before, so the 09:00 cron cannot deliver it — the paired 21:00 run can.
   */
  it('schedules the second call at a 12-hour lead, push only', () => {
    // The two real cron times on the day before.
    const morning = run([sub('s1', RENEWAL)], [], [], new Date('2026-03-04T09:00:00Z'));
    const evening = run(
      [sub('s1', RENEWAL)],
      [],
      [
        deliveryKey('s1', RENEWAL, 2 * DAY, 'push'),
        deliveryKey('s1', RENEWAL, 2 * DAY, 'email'),
        deliveryKey('s1', RENEWAL, 1 * DAY, 'push'),
        deliveryKey('s1', RENEWAL, 1 * DAY, 'email'),
      ],
      new Date('2026-03-04T21:00:00Z')
    );

    // 09:00 is 15h out, before the 12h window opens, so the run owes the 1-day
    // push plus the single automatic email, which is still outstanding.
    expect(morning.planned.map((p) => [p.leadMinutes, p.channel]).sort()).toEqual([
      [1 * DAY, 'push'],
      [2 * DAY, 'email'],
    ]);

    // 21:00 is 3h out and inside the 12h window. With the 1-day stage already
    // delivered, the actionable second call is all that is left, and only on push.
    expect(evening.planned.map((p) => [p.leadMinutes, p.channel])).toEqual([
      [SECOND_CALL_LEAD_MINUTES, 'push'],
    ]);
  });

  it('does not schedule the second call before noon on the day before', () => {
    const { planned } = run([sub('s1', RENEWAL)], [], [], TWO_DAYS_OUT);

    expect(planned.some((p) => p.leadMinutes === SECOND_CALL_LEAD_MINUTES)).toBe(false);
  });

  it('catches a missed run up, but not after the renewal has passed', () => {
    const late = run([sub('s1', '2026-03-02')], [], [], new Date('2026-03-01T23:00:00Z'));
    expect(late.planned.length).toBeGreaterThan(0);

    const past = run([sub('s1', '2026-02-28')], []);
    expect(past.planned).toHaveLength(0);
    expect(past.skipped.every((s) => s.reason === 'renewal_passed')).toBe(true);
  });

  it('keys reminders on the renewal so the next cycle fires again', () => {
    const a = deliveryKey('s1', '2026-03-02', 1 * DAY, 'push');
    const b = deliveryKey('s1', '2026-04-02', 1 * DAY, 'push');
    expect(a).not.toBe(b);
  });
});

describe('planReminders (opt-in Payment Reminder)', () => {
  it('never sends a user reminder when nothing is configured', () => {
    // Far enough out that only the 10-day nudge is inside its window.
    const { planned } = run(
      [sub('s1', '2026-03-11')],
      [pref()],
      [],
      new Date('2026-03-01T09:00:00Z')
    );

    // Only the automatic 10-day push, not a copy from the default user lead.
    expect(planned.map((p) => p.leadMinutes)).toEqual([UPCOMING_LEAD_MINUTES]);
    expect(planned.map((p) => p.channel)).toEqual(['push']);
  });

  it('fires the user opt-in at a 3-day lead on the chosen channel', () => {
    const { planned } = run(
      [sub('s1', '2026-03-05')],
      [pref({ pushEnabled: true, pushLeadMinutes: 3 * DAY })],
      [],
      new Date('2026-03-02T09:00:00Z')
    );

    expect(planned.filter((p) => p.leadMinutes === 3 * DAY).map((p) => p.channel)).toEqual([
      'push',
    ]);
  });

  it('fires the user opt-in at a 5-day lead on email', () => {
    const { planned } = run(
      [sub('s1', '2026-03-07')],
      [pref({ emailEnabled: true, emailLeadMinutes: 5 * DAY })],
      [],
      new Date('2026-03-02T09:00:00Z')
    );

    expect(planned.filter((p) => p.leadMinutes === 5 * DAY).map((p) => p.channel)).toEqual([
      'email',
    ]);
  });

  it('does not fire the user reminder before its lead', () => {
    const { planned } = run(
      [sub('s1', '2026-03-05')],
      [pref({ pushEnabled: true, pushLeadMinutes: 3 * DAY })],
      [],
      new Date('2026-03-01T09:00:00Z')
    );

    // 3d15h out: still more than three days away, so the opt-in is not due.
    expect(planned.some((p) => p.leadMinutes === 3 * DAY)).toBe(false);
  });

  /**
   * A user who picks a lead that already has an automatic stage must not get two
   * messages for the same moment. The delivery key is identical, so the opt-in
   * collapses into the automatic one rather than duplicating it.
   */
  it('collapses a custom lead equal to an automatic stage into it', () => {
    const { planned } = run(
      [sub('s1', '2026-03-05')],
      [pref({ pushEnabled: true, pushLeadMinutes: 2 * DAY })],
      [],
      new Date('2026-03-03T09:00:00Z')
    );

    // The automatic 2d stage already sends on both channels; the opt-in push is
    // the same delivery key, so it adds nothing.
    expect(planned.filter((p) => p.leadMinutes === 2 * DAY).map((p) => p.channel).sort()).toEqual([
      'email',
      'push',
    ]);
  });

  it('collapses a custom lead equal to the 10-day nudge into it', () => {
    const { planned } = run(
      [sub('s1', '2026-03-11')],
      [pref({ pushEnabled: true, pushLeadMinutes: UPCOMING_LEAD_MINUTES })],
      [],
      new Date('2026-03-01T09:00:00Z')
    );

    expect(planned.filter((p) => p.leadMinutes === UPCOMING_LEAD_MINUTES).map((p) => p.channel)).toEqual([
      'push',
    ]);
  });

});
