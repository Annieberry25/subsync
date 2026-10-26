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
 *   1. The automatic reminders. Always on, email + push + inbox, not stored per
 *      subscription, staged by billing cycle (2d/1d for monthly, 7d/1d for
 *      annual) plus a push-only "coming up" nudge at 10 days.
 *   2. The user's own opt-in reminder from the Payment Reminder sheet. They pick
 *      an offset in days (3 days, 5 days, or a custom number) and one or both
 *      channels, and it fires at that offset. If the user never sets one, it
 *      never sends.
 *
 * Offsets are minutes, anchored to midnight UTC of the renewal date (a renewal
 * is a DATE with no time). Kept in minutes rather than days so a custom offset
 * can still express a partial day, even though the presets are now whole days.
 */

/**
 * Automatic reminder offsets, in minutes before renewal.
 *
 * Staged by billing cycle because an annual charge is worth knowing about much
 * earlier than a monthly one: a monthly renewal is a small, frequent event, so
 * two nudges close in are enough, while a yearly charge is large enough that a
 * single day-before notice leaves no room to cancel in time.
 *
 * Every offset is at least 24h. That is deliberate rather than incidental: the
 * cron runs once a day, and a window narrower than the gap between two runs would
 * open and close entirely between them. Lead times are the daily cron can
 * actually honour.
 */
export const AUTO_LEAD_MINUTES_MONTHLY = [2 * 24 * 60, 1 * 24 * 60] as const;
export const AUTO_LEAD_MINUTES_ANNUAL = [7 * 24 * 60, 1 * 24 * 60] as const;

/** Billing cycles that get the wider annual notice. */
export const ANNUAL_CYCLES: readonly string[] = ['yearly', 'annual'];

/**
 * The "coming up" nudge: 10 days out, push only.
 *
 * Push rather than email on purpose. Ten days is early enough that the user may
 * not act on it, and an email that far ahead mostly trains people to archive
 * unread mail from the address. It stays in the inbox, so it is not lost.
 */
export const UPCOMING_LEAD_MINUTES = 10 * 24 * 60;

/**
 * The second call: a 12h lead, push only, actionable.
 *
 * The user asked for two touches on the day before rather than one, and for the
 * second to carry a cancel action. A 12h lead is the honest way to express that:
 * its window is [12:00, 24:00) on the day before the charge, so it can only be
 * delivered by a run inside that window. The single daily cron at 09:00 is too
 * early for it, which is why vercel.json pairs a second daily run at 21:00.
 *
 * Actionable rather than a repeat: the 1-day notice has already been seen by
 * anyone who acted, so this asks for the decision instead of restating the
 * warning.
 *
 * The stage is unconditional in the planner. Whether it is actually sent is
 * decided at delivery time, where the engine can see whether the user has opened
 * the notice in the app since the first one — see `run-reminders.ts`.
 */
export const SECOND_CALL_LEAD_MINUTES = 12 * 60;

/**
 * The repayment-day stages: the day the charge actually goes out.
 *
 * The user asked for the day itself to speak for itself: push when the day
 * starts, a second push twelve hours later, and one email that day. The pair of
 * pushes and the email are three ordinary candidates — they key at offsets 0
 * (the morning push and the one email) and -720 (the evening push), and the
 * minute windows alone decide which run delivers them:
 *
 *   * The 0 lead's window is `minutes <= 0`, which opens at the renewal's
 *     midnight — the 09:00 run is the first cron inside it, the evening run is a
 *     catch-up if the morning one was missed.
 *   * The -720 lead's window is `minutes <= -720`, which is twelve hours past
 *     midnight — only the 21:00 run of the day itself can deliver it, which is
 *     precisely twelve hours after the morning push.
 *
 * Because they are ordinary numeric candidates, the own merge also keeps a
 * missed pre-charge catch-up from stacking on top of them: any earlier stage that
 * is somehow still owed on the day itself is superseded by the day-of stage as
 * the closer one, and the day speaks with one voice.
 */
export const RENEWAL_DAY_AM_LEAD = 0;
export const RENEWAL_DAY_PM_LEAD = -12 * 60;

/**
 * The overdue stages: a renewal the calendar has already passed.
 *
 * While - like seconds - the request, is for a daily push with a single
 * email. A daily push needs a key per day, which the existing ledger gets from a
 * distinct offset per overdue day; a single email needs one stable key for the
 * whole lapse. Both are expressed as offsets measured from the 09:00 cron:
 *
 *   * The push for the `d`-th overdue day keys at
 *     `-(d * 1440 + FIRST_CRON_OFFSET_MINUTES)` — the window of that key opens
 *     exactly at the 09:00 run of that day and not before, and stays open for
 *     the same day's evening run only (by then the morning key is claimed, and
 *     one overdue push per day is the contract).
 *   * The email keys once at `-1980`, the first overdue day's own push offset,
 *     on the email channel. It is due from the first overdue day and its key
 *     never changes, so every later day finds it already delivered — one email
 *     per lapse, no matter how long it runs.
 *
 * Renewals further past than `OVERDUE_HORIZON_DAYS` get nothing: a forgotten row
 * from years ago must not grind out a daily notification forever, and the window
 * matches the domain the delivery check below leaves representable.
 */
export const OVERDUE_HORIZON_DAYS = 30;
/** The first cron of a day (09:00 UTC in vercel.json), in minutes past midnight. */
export const FIRST_CRON_OFFSET_MINUTES = 9 * 60;

/** The delivery key of the overdue-day push for the `daysOverdue`-th day past. */
export function overduePushLead(daysOverdue: number): number {
  return -(daysOverdue * 1440 + FIRST_CRON_OFFSET_MINUTES);
}

/** The one-time email key of an overdue lapse. */
export const OVERDUE_EMAIL_LEAD = overduePushLead(1);

/** Which stage of the plan a reminder belongs to. */
export type ReminderStage = 'precharge' | 'renewal-day' | 'overdue';

/** The automatic offsets that apply to a subscription's billing cycle. */
export function autoLeadMinutesFor(billingCycle: string | null | undefined): number[] {
  const cycle = (billingCycle ?? '').trim().toLowerCase();
  return (ANNUAL_CYCLES as readonly string[]).includes(cycle)
    ? [...AUTO_LEAD_MINUTES_ANNUAL]
    : [...AUTO_LEAD_MINUTES_MONTHLY];
}

/** 5 days before renewal: the default opt-in heads-up. */
export const DEFAULT_USER_LEAD_MINUTES = 5 * 24 * 60;

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
  /** Decides whether the automatic stages are the monthly or the annual set. */
  billingCycle: string;
  /**
   * Carried from the row so delivery can check it at send time. The planner keys
   * and schedules only on the renewal date; whether a notice is still worth
   * sending is a question about the subscription's state right now.
   */
  status?: string | null;
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
  /** Carried through so delivery can label the cycle instead of assuming. */
  billingCycle: string;
  daysUntilRenewal: number;
  minutesUntilRenewal: number;
  channel: ReminderChannel;
  leadMinutes: number;
  triggerDate: IsoDate;
  /** Idempotency key: subscription + renewal cycle + offset + channel. */
  key: string;
  /** The stage group the reminder came from; absent means a pre-charge stage. */
  stage?: ReminderStage;
}

export type SkipReason =
  | 'renewal_passed'
  | 'push_disabled'
  | 'email_off'
  | 'not_due'
  | 'already_delivered'
  /** Due, but a closer stage went out this run instead. */
  | 'superseded_by_closer_stage'
  /** The last call, but the subscription is no longer active so there is nothing to warn about. */
  | 'subscription_not_active';

export interface SkippedReminder {
  subscriptionId: string;
  channel: ReminderChannel;
  leadMinutes: number;
  renewalDate: IsoDate;
  reason: SkipReason;
  /** The stage group the skipped candidate came from; absent means pre-charge. */
  stage?: ReminderStage;
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
  plan: Plan,
  stage?: ReminderStage
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
      stage,
    });
    return;
  }

  // `minutes <= leadMinutes` is the catch-up window: a run missed at the exact
  // trigger minute still fires on the next run, as long as the renewal has not
  // passed. The negative day-of and overdue offsets read the same way — their
  // windows OPEN after the renewal, so this comparison delivers them only from
  // the moment they are due and never before.
  if (minutes > leadMinutes) {
    plan.skipped.push({
      subscriptionId: sub.id,
      channel,
      leadMinutes,
      renewalDate: renewal,
      reason: 'not_due',
      stage,
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
    billingCycle: sub.billingCycle,
    daysUntilRenewal: days,
    minutesUntilRenewal: minutes,
    channel,
    leadMinutes,
    triggerDate: triggerDateFromMinutes(renewal, leadMinutes),
    key,
    stage,
  });
}

export function planReminders(input: PlanInput): Plan {
  const plan: Plan = { planned: [], skipped: [] };
  const { alreadyDelivered } = input;

  for (const sub of input.subscriptions) {
    const minutes = minutesUntilRenewal(sub.renewalDate, input.now);
    const days = daysBetween(utcToday(input.now), sub.renewalDate);

    if (Number.isNaN(minutes) || Number.isNaN(days)) {
      // Unparseable renewal date; nothing sensible to key or schedule against.
      continue;
    }

    /*
     * ---- The passed regime ----
     *
     * A renewal behind the calendar is an overdue subscription, not a dead one.
     * For a bounded window it is pushed once a day — a fresh key every day, so
     * the delivery ledger can never send the same day twice but every new day
     * speaks again — and emailed exactly once for the whole lapse, a stable key
     * the ledger holds after the first send. Past the window the row is left
     * alone entirely: daily pings for a forgotten line item are not hearing
     * from the app, they are harassment.
     *
     * The pre-charge skips below are kept so a run's trace still explains that
     * the pre-charge story is over for this renewal.
     */
    if (days < 0) {
      const overdueDays = -days;

      for (const channel of ['push', 'email'] as ReminderChannel[]) {
        plan.skipped.push({
          subscriptionId: sub.id,
          channel,
          leadMinutes: DEFAULT_USER_LEAD_MINUTES,
          renewalDate: sub.renewalDate,
          reason: 'renewal_passed',
        });
      }

      if (overdueDays <= OVERDUE_HORIZON_DAYS) {
        decide(
          sub,
          'push',
          overduePushLead(overdueDays),
          minutes,
          days,
          input.alreadyDelivered,
          plan,
          'overdue'
        );
        decide(
          sub,
          'email',
          OVERDUE_EMAIL_LEAD,
          minutes,
          days,
          input.alreadyDelivered,
          plan,
          'overdue'
        );
      }
      continue;
    }

    // ---- Candidates ----
    // Everything that is currently inside its lead window, per channel.
    const candidates: { channel: ReminderChannel; leadMinutes: number; stage?: ReminderStage }[] = [];

    /*
     * Pre-charge candidates only exist while the charge's day has not begun.
     * The engine treats any run inside a window as due, so on and after the
     * renewal day every pre-charge window reads as open forever — without this
     * gate, a "ten days before" push could still fire on the charge's own
     * evening once the closer stages are already delivered, because it would
     * be the least-delivered candidate left in the merge. On the day itself
     * the day-of stages are the closer message for the same charge, so the
     * pre-charge stages dissolve into them at window build, not in the merge
     * (the merge still explains the dissolution on the first run of the day,
     * where both day-of and owed pre-charge stages are undelivered).
     */
    const prechargeOpen = minutes > 0;

    // Automatic: staged by billing cycle, ignores preferences.
    //
    // Push is a stage per billing cycle — a heads-up, then a last call. Email is
    // deliberately ONE automatic send, not one per stage. Two automatic emails for
    // a single charge was the behaviour before, and on a monthly plan it meant a
    // message at two days out and another at the last call, which reads as a
    // duplicate and burns the sending quota for no extra warning.
    const autoLeads = autoLeadMinutesFor(sub.billingCycle);
    // The earliest stage, so the single automatic email lands as far ahead of the
    // charge as the plan allows rather than as late as possible.
    const autoEmailLead = autoLeads[0];

    if (prechargeOpen) {
      for (const lead of autoLeads) {
        candidates.push({ channel: 'push', leadMinutes: lead });
      }

      candidates.push({ channel: 'email', leadMinutes: autoEmailLead });

      // The 10-day "coming up" nudge: push only, always on.
      candidates.push({ channel: 'push', leadMinutes: UPCOMING_LEAD_MINUTES });

      // The second call on the day before: push only, actionable.
      candidates.push({ channel: 'push', leadMinutes: SECOND_CALL_LEAD_MINUTES });
    }

    /*
     * The repayment-day stages, on the day the charge goes out: the morning
     * push and the single email keyed at 0, the twelve-hours-later push keyed
     * at -720. The pre-charge stages above are no longer built once the day
     * begins (the gate below), so these are the only stages from here on and
     * speak once per channel — a leadup the runs missed is not sent late; the
     * day itself takes over. Their windows make them unreachable on any
     * earlier day: minute offsets 0 and -720 are only inside their windows at
     * or after the renewal's midnight.
     */
    if (days === 0) {
      candidates.push({ channel: 'push', leadMinutes: RENEWAL_DAY_AM_LEAD, stage: 'renewal-day' });
      candidates.push({ channel: 'push', leadMinutes: RENEWAL_DAY_PM_LEAD, stage: 'renewal-day' });
      candidates.push({ channel: 'email', leadMinutes: RENEWAL_DAY_AM_LEAD, stage: 'renewal-day' });
    }

    // The user's own opt-in reminder, independent of the above. It binds to the
    // same gate: the charge day is owned by the day-of stages.
    const pref = input.preferences.get(sub.id);

    if (pref?.pushEnabled && prechargeOpen) {
      const lead = pref.pushLeadMinutes > 0 ? pref.pushLeadMinutes : DEFAULT_USER_LEAD_MINUTES;
      // A custom offset that coincides with an automatic stage collapses into it
      // (same delivery key), so it is only a candidate when it is genuinely
      // separate.
      if (lead !== UPCOMING_LEAD_MINUTES && lead !== SECOND_CALL_LEAD_MINUTES && !autoLeads.includes(lead)) {
        candidates.push({ channel: 'push', leadMinutes: lead });
      }
    }

    if (pref?.emailEnabled && prechargeOpen) {
      const lead = pref.emailLeadMinutes > 0 ? pref.emailLeadMinutes : DEFAULT_USER_LEAD_MINUTES;
      /*
       * Collapses only into the one automatic email stage, and not into every
       * automatic stage. A person who explicitly asked for an email at this offset
       * is asking for it: if the chosen lead happens to match a stage that only
       * emits a push, swallowing it would silently drop a reminder they set up.
       */
      if (lead !== autoEmailLead) {
        candidates.push({ channel: 'email', leadMinutes: lead });
      }
    }

    /*
     * Only the most urgent due stage is scheduled, per channel.
     *
     * The engine treats any run inside a lead window as due, so that a missed run
     * still catches up. But the automatic reminder has several stages, and after a
     * missed day — or simply a run later than one stage's day — every stage is open
     * at once. Scheduling them all produced a burst: five notifications for a single
     * charge (2d push, 2d email, 1d push, 1d email, 10d push), including a "10 days
     * before" push arriving the day before the charge.
     *
     * Collapsing to the closest due lead per channel keeps the catch-up that matters
     * — the most urgent reminder is never lost — and drops the rest, so a run that
     * has fallen behind produces one clear message instead of a pile.
     */
    for (const channel of ['push', 'email'] as ReminderChannel[]) {
      /* The candidates keep their stage, so the merge can report which group a
         superseded or delivered candidate belonged to. */
      const channelCandidates = candidates.filter((c) => c.channel === channel);
      if (channelCandidates.length === 0) continue;

      /*
       * Ask `decide` about every candidate, because it is what reports not_due and
       * already_delivered and it is the only thing that consults the delivery
       * ledger. Everything it plans is temporarily set aside, then only the closest
       * lead is put back. The others become `superseded_by_closer_stage`, so the
       * run still explains itself instead of quietly sending five messages.
       */
      const staged: PlannedReminder[] = [];
      for (const candidate of channelCandidates) {
        const before = plan.planned.length;
        decide(
          sub,
          channel,
          candidate.leadMinutes,
          minutes,
          days,
          alreadyDelivered,
          plan,
          candidate.stage
        );
        if (plan.planned.length > before) staged.push(...plan.planned.splice(before));
      }

      if (staged.length === 0) continue;

      const mostUrgent = Math.min(...staged.map((p) => p.leadMinutes));
      for (const item of staged) {
        if (item.leadMinutes === mostUrgent) {
          plan.planned.push(item);
          continue;
        }
        plan.skipped.push({
          subscriptionId: sub.id,
          channel,
          leadMinutes: item.leadMinutes,
          renewalDate: sub.renewalDate,
          reason: 'superseded_by_closer_stage',
          stage: item.stage,
        });
      }
    }
  }

  return plan;
}