import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/types/database.types';
import { logger } from '@/lib/logger';
import { sendRenewalReminderEmail } from '@/lib/email/send';
import { sendPushToUser, isPushConfigured } from '@/lib/push/send';
import type { SubscriptionEmailData } from '@/lib/email/types';
import { addDays, triggerDateFromMinutes, utcToday } from './dates';
import {
  deliveryKey,
  planReminders,
  SECOND_CALL_LEAD_MINUTES,
  MAX_LEAD_MINUTES,
  OVERDUE_HORIZON_DAYS,
  RENEWAL_DAY_PM_LEAD,
  COUNTDOWN_LEAD_MINUTES,
  type PlannedReminder,
  type PlannerPreference,
  type PlannerSubscription,
  type ReminderChannel,
} from './plan';
import { addCycleToDate } from '@/lib/utils/billing-dates';
import { notesForAutoRemoval, serverHistoryState } from './overdue-cleanup';

/**
 * The renewal-reminder engine.
 *
 * Reads every non-canceled subscription inside the plan's windows — renewals
 * ahead of today up to the widest lead, the renewal day itself (one push when
 * the day starts, a second twelve hours later, one email), and the bounded
 * overdue window behind today (a daily push plus a single email) — decides what
 * is due (see `planReminders`), and sends it to the right channels for each
 * user, recording one row per (subscription, renewal, offset, channel) so
 * nothing is ever sent twice for the same renewal.
 *
 * Kept out of the route so both the Vercel cron and the manual admin trigger run
 * exactly the same code and it can be exercised with a real `dryRun` that
 * changes nothing.
 */

const MAX_PUSH_PER_RUN = 400;
const MAX_EMAILS_PER_RUN = 200;
/** A runaway guard on how many rows a single run will even look at. */
const MAX_SUBSCRIPTIONS_PER_RUN = 5000;

export type ReminderAction =
  | 'sent'
  | 'would_send'
  | 'skipped'
  | 'failed'
  | 'auto_removed'
  | 'auto_remove_would_apply';

export interface ReminderRunItem {
  subscriptionId: string;
  name: string;
  userId: string;
  renewalDate: string;
  daysUntilRenewal: number;
  minutesUntilRenewal: number;
  channel: ReminderChannel;
  leadMinutes: number;
  triggerDate: string;
  action: ReminderAction;
  /** Why it was skipped or how it failed. Absent when sent. */
  reason?: string;
}

export interface ReminderRunReport {
  ranAt: string;
  today: string;
  dryRun: boolean;
  considered: number;
  pushSent: number;
  emailsSent: number;
  skipped: number;
  failed: number;
  autoRemoved: number;
  /** Full per-reminder trace, so a manual run can be inspected. */
  items: ReminderRunItem[];
}

export interface RunReminderOptions {
  supabase: SupabaseClient<Database>;
  now?: Date;
  dryRun?: boolean;
  /**
   * Restrict the run to one account.
   *
   * The cron passes nothing and covers everyone. A user-triggered run passes their
   * own id, so saving a reminder can immediately deliver whatever that account is
   * already owed — both their own opt-in reminder and any automatic stage that has
   * come due — without waiting for the next scheduled tick, and without ever
   * touching anybody else's rows.
   */
  userId?: string;
  /** Whether to auto-remove overdue subscriptions past the horizon. Cron passes true (default), run-now passes false. */
  autoRemove?: boolean;
}

function todayIso(now: Date): string {
  return utcToday(now);
}

/** Human wording for how far off a renewal is, at hour/minute resolution. */
function humanizeRenewal(minutes: number): string {
  if (minutes <= 0) return 'renews today';
  if (minutes < 60) return `renews in ${Math.max(1, Math.round(minutes))} min`;
  if (minutes < 1440) {
    const hours = Math.round(minutes / 60);
    return `renews in ${hours} hour${hours === 1 ? '' : 's'}`;
  }
  const days = Math.round(minutes / 1440);
  return days === 1 ? 'renews tomorrow' : `renews in ${days} days`;
}

