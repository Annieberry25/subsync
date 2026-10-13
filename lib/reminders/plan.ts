import {
  daysBetween,
  minutesUntilRenewal,
  triggerDateFromMinutes,
  utcToday,
  type IsoDate,
} from './dates';

/**
 * The renewal-reminder planner.
 *
 * Two kinds of reminder come out of here:
 *
 *   1. The automatic day-before reminder. Always on, both channels, not stored
 *      per subscription. It exists so nobody is surprised by a charge.
 *   2. The user's own opt-in reminder from the Payment Reminder sheet. They pick
 *      an offset in hours (12h, 3h, or a custom number) and one or both channels,
 *      and it fires at that offset. If the user never sets one, it never sends.
 *
 * Offsets are minutes, anchored to midnight UTC of the renewal date (a renewal
 * is a DATE with no time). This is what allows 12h and 3h to be distinct: a
 * day-granular engine cannot tell twelve hours from three.
 */

/** 24h before renewal: the automatic, always-on day-before reminder. */
export const AUTO_LEAD_MINUTES = 24 * 60;

/** 12h before renewal: the default opt-in heads-up. */
export const DEFAULT_USER_LEAD_MINUTES = 12 * 60;

/** The widest custom offset the UI allows (30 days), and the query horizon. */
export const MAX_LEAD_MINUTES = 30 * 24 * 60;

export type ReminderChannel = 'push' | 'email';

export interface PlannerSubscription {
  id: string;
  userId: string;
  name: string;
  price: number;
  currency: string;
  renewalDate: IsoDate;
}

export interface PlannerPreference {
  subscriptionId: string;
  pushEnabled: boolean;
  pushLeadMinutes: number;
  emailEnabled: boolean;
  emailLeadMinutes: number;
}

export interface PlannedReminder {
  subscriptionId: string;
  userId: string;
  name: string;
  price: number;
  currency: string;
  renewalDate: IsoDate;
  daysUntilRenewal: number;
  minutesUntilRenewal: number;
  channel: ReminderChannel;
  leadMinutes: number;
  triggerDate: IsoDate;
  /** Idempotency key: subscription + renewal cycle + offset + channel. */
  key: string;
}

export type SkipReason =
  | 'renewal_passed'
  | 'push_disabled'
  | 'email_off'
  | 'not_due'
  | 'already_delivered';

export interface SkippedReminder {
  subscriptionId: string;
  channel: ReminderChannel;
  leadMinutes: number;
  renewalDate: IsoDate;
  reason: SkipReason;
}

/**
 * The identity of a single reminder, independent of when it is sent.
 *
 * The renewal date is part of the key rather than the send date, which is what
 * lets a missed run be caught up later without a second copy being sent for the
 * same renewal.
 */
export function deliveryKey(
  subscriptionId: string,
  renewalDate: IsoDate,
  leadMinutes: number,
  channel: ReminderChannel
): string {
  return `${subscriptionId}|${renewalDate}|${leadMinutes}|${channel}`;
}

/** Short human label like "12h before" for a stored lead offset. */
export function describeLeadMinutes(minutes: number): string {
  if (minutes > 0 && minutes % 1440 === 0) return `${minutes / 1440}d before`;
  if (minutes > 0 && minutes % 60 === 0) return `${minutes / 60}h before`;
  return `${minutes}m before`;
}

export interface PlanInput {
  subscriptions: PlannerSubscription[];
  preferences: Map<string, PlannerPreference>;
  /** Keys already recorded as delivered (see `deliveryKey`). */
  alreadyDelivered: Set<string>;
  now: Date;
}

export interface Plan {
  planned: PlannedReminder[];
  skipped: SkippedReminder[];
}

function decide(
  sub: PlannerSubscription,
  channel: ReminderChannel,
  leadMinutes: number,
  minutes: number,
  days: number,
  alreadyDelivered: Set<string>,
  plan: Plan
): void {
  const renewal = sub.renewalDate;
  const key = deliveryKey(sub.id, renewal, leadMinutes, channel);

  if (alreadyDelivered.has(key)) {
    plan.skipped.push({
      subscriptionId: sub.id,
      channel,
      leadMinutes,
      renewalDate: renewal,
      reason: 'already_delivered',
    });
    return;
  }

  // `minutes <= leadMinutes` is the catch-up window: a run missed at the exact
  // trigger minute still fires on the next run, as long as the renewal has not
  // passed.
  if (minutes > leadMinutes) {
    plan.skipped.push({
      subscriptionId: sub.id,
      channel,
      leadMinutes,
      renewalDate: renewal,
      reason: 'not_due',
    });
    return;
  }

  plan.planned.push({
    subscriptionId: sub.id,
    userId: sub.userId,
    name: sub.name,
    price: sub.price,
    currency: sub.currency,
    renewalDate: renewal,
    daysUntilRenewal: days,
    minutesUntilRenewal: minutes,
    channel,
    leadMinutes,
    triggerDate: triggerDateFromMinutes(renewal, leadMinutes),
    key,
  });
}

export function planReminders(input: PlanInput): Plan {
  const plan: Plan = { planned: [], skipped: [] };
  const { alreadyDelivered } = input;

  for (const sub of input.subscriptions) {
    const minutes = minutesUntilRenewal(sub.renewalDate, input.now);
    const days = daysBetween(utcToday(input.now), sub.renewalDate);

    if (Number.isNaN(minutes)) {
      // Unparseable renewal date; nothing sensible to key or schedule against.
      continue;
    }

    if (minutes < 0) {
      // The renewal already happened. The query excludes these, but a row can
      // cross the boundary between the query and now.
      for (const channel of ['push', 'email'] as ReminderChannel[]) {
        plan.skipped.push({
          subscriptionId: sub.id,
          channel,
          leadMinutes: DEFAULT_USER_LEAD_MINUTES,
          renewalDate: sub.renewalDate,
          reason: 'renewal_passed',
        });
      }
      continue;
    }

    // ---- Automatic day-before: always, both channels, ignores preferences ----
    decide(sub, 'push', AUTO_LEAD_MINUTES, minutes, days, alreadyDelivered, plan);
    decide(sub, 'email', AUTO_LEAD_MINUTES, minutes, days, alreadyDelivered, plan);

    // ---- The user's own opt-in reminder, independent of the above ----
    const pref = input.preferences.get(sub.id);

    if (pref?.pushEnabled) {
      const lead = pref.pushLeadMinutes > 0 ? pref.pushLeadMinutes : DEFAULT_USER_LEAD_MINUTES;
      // A custom offset equal to the automatic one collapses into it (same key),
      // so it is only scheduled here when it is genuinely a separate reminder.
      if (lead !== AUTO_LEAD_MINUTES) {
        decide(sub, 'push', lead, minutes, days, alreadyDelivered, plan);
      }
    }

    if (pref?.emailEnabled) {
      const lead = pref.emailLeadMinutes > 0 ? pref.emailLeadMinutes : DEFAULT_USER_LEAD_MINUTES;
      if (lead !== AUTO_LEAD_MINUTES) {
        decide(sub, 'email', lead, minutes, days, alreadyDelivered, plan);
      }
    }
  }

  return plan;
}