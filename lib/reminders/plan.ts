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
 *   1. The automatic reminders. Always on, not stored per subscription:
 *      push at 10/5/3/2/1 days before the charge (the countdown), an extra
 *      push on the evening of the day before, the pair on the charge's own
 *      day, and — while a lapsed row still speaks — a push on each of the
 *      first three overdue days. Email is deliberately rare: ONE automatic
 *      email per renewal (2 days before for a monthly plan, 7 days before
 *      an annual one) and one email per overdue lapse, never one per stage.
 *   2. The user's own opt-in reminder from the Payment Reminder sheet. They
 *      pick an offset in days (3 days, 5 days, or a custom number) and one
 *      or both channels, and it fires at that offset. If the user never
 *      sets one, it never sends.
 *
 * Offsets are minutes, anchored to midnight UTC of the renewal date (a
 * renewal is a DATE with no time). Kept in minutes rather than days so a
 * custom offset can still express a partial day, even though the presets
 * are whole days.
 */

/** One calendar day, in minutes. Renewal anchors are midnight-UTC days. */
export const DAY_MINUTES = 24 * 60;

/**
 * The countdown stages, in lead days: push only, one per labelled day.
 *
 * Each stage is DAY-EXACT. A stage is due on its own calendar day and never
 * later — the run that fired at 09:00 of that day claims the key, and the
 * same day's 21:00 run finds it delivered. If a whole day is missed the
 * stage is simply not owed: a countdown that had missed its 10-day mark must
 * never arrive as a "renews in 8 days" push, because the app promised 10/5/
 * 3/2/1 and the honest message is the one named for the day it fires on.
 *
 * This is what it means for the schedule to match what the user was told.
 */
export const COUNTDOWN_LEAD_DAYS: readonly number[] = [10, 5, 3, 2, 1];

/** The countdown stages in the minutes this module keys and windows with. */
export const COUNTDOWN_LEAD_MINUTES: readonly number[] = COUNTDOWN_LEAD_DAYS.map(
  (days) => days * DAY_MINUTES
);

/** Billing cycles whose single automatic email goes out at the annual lead. */
export const ANNUAL_CYCLES: readonly string[] = ['yearly', 'annual'];

/**
 * The lead of the ONE automatic email per renewal.
 *
 * An annual charge is worth having in the calendar much earlier than a
 * monthly one, so its single email lands at 7 days; a monthly Email lands at
 * 2. There is no further automatic email for the same renewal — the charge's
 * own day speaks in pushes, and the email channel stays quiet. The user's
 * own opt-in reminder can still add one more email, on purpose.
 */
export const AUTO_EMAIL_LEAD_MINUTES_MONTHLY = 2 * DAY_MINUTES;
export const AUTO_EMAIL_LEAD_MINUTES_ANNUAL = 7 * DAY_MINUTES;

/** The lead of the single automatic email for a subscription's cycle. */
export function autoEmailLeadFor(billingCycle: string | null | undefined): number {
  const cycle = (billingCycle ?? '').trim().toLowerCase();
  return (ANNUAL_CYCLES as readonly string[]).includes(cycle)
    ? AUTO_EMAIL_LEAD_MINUTES_ANNUAL
    : AUTO_EMAIL_LEAD_MINUTES_MONTHLY;
}

/**
 * The second call: a 12h lead, push only, actionable.
 *
 * The user asked for an extra one on the day before. A 12h lead is the
 * honest way to express that: its window is [12:00, 24:00) on the day before
 * the charge, so it can only be delivered by a run inside that window. The
 * 09:00 cron is too early for it, which is why vercel.json pairs a second
 * daily run at 21:00.
 *
 * Actionable rather than a repeat: the day-before countdown push has already
 * carried the countdown, so this asks for the decision instead of repeating
 * the arithmetic.
 *
 * The stage is unconditional in the planner. Whether it is actually sent is
 * decided at delivery time, where the engine can see the subscription's own
 * state — see `run-reminders.ts`.
 */
export const SECOND_CALL_LEAD_MINUTES = 12 * 60;

/**
 * The repayment-day stages: the day the charge actually goes out.
 *
 * The user asked for the day itself to speak for itself: a push when the day
 * starts and a second push twelve hours later. (The email channel is quiet
 * on the day itself: the automatic email went out earlier, and the day has
 * two pushes — one email per renewal is the whole plan.) The pair of pushes
 * are ordinary candidates keyed at offsets 0 (the morning push) and -720
 * (the evening push), and the minute windows alone decide which run delivers
 * them:
 *
 *   * The 0 lead's window is `minutes <= 0`, which opens at the renewal's
 *     midnight — the 09:00 run is the first cron inside it, the evening run
 *     is a catch-up if the morning one was missed.
 *   * The -720 lead's window is `minutes <= -720`, which is twelve hours
 *     past midnight — only the 21:00 run of the day itself can deliver it.
 *
 * Because they are ordinary numeric candidates, the merge also keeps a
 * missed pre-charge catch-up from stacking on top of them: any earlier stage
 * that is somehow still owed on the day itself is superseded by the day-of
 * stage as the closer one, and the day speaks with one voice.
 */
export const RENEWAL_DAY_AM_LEAD = 0;
export const RENEWAL_DAY_PM_LEAD = -12 * 60;

/**
 * The overdue stages: a renewal the calendar has already passed.
 *
 * The contract the user set: after a lapse the app pushes for three days,
 * then holds its tongue. A daily push needs a key per day, which the
 * existing ledger gets from a distinct offset per overdue day; the single
 * email needs one stable key for the whole lapse. **Both** are expressed as
 * offsets measured from the 09:00 cron:
 *
 *   * The push for the `d`-th overdue day keys at
 *     `-(d * 1440 + FIRST_CRON_OFFSET_MINUTES)` and is built only when the
 *     run IS day `d` — a day whose run never happened is a push that is not
 *     owed, not a stack of pushes waiting on the next run.
 *   * The email keys once at the first overdue day's own push offset, on
 *     the email channel. It is due from the first overdue day and its key
 *     never changes, so every later day finds it already delivered — one
 *     email per lapse, no matter how long it runs.
 *
 * A row that is still lapsed past `OVERDUE_HORIZON_DAYS` is handled by the
 * auto-removal in the engine (soft delete plus one final notice), not by
 * this planner.
 */
export const OVERDUE_PUSH_DAYS = 3;

/** A subscription still unpaid this many days after its renewal is removed. */
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

/** 5 days before renewal: the default opt-in heads-up. */
export const DEFAULT_USER_LEAD_MINUTES = 5 * DAY_MINUTES;

/** The widest custom offset the UI allows (30 days), and the query horizon. */
export const MAX_LEAD_MINUTES = 30 * DAY_MINUTES;

export type ReminderChannel = 'push' | 'email';

export interface PlannerSubscription {
  id: string;
  userId: string;
  name: string;
  price: number;
  currency: string;
  renewalDate: IsoDate;
  /** Decides which day the single automatic email goes out on. */
  billingCycle: string;
  /**
   * Carried from the row so delivery can check it at send time. The planner
   * keys and schedules only on the renewal date; whether a notice is still
   * worth sending is a question about the subscription's state right now.
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
  /** Nothing to warn about: the user stopped (or the row cannot charge). */
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
 * The renewal date is part of the key rather than the send date, which is
 * what lets a missed run be caught up later without a second copy being sent
 * for the same renewal.
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

interface Candidate {
  channel: ReminderChannel;
  leadMinutes: number;
  stage?: ReminderStage;
  /**
   * When the candidate counts as due.
   *
   * The default is the catch-up rule the engine's windows are built on (with
   * the day-of and overdue offsets opening after the renewal itself), which
   * is right for everything anchored to a wall-clock offset. The countdown
   * pushes override it with a day-exact window — days === their lead day —
   * because a countdown numbering off its calendar day must not survive into
   * later days as a wrong number.
   */
  isDue?: (days: number, minutes: number) => boolean;
}

function decide(
  sub: PlannerSubscription,
  channel: ReminderChannel,
  leadMinutes: number,
  candidate: Candidate,
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

  const due = candidate.isDue
    ? candidate.isDue(days, minutes)
    : // `minutes <= leadMinutes` is the catch-up window: a run missed at the
      // exact trigger minute still fires on the next run, as long as the
      // renewal has not passed. The negative day-of and overdue offsets read
      // the same way — their windows OPEN after the renewal, so this
      // comparison delivers them only from the moment they are due and never
      // before.
      minutes <= leadMinutes;

  if (!due) {
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

/** Whether the subscription's row is still one the reminders are allowed to speak for. */
function remindersAllowed(status: string | null | undefined): boolean {
  // No status means the row predates the column or the caller passed nothing;
  // treat it as live rather than silently dropping reminders for it.
  return !status || status === 'active' || status === 'trial';
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

    const allowed = remindersAllowed(sub.status);

    /*
     * ---- The passed regime ----
     *
     * A renewal behind the calendar is an overdue subscription, not a dead
     * one. The contract it speaks on is bounded twice: a push on each of the
     * first three overdue days — each day-exact, so a missed day is a push
     * never owed rather than a backlog waiting to burst — plus a single
     * email with a stable key, one for the whole lapse. Past the push days
     * the row is silent; past the removal horizon the ENGINE soft-deletes it
     * and sends one last notice, which is why the planner plans nothing
     * there.
     */
    if (days < 0) {
      const overdueDays = -days;

      if (!allowed) {
        for (const channel of ['push', 'email'] as ReminderChannel[]) {
          plan.skipped.push({
            subscriptionId: sub.id,
            channel,
            leadMinutes: DEFAULT_USER_LEAD_MINUTES,
            renewalDate: sub.renewalDate,
            reason: 'subscription_not_active',
          });
        }
        continue;
      }

      for (const channel of ['push', 'email'] as ReminderChannel[]) {
        plan.skipped.push({
          subscriptionId: sub.id,
          channel,
          leadMinutes: DEFAULT_USER_LEAD_MINUTES,
          renewalDate: sub.renewalDate,
          reason: 'renewal_passed',
        });
      }

      if (overdueDays <= OVERDUE_PUSH_DAYS) {
        // The overdue day itself: a fresh key per day, readable by the
        // ledger, due only while the calendar is on that day.
        decide(
          sub,
          'push',
          overduePushLead(overdueDays),
          { channel: 'push', leadMinutes: overduePushLead(overdueDays), isDue: (d) => d === -overdueDays },
          minutes,
          days,
          input.alreadyDelivered,
          plan,
          'overdue'
        );
      }

      // One email per lapse: a stable key the ledger holds after the first
      // send. Its window stays open for catch-up because if the first
      // overdue day's run was missed, the lapse's single email is still
      // owed. Past the removal horizon the engine handles the row instead —
      // soft delete plus one last notice — so the planner plans nothing.
      if (overdueDays <= OVERDUE_HORIZON_DAYS) {
        decide(
          sub,
          'email',
          OVERDUE_EMAIL_LEAD,
          { channel: 'email', leadMinutes: OVERDUE_EMAIL_LEAD },
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
    const candidates: Candidate[] = [];

    /*
     * Pre-charge candidates only exist while the charge's day has not begun.
     * The engine treats any run inside a window as due, so on and after the
     * renewal day every pre-charge window reads as open forever — without
     * this gate, a "ten days before" push could still fire on the charge's
     * own evening once the closer stages are already delivered. On the day
     * itself the day-of stages are the closer message for the same charge,
     * so the pre-charge stages dissolve into them at window build.
     *
     * A subscription the user stopped has no charge to warn about, so
     * nothing of the pre-charge story applies to it either.
     */
    const prechargeOpen = minutes > 0 && allowed;

    if (prechargeOpen) {
      // The countdown: push on each labelled day. Nothing binds a countdown
      // to a billing cycle — 10/5/3/2/1 is the same for a monthly plan and
      // an annual one, which is what keeps the notifications telling a story
      // the user can predict.
      for (const lead of COUNTDOWN_LEAD_MINUTES) {
        const countDay = lead / DAY_MINUTES;
        candidates.push({
          channel: 'push',
          leadMinutes: lead,
          isDue: (days) => days === countDay,
        });
      }

      // The single automatic email for this renewal, by cycle.
      candidates.push({
        channel: 'email',
        leadMinutes: autoEmailLeadFor(sub.billingCycle),
      });

      // The extra push on the day before: push only, actionable.
      candidates.push({ channel: 'push', leadMinutes: SECOND_CALL_LEAD_MINUTES });
    }

    /*
     * The repayment-day stages, on the day the charge goes out: the morning
     * push keyed at 0 and the twelve-hours-later push keyed at -720. The
     * pre-charge stages above are no longer built once the day begins, so
     * these are the only stages from here on and speak once per channel — a
     * leadup the runs missed is not sent late; the day itself takes over.
     * Their windows make them unreachable on any earlier day.
     */
    if (days === 0) {
      candidates.push({ channel: 'push', leadMinutes: RENEWAL_DAY_AM_LEAD, stage: 'renewal-day' });
      candidates.push({ channel: 'push', leadMinutes: RENEWAL_DAY_PM_LEAD, stage: 'renewal-day' });
    }

    /*
     * The user's own opt-in reminder, independent of the above. It binds to
     * the same gates: the charge day is owned by the day-of stages, and a
     * stopped subscription is owned by nothing.
     */
    const pref = input.preferences.get(sub.id);

    if (pref?.pushEnabled && prechargeOpen) {
      const lead = pref.pushLeadMinutes > 0 ? pref.pushLeadMinutes : DEFAULT_USER_LEAD_MINUTES;
      // A custom offset that coincides with an automatic stage collapses into
      // it (same delivery key), so it is only a candidate when it is
      // genuinely separate.
      const overlapsAutomatic =
        COUNTDOWN_LEAD_MINUTES.includes(lead) || lead === SECOND_CALL_LEAD_MINUTES;
      if (!overlapsAutomatic) {
        candidates.push({ channel: 'push', leadMinutes: lead });
      }
    }

    if (pref?.emailEnabled && prechargeOpen) {
      const lead = pref.emailLeadMinutes > 0 ? pref.emailLeadMinutes : DEFAULT_USER_LEAD_MINUTES;
      /*
       * Collapses only into the one automatic email stage, and not into every
       * automatic stage. A person who explicitly asked for an email at this
       * offset is asking for it: if the chosen lead happens to match a stage
       * that only emits a push, swallowing it would silently drop a reminder
       * they set up.
       */
      if (lead !== autoEmailLeadFor(sub.billingCycle)) {
        candidates.push({ channel: 'email', leadMinutes: lead });
      }
    }

    /*
     * Only the most urgent due stage is scheduled, per channel.
     *
     * The engine treats any run inside a lead window as due, so that a missed
     * run still catches up. But the automatic reminder has several stages, and
     * after a missed day — or simply a run later than one stage's day — every
     * stage is open at once. Scheduling them all produced a burst: five
     * notifications for a single charge, including a "10 days before" push
     * arriving the day before the charge.
     *
     * Collapsing to the closest due lead per channel keeps the catch-up that
     * matters — the most urgent reminder is never lost — and drops the rest,
     * so a run that has fallen behind produces one clear message instead of a
     * pile.
     */
    for (const channel of ['push', 'email'] as ReminderChannel[]) {
      /* The candidates keep their stage, so the merge can report which group a
         superseded or delivered candidate belonged to. */
      const channelCandidates = candidates.filter((c) => c.channel === channel);
      if (channelCandidates.length === 0) continue;

      /*
       * Ask `decide` about every candidate, because it is what reports
       * not_due and already_delivered and it is the only thing that consults
       * the delivery ledger. Everything it plans is temporarily set aside,
       * then only the closest lead is put back. The others become
       * `superseded_by_closer_stage`, so the run still explains itself
       * instead of quietly sending five messages.
       */
      const staged: PlannedReminder[] = [];
      for (const candidate of channelCandidates) {
        const before = plan.planned.length;
        decide(
          sub,
          channel,
          candidate.leadMinutes,
          candidate,
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
