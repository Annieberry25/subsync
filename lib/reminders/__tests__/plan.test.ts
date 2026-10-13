import { describe, it, expect } from 'vitest';
import {
  planReminders,
  deliveryKey,
  AUTO_LEAD_MINUTES,
  DEFAULT_USER_LEAD_MINUTES,
  type PlannerSubscription,
  type PlannerPreference,
} from '@/lib/reminders/plan';

const NOW = new Date('2026-03-01T12:00:00Z');

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

function sub(id: string, renewalDate: string): PlannerSubscription {
  return { id, userId: 'u1', name: 'Netflix', price: 10, currency: 'USD', renewalDate };
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

describe('planReminders (minute offsets)', () => {
  it('sends the automatic day-before push AND email with no preference saved', () => {
    const { planned } = run([sub('s1', '2026-03-02')], []);

    expect(planned.map((p) => p.channel).sort()).toEqual(['email', 'push']);
    expect(planned.every((p) => p.leadMinutes === AUTO_LEAD_MINUTES)).toBe(true);
    expect(planned.every((p) => p.minutesUntilRenewal === 720)).toBe(true);
    expect(planned.every((p) => p.daysUntilRenewal === 1)).toBe(true);
  });

  it('never sends a user reminder when nothing is configured', () => {
    const { planned } = run([sub('s1', '2026-03-02')], [pref()]);
    expect(planned).toHaveLength(2);
    expect(planned.every((p) => p.leadMinutes === AUTO_LEAD_MINUTES)).toBe(true);
  });

  it("fires the user's opt-in push at its own 3-hour lead", () => {
    const { planned } = run(
      [sub('s1', '2026-03-02')],
      [pref({ pushEnabled: true, pushLeadMinutes: 180 })],
      [],
      new Date('2026-03-01T22:00:00Z')
    );

    // Automatic push + email (24h), plus the user's 3h push.
    expect(planned).toHaveLength(3);
    expect(planned.find((p) => p.leadMinutes === 180)?.channel).toBe('push');
  });

  it('does not fire the user reminder before its lead', () => {
    const { planned } = run([sub('s1', '2026-03-02')], [
      pref({ pushEnabled: true, pushLeadMinutes: 180 }),
    ]);

    // 12h remain, which is inside the automatic window but outside the 3h one.
    expect(planned.map((p) => p.leadMinutes)).toEqual([AUTO_LEAD_MINUTES, AUTO_LEAD_MINUTES]);
  });

  it("fires the user's opt-in email at its own lead", () => {
    const { planned } = run(
      [sub('s1', '2026-03-02')],
      [pref({ emailEnabled: true, emailLeadMinutes: 720 })],
      [],
      new Date('2026-03-01T18:00:00Z')
    );

    expect(planned).toHaveLength(3);
    expect(planned.find((p) => p.leadMinutes === 720)?.channel).toBe('email');
  });

  it('collapses a custom lead equal to the automatic day-before into it', () => {
    const { planned } = run([sub('s1', '2026-03-02')], [
      pref({ pushEnabled: true, pushLeadMinutes: AUTO_LEAD_MINUTES }),
    ]);

    // No third copy: the user's 24h push is the automatic one.
    expect(planned).toHaveLength(2);
    expect(planned.every((p) => p.leadMinutes === AUTO_LEAD_MINUTES)).toBe(true);
  });

  it('does not re-send an automatic reminder already delivered for the same renewal', () => {
    const key = deliveryKey('s1', '2026-03-02', AUTO_LEAD_MINUTES, 'push');
    const { planned, skipped } = run([sub('s1', '2026-03-02')], [], [key]);

    expect(planned.map((p) => p.channel)).toEqual(['email']);
    expect(skipped.find((s) => s.channel === 'push')?.reason).toBe('already_delivered');
  });

  it('catches a missed run up, but not after the renewal has passed', () => {
    // Renewal in an hour: still before it, so the reminders are due.
    const late = run([sub('s1', '2026-03-02')], [], [], new Date('2026-03-01T23:00:00Z'));
    expect(late.planned).toHaveLength(2);

    // Renewal already behind us: nothing fires.
    const past = run([sub('s1', '2026-02-28')], []);
    expect(past.planned).toHaveLength(0);
    expect(past.skipped.every((s) => s.reason === 'renewal_passed')).toBe(true);
  });

  it('keys reminders on the renewal so the next cycle fires again', () => {
    const a = deliveryKey('s1', '2026-03-02', AUTO_LEAD_MINUTES, 'push');
    const b = deliveryKey('s1', '2026-04-02', AUTO_LEAD_MINUTES, 'push');
    expect(a).not.toBe(b);
  });
});