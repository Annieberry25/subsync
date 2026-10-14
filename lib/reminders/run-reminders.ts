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
  MAX_LEAD_MINUTES,
  type PlannedReminder,
  type PlannerPreference,
  type PlannerSubscription,
  type ReminderChannel,
} from './plan';

/**
 * The renewal-reminder engine.
 *
 * Reads every non-canceled subscription renewing inside the widest configured
 * lead window, decides what is due (see `planReminders`), and sends it to the
 * right channels for each user, recording one row per (subscription, renewal,
 * offset, channel) so nothing is ever sent twice for the same renewal.
 *
 * Kept out of the route so both the Vercel cron and the manual admin trigger run
 * exactly the same code and it can be exercised with a real `dryRun` that
 * changes nothing.
 */

const MAX_PUSH_PER_RUN = 400;
const MAX_EMAILS_PER_RUN = 200;
/** A runaway guard on how many rows a single run will even look at. */
const MAX_SUBSCRIPTIONS_PER_RUN = 5000;

export type ReminderAction = 'sent' | 'would_send' | 'skipped' | 'failed';

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
  /** Full per-reminder trace, so a manual run can be inspected. */
  items: ReminderRunItem[];
}

export interface RunReminderOptions {
  supabase: SupabaseClient<Database>;
  now?: Date;
  dryRun?: boolean;
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
    items: [],
  };

  // ---- Load candidate subscriptions renewing between today and the horizon ----
  const { data: subs, error: subsError } = await supabase
    .from('subscriptions')
    .select('id, user_id, name, price, currency, next_billing_date, billing_cycle, status')
    .neq('status', 'canceled')
    .gte('next_billing_date', today)
    .lte('next_billing_date', horizon)
    .limit(MAX_SUBSCRIPTIONS_PER_RUN);

  if (subsError) throw subsError;

  const rows = (subs ?? []).filter((s) => s.id && s.user_id && s.next_billing_date);
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
  }));

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

    if (item.channel === 'push') {
      const renewsOn = humanizeRenewal(item.minutesUntilRenewal);

      const result = await sendPushToUser(item.userId, {
        title: `${item.name} ${renewsOn}`,
        body: 'A heads-up so the next charge is not a surprise.',
        url: '/subscriptions',
        tag: `renewal-${item.subscriptionId}-${item.leadMinutes}`,
      });

      if (result.sent > 0) {
        report.pushSent++;
        report.items.push({ ...base, action: 'sent' });
        await logActivity(supabase, item, 'reminder_pushed', 'Renewal reminder pushed');
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
  type: 'reminder_sent' | 'reminder_pushed',
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

  const { error } = await supabase.from('inbox_items').insert({
    user_id: item.userId,
    type: 'renewal',
    title: `${item.name} ${humanizeRenewal(item.minutesUntilRenewal)}`,
    description: `Your ${item.name} subscription renews on ${item.renewalDate}.`,
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