export async function runRenewalReminders({
  supabase,
  now = new Date(),
  dryRun = false,
  userId,
  autoRemove = true,
}: RunReminderOptions): Promise<ReminderRunReport> {
  const today = todayIso(now);
  const horizon = addDays(today, Math.ceil(MAX_LEAD_MINUTES / 1440));
  const ranAt = now.toISOString();

  const report: ReminderRunReport = {
    ranAt,
    today,
    dryRun,
    considered: 0,
    pushSent: 0,
    emailsSent: 0,
    skipped: 0,
    failed: 0,
    autoRemoved: 0,
    items: [],
  };

  // ---- Load candidate subscriptions inside the plan's windows ----
  // Forward: every lead stage the planner can schedule. Backward: the bounded
  // overdue window, whose daily push and one-time email are part of the plan.
  // Also fetch a wider set for auto-removal (>30 days overdue) because we need
  // to compute derived renewal dates to match the UI.
  const windowFloor = addDays(today, -OVERDUE_HORIZON_DAYS);
  let subsQuery = supabase
    .from('subscriptions')
    .select('id, user_id, name, price, currency, next_billing_date, start_date, billing_cycle, status, notes, auto_renew')
    .neq('status', 'canceled')
    .or(`next_billing_date.gte.${windowFloor},next_billing_date.lte.${horizon}`)
    .limit(MAX_SUBSCRIPTIONS_PER_RUN);

  // Scoped run: only this account's subscriptions are ever candidates.
  if (userId) subsQuery = subsQuery.eq('user_id', userId);

  const { data: subs, error: subsError } = await subsQuery;

  if (subsError) throw subsError;

  const rows = (subs ?? []).filter((s) => s.id && s.user_id);
  report.considered = rows.length;
  if (rows.length === 0) {
    logger.info('[reminders] nothing in the window', { today, horizon });
    return report;
  }

  const subscriptionIds = rows.map((r) => r.id);
  const userIds = [...new Set(rows.map((r) => r.user_id))];

  // ---- Preferences, owner emails, and what already went out ----
  const [{ data: prefRows }, { data: profileRows }, { data: deliveryRows }] = await Promise.all([
    supabase
      .from('subscription_reminders')
      .select('subscription_id, email_enabled, email_lead_minutes, push_enabled, push_lead_minutes')
      .in('subscription_id', subscriptionIds),
    supabase.from('profiles').select('id, email').in('id', userIds),
    supabase
      .from('reminder_deliveries')
      .select('subscription_id, renewal_date, lead_minutes, channel')
      .in('subscription_id', subscriptionIds),
  ]);

  const preferences = new Map<string, PlannerPreference>();
  for (const p of prefRows ?? []) {
    if (!p.subscription_id) continue;
    preferences.set(p.subscription_id, {
      subscriptionId: p.subscription_id,
      pushEnabled: p.push_enabled,
      pushLeadMinutes: p.push_lead_minutes,
      emailEnabled: p.email_enabled,
      emailLeadMinutes: p.email_lead_minutes,
    });
  }

  const emailByUser = new Map<string, string>();
  for (const p of profileRows ?? []) {
    if (p.id && p.email) emailByUser.set(p.id, p.email);
  }

  const alreadyDelivered = new Set<string>();
  for (const d of deliveryRows ?? []) {
    if (!d.subscription_id || !d.renewal_date || !d.channel) continue;
    alreadyDelivered.add(
      deliveryKey(d.subscription_id, d.renewal_date, d.lead_minutes, d.channel)
    );
  }

  // ---- Decide ----
  const plannerSubs: PlannerSubscription[] = rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    name: r.name ?? 'Your subscription',
    price: Number(r.price) || 0,
    currency: r.currency ?? 'USD',
    renewalDate: r.next_billing_date,
    billingCycle: r.billing_cycle ?? 'monthly',
    status: r.status,
  }));

  const statusBySubscription = new Map<string, string | null>(
    plannerSubs.map((s) => [s.id, s.status ?? null])
  );

  const plan = planReminders({ subscriptions: plannerSubs, preferences, alreadyDelivered, now });

  for (const s of plan.skipped) {
    const sub = plannerSubs.find((x) => x.id === s.subscriptionId);
    report.skipped++;
    report.items.push({
      subscriptionId: s.subscriptionId,
      name: sub?.name ?? '',
      userId: sub?.userId ?? '',
      renewalDate: s.renewalDate,
      daysUntilRenewal: 0,
      minutesUntilRenewal: 0,
      channel: s.channel,
      leadMinutes: s.leadMinutes,
      triggerDate: triggerDateFromMinutes(s.renewalDate, s.leadMinutes),
      action: 'skipped',
      reason: s.reason,
    });
  }

  // ---- Send ----
  // Every due reminder, keyed by (subscription, renewal, lead stage). The in-app
  // inbox is a channel in its own right: it gets a notice whether or not the
  // email or push leg could be delivered.
  //
  // Keyed by the lead offset, not just the renewal. The automatic reminder is
  // deliberately staged (2d then 1d for monthly, 7d then 1d for annual), and the
  // in-app inbox is meant to carry every stage — collapsing to one notice per
  // renewal would silently swallow all but the last one. The two channels of the
  // same stage still share one notice, so a stage is not listed twice just
  // because it went out on both email and push.
  const notified = new Map<string, PlannedReminder>();
  for (const item of plan.planned) {
    notified.set(`${item.subscriptionId}|${item.renewalDate}|${item.leadMinutes}`, item);
  }

  for (const item of plan.planned) {
    const base: Omit<ReminderRunItem, 'action' | 'reason'> = {
      subscriptionId: item.subscriptionId,
      name: item.name,
      userId: item.userId,
      renewalDate: item.renewalDate,
      daysUntilRenewal: item.daysUntilRenewal,
      minutesUntilRenewal: item.minutesUntilRenewal,
      channel: item.channel,
      leadMinutes: item.leadMinutes,
      triggerDate: item.triggerDate,
    };

    const capReached =
      item.channel === 'push'
        ? report.pushSent >= MAX_PUSH_PER_RUN
        : report.emailsSent >= MAX_EMAILS_PER_RUN;

    if (capReached) {
      report.skipped++;
      report.items.push({ ...base, action: 'skipped', reason: 'run_cap_reached' });
      continue;
    }

    if (dryRun) {
      report.items.push({ ...base, action: 'would_send' });
      continue;
    }

    // Claim the reminder before sending. The unique constraint on
    // (subscription, renewal, offset, channel) means a concurrent or retried run
    // loses the insert and does not send a second copy.
    const { data: claim, error: claimError } = await supabase
      .from('reminder_deliveries')
      .insert({
        user_id: item.userId,
        subscription_id: item.subscriptionId,
        renewal_date: item.renewalDate,
        lead_minutes: item.leadMinutes,
        channel: item.channel,
        subscription_name: item.name,
        amount: item.price,
        currency: item.currency,
      })
      .select('id')
      .single();

    if (claimError) {
      if (claimError.code === '23505') {
        report.skipped++;
        report.items.push({ ...base, action: 'skipped', reason: 'already_delivered' });
        continue;
      }
      report.failed++;
      report.items.push({ ...base, action: 'failed', reason: claimError.message });
      logger.error('[reminders] could not claim delivery', {
        subscriptionId: item.subscriptionId,
        message: claimError.message,
      });
      continue;
    }

    const claimedId = claim.id;

    /*
     * The repayment-day and overdue stages only speak for a subscription that
     * will actually charge. A paused row that happens to renew today ("renews
     * today") or a paused row sitting past its date (daily overdue pushes) is
     * not a charge warning anyone needs — the pre-charge stages have always
     * treated those rows like any other, but the day-of copy asserts the charge
     * is happening, and it should be true when it is read. The claim is
     * released rather than burned, so a row later set active again is notified
     * again on the next run.
     */
    if (
      (item.stage === 'renewal-day' || item.stage === 'overdue') &&
      statusBySubscription.get(item.subscriptionId) !== 'active'
    ) {
      await releaseClaim(supabase, claimedId);
      report.skipped++;
      report.items.push({ ...base, action: 'skipped', reason: 'subscription_not_active' });
      continue;
    }

    if (item.channel === 'push') {
      const isSecondCall = item.leadMinutes === SECOND_CALL_LEAD_MINUTES;

      /*
       * The second call is sent unless the subscription itself says there is
       * nothing to warn about.
       *
       * It used to be suppressed when the user had opened the earlier in-app
       * notice, on the reasoning that opening it meant they had seen the warning.
       * That inference is wrong in the case that matters most: push cannot be
       * read-confirmed, and iOS in particular accepts a push and displays
       * nothing when the subscription was created outside an installed web app.
       * The user then opens the app, the proxy reads as "they saw it", and the
       * one reminder that could still have reached them is withheld — which is
       * exactly how a charge arrives unannounced after an earlier notice
       * appeared to have been delivered.
       *
       * So the gate is now the subscription's own state. A charge that is no
       * longer going out does not need warning about; everything else does.
       */
      if (isSecondCall && statusBySubscription.get(item.subscriptionId) !== 'active') {
        await releaseClaim(supabase, claimedId);
        report.skipped++;
        report.items.push({ ...base, action: 'skipped', reason: 'subscription_not_active' });
        continue;
      }

      /*
       * Copy per stage, in the app's voice.
       *
       * The repayment-day morning push states that the charge is today; the
       * evening one is the same fact as a last call, deep-linked to the
       * subscription itself rather than the list, so cancelling is one tap from
       * the notification. The overdue push states the lapsed date for what it is
       * and deep-links the same way — the action there is either marking it
       * renewed or cancelling it, and both live on the subscription's page.
       * `highlight` + `detail` is the existing deep-link contract the app
       * already uses to open a single subscription.
       */
      const deepLinkUrl = `/subscriptions?highlight=${encodeURIComponent(item.subscriptionId)}&detail=true`;
      const payload =
        item.stage === 'renewal-day' && item.leadMinutes === RENEWAL_DAY_PM_LEAD
          ? {
              title: `${item.name} renews today`,
              body: 'Last call today — cancel now if the plan is no longer worth it.',
              url: deepLinkUrl,
            }
          : item.stage === 'renewal-day'
            ? {
                title: `${item.name} renews today`,
                body: 'The charge is today, so it is worth one last look.',
                url: '/subscriptions',
              }
            : item.stage === 'overdue'
              ? {
                  title: `${item.name} is overdue`,
                  body: `It was due on ${item.renewalDate}. Mark it renewed or cancel it.`,
                  url: deepLinkUrl,
                }
              : isSecondCall
                ? {
                    title: `${item.name} ${humanizeRenewal(item.minutesUntilRenewal)}`,
                    body: 'Cancel it now if you do not want to be charged again.',
                    url: deepLinkUrl,
                  }
                : {
                    title: `${item.name} ${humanizeRenewal(item.minutesUntilRenewal)}`,
                    body: 'A heads-up so the next charge is not a surprise.',
                    url: '/subscriptions',
                  };

      const result = await sendPushToUser(item.userId, {
        ...payload,
        tag: `renewal-${item.subscriptionId}-${item.leadMinutes}`,
      });

      if (result.sent > 0) {
        report.pushSent++;
        report.items.push({ ...base, action: 'sent' });
        /* "Sent", not internal jargon — both channels land in the feed the user
           reads, so push reminders log the same wording the email path logs. */
        await logActivity(supabase, item, 'reminder_sent', 'Renewal reminder sent');
      } else {
        // Nothing was delivered — no device subscribed, no VAPID key, or the
        // push service rejected it. Release the claim so a later run can try
        // again rather than burning the reminder for this renewal.
        await releaseClaim(supabase, claimedId);
        if (result.skipped) {
          report.skipped++;
          report.items.push({
            ...base,
            action: 'skipped',
            reason: isPushConfigured() ? 'no_push_subscription' : 'push_not_configured',
          });
        } else {
          report.failed++;
          report.items.push({ ...base, action: 'failed', reason: 'push_send_failed' });
        }
      }
      continue;
    }

    // ---- Email ----
    const to = emailByUser.get(item.userId);
    if (!to) {
      await releaseClaim(supabase, claimedId);
      report.skipped++;
      report.items.push({ ...base, action: 'skipped', reason: 'no_email_on_profile' });
      continue;
    }

    const emailData: SubscriptionEmailData = {
      id: item.subscriptionId,
      name: item.name,
      price: item.price,
      currency: item.currency,
      billingCycle: item.billingCycle,
      nextBillingDate: item.renewalDate,
      daysUntilRenewal: item.daysUntilRenewal,
    };

    const result = await sendRenewalReminderEmail(to, emailData);
    if (result.ok) {
      report.emailsSent++;
      report.items.push({ ...base, action: 'sent' });
      await logActivity(supabase, item, 'reminder_sent', 'Renewal reminder sent');
    } else {
      await releaseClaim(supabase, claimedId);
      if (result.skipped) {
        report.skipped++;
        report.items.push({ ...base, action: 'skipped', reason: 'email_not_configured' });
      } else {
        report.failed++;
        report.items.push({ ...base, action: 'failed', reason: result.error ?? 'email_send_failed' });
      }
    }
  }

  // The in-app inbox reads `inbox_items`, not `activity_log`. Writing it here —
  // independent of whether email or push succeeded — is what makes the reminder
  // visible inside the app itself, including for a user who has no device
  // subscribed and no email on file. A dry run still changes nothing.
  if (!dryRun) {
    for (const item of notified.values()) {
      await addInboxReminder(supabase, item);
    }
  }

  logger.info('[reminders] run complete', {
    today,
    dryRun,
    considered: report.considered,
    pushSent: report.pushSent,
    emailsSent: report.emailsSent,
    skipped: report.skipped,
    failed: report.failed,
  });

  return report;
}

async function releaseClaim(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<void> {
  const { error } = await supabase.from('reminder_deliveries').delete().eq('id', id);
  if (error) {
    logger.error('[reminders] could not release claim', { id, message: error.message });
  }
}

/**
 * Mirror a successful send into activity_log so the in-app activity feed keeps
 * showing reminder history. Idempotency now lives in reminder_deliveries; this
 * is display only.
 */
async function logActivity(
  supabase: SupabaseClient<Database>,
  item: {
    subscriptionId: string;
    userId: string;
    name: string;
    price: number;
    currency: string;
    renewalDate: string;
  },
  type: 'reminder_sent',
  title: string
): Promise<void> {
  const { error } = await supabase.from('activity_log').insert({
    user_id: item.userId,
    subscription_id: item.subscriptionId,
    subscription_name: item.name,
    type,
    title,
    description: `Reminder for a charge on ${item.renewalDate}.`,
    timestamp: new Date().toISOString(),
    amount: item.price,
    currency: item.currency,
  });
  if (error) {
    logger.warn('[reminders] could not write activity_log', {
      subscriptionId: item.subscriptionId,
      message: error.message,
    });
  }
}

/**
 * Mirror a successful reminder into the in-app inbox.
 *
 * The inbox is backed by `inbox_items` and reads nothing from `activity_log`, so
 * a reminder that only ever reached email or push would be invisible inside the
 * app. Writing one row per (subscription, renewal) closes that gap and also
 * covers the case where every channel was unavailable — the notice is still
 * waiting in the inbox.
 */
async function addInboxReminder(
  supabase: SupabaseClient<Database>,
  item: {
    subscriptionId: string;
    userId: string;
    name: string;
    price: number;
    currency: string;
    renewalDate: string;
    minutesUntilRenewal: number;
    leadMinutes: number;
    daysUntilRenewal: number;
  }
): Promise<void> {
// One notice per (subscription, renewal, lead stage). A later run can send the
  // same stage on a channel that was unavailable the first time, so the check is
  // against the DB rather than just the current run's set. The stage is part of
  // the lookup because a renewal now produces several distinct notices by design.
  const { data: existing, error: lookupError } = await supabase
    .from('inbox_items')
    .select('id')
    .eq('user_id', item.userId)
    .filter('metadata->>renewalDate', 'eq', item.renewalDate)
    .filter('metadata->>subscriptionId', 'eq', item.subscriptionId)
    .filter('metadata->>leadMinutes', 'eq', item.leadMinutes)
    .limit(1);

  if (!lookupError && existing && existing.length > 0) return;

  /* The repayment day says it renews today; a lapsed row says it is overdue,
     in the calendar words the run's own trace uses. The two read nothing
     alike, so an inbox scan tells day-of and overdue stages apart at a
     glance. */
  const overdue = item.daysUntilRenewal < 0;
  const { error } = await supabase.from('inbox_items').insert({
    user_id: item.userId,
    type: 'renewal',
    title: overdue
      ? `${item.name} is overdue`
      : `${item.name} ${humanizeRenewal(item.minutesUntilRenewal)}`,
    description: overdue
      ? `Your ${item.name} subscription was due on ${item.renewalDate}. Mark it renewed here, or cancel it.`
      : `Your ${item.name} subscription renews on ${item.renewalDate}.`,
    date: new Date().toISOString(),
    is_read: false,
    action_type: 'view',
    action_label: 'View subscription',
    subscription_name: item.name,
    subscription_price: item.price,
    currency: item.currency,
    metadata: {
      subscriptionId: item.subscriptionId,
      renewalDate: item.renewalDate,
      leadMinutes: item.leadMinutes,
    } as Json,
  });
  if (error) {
    logger.warn('[reminders] could not write inbox_items', {
      subscriptionId: item.subscriptionId,
      message: error.message,
    });
  }
}

export { MAX_PUSH_PER_RUN, MAX_EMAILS_PER_RUN };
