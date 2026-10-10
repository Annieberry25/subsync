import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';
import { sendRenewalReminderEmail } from '@/lib/email/send';
import { sendPushToUser } from '@/lib/push/send';
import type { SubscriptionEmailData } from '@/lib/email/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Renewal reminders — push by default, email only on request.
 *
 * This one cannot be a database webhook: a reminder is a function of the clock,
 * not of a row changing, so nothing in the database fires at the right moment.
 * It runs as a Vercel cron, same auth shape as /api/cron/gmail-rescan.
 *
 * ## Schedule
 * vercel.json declares `"0 9 * * *"`. 09:00 UTC rather than 06:00 (the Gmail
 * rescan slot) so the two crons do not hit Supabase at the same minute.
 *
 * ## Why the defaults are the way they are
 *
 * The email is opt-in now. It used to fire for every non-canceled row inside the
 * window, which meant every user got mail for every subscription whether or not
 * they wanted it — and on the Resend free tier that allowance is the binding
 * constraint on the whole product. The 10-day "coming up" notice is now push,
 * which is free at this volume and a better fit for a nudge that does not need an
 * inbox. Email is sent only where a `subscription_reminders` row says the user
 * asked for it, and at the lead time they chose.
 *
 * ## Idempotency
 * The webhook path can run more than once — Supabase retries on a non-2xx, and
 * a cron can overlap if one run overruns the next. Re-sending the same reminder
 * is the visible failure here, so a record is written per subscription per cycle
 * per channel and checked before sending. The cycle key is the UTC date, which
 * makes the guard stable across retries within a day and naturally expires.
 */

const PUSH_LEAD_DAYS = 10;
/**
 * Widest email lead the reminder sheet can save — `EMAIL_LEAD_CHOICES` tops out at
 * 14. Kept next to PUSH_LEAD_DAYS because the query horizon is a function of both.
 */
const MAX_EMAIL_LEAD_DAYS = 14;
const MAX_PUSH_PER_RUN = 400;
const MAX_EMAILS_PER_RUN = 200;
/** Ceiling on emails per run, independent of how many rows opted in. */
const OVERDUE_CEILING_DAYS = 60;

function constantTimeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function isAuthorized(request: Request): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return false;
  const header =
    request.headers.get('x-cron-secret') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    request.headers.get('x-upstream-auth');
  return header !== null && constantTimeEqual(header, secret);
}

function utcCycleKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** YYYY-MM-DD, n days from today, in UTC. */
function utcDateOffset(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

function daysUntil(dateString: string): number {
  return Math.round((new Date(dateString).getTime() - Date.now()) / 86400000);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const summary = {
    considered: 0,
    pushSent: 0,
    emailsSent: 0,
    skippedAlreadySent: 0,
    skippedNoEmail: 0,
    skippedNoPreference: 0,
    failed: 0,
  };

  try {
    const supabase = createAdminClient();
    const cycle = utcCycleKey();
    const overdueFloor = utcDateOffset(-OVERDUE_CEILING_DAYS);

    /*
     * The widest window either channel can need.
     *
     * Both leads are user-chosen, and the schema only asserts they are positive —
     * the email control offers up to 14 days — so the horizon has to come from the
     * largest lead the UI can produce rather than from the push default. Sizing it
     * at PUSH_LEAD_DAYS alone would drop every 11–14 day email reminder from the
     * query entirely: no row, no preference check, no mail, and no error anywhere
     * to say so.
     */
    const horizon = utcDateOffset(Math.max(PUSH_LEAD_DAYS, MAX_EMAIL_LEAD_DAYS));

    const { data: rows, error } = await supabase
      .from('subscriptions')
      .select('id, user_id, name, price, currency, billing_cycle, next_billing_date')
      .neq('status', 'canceled')
      // Past this floor a subscription has been abandoned for two months; nagging
      // about it forever is how a notification becomes something people mute.
      .gte('next_billing_date', overdueFloor)
      .lte('next_billing_date', horizon)
      .limit(MAX_PUSH_PER_RUN);

    if (error) throw error;
    summary.considered = rows?.length ?? 0;

    if (!rows || rows.length === 0) {
      return NextResponse.json(summary);
    }

    const { data: preferences, error: prefError } = await supabase
      .from('subscription_reminders')
      .select('subscription_id, email_enabled, email_lead_days, push_enabled, push_lead_days')
      .in(
        'subscription_id',
        rows.map((r) => r.id)
      );

    if (prefError) throw prefError;

    // Keyed by subscription_id: the preference is per subscription, and a user
    // with two subscriptions must not inherit one's setting onto the other.
    const prefBySub = new Map(
      (preferences ?? [])
        .filter((p) => p.subscription_id)
        .map((p) => [p.subscription_id as string, p])
    );

    const ownerIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', ownerIds);

    const emailByUser = new Map(
      (profiles ?? [])
        .filter((p) => p.email)
        .map((p) => [p.id as string, p.email as string])
    );

    const { data: alreadySent } = await supabase
      .from('activity_log')
      .select('subscription_id, type')
      .in('type', ['reminder_sent', 'reminder_pushed'])
      .gte('timestamp', `${cycle}T00:00:00.000Z`);

    // Composite key: the same subscription can legitimately be pushed at a 10-day
    // lead and emailed at a 3-day lead on the same day, and keying on the id alone
    // would let whichever ran first suppress the other.
    const sentThisCycle = new Set(
      (alreadySent ?? [])
        .filter((row) => row.subscription_id && row.type)
        .map((row) => `${row.subscription_id}:${row.type}`)
    );

    for (const row of rows) {
      const pref = prefBySub.get(row.id);
      if (!pref) {
        // No saved preference. Push still applies, because a subscription is
        // implicitly worth knowing about before it renews; email never does,
        // since nothing was asked for.
        summary.skippedNoPreference++;
      }

      const name = row.name ?? 'Your subscription';
      const price = Number(row.price) || 0;
      const currency = row.currency ?? 'USD';
      const days = daysUntil(row.next_billing_date ?? '');

      // ---- Push: the 10-day "coming up" notice ----
      const pushLead = pref?.push_lead_days ?? PUSH_LEAD_DAYS;
      const pushWanted = pref?.push_enabled ?? true;
      /*
       * A window, not an exact match on the lead day.
       *
       * Requiring `days === pushLead` means a single missed run — a deploy during
       * the slot, a Vercel cron delayed past 09:00, a clock skew between here and
       * the billing date — silently drops the notification for that cycle and it
       * is never retried, because the next day is a different day. Anything still
       * upcoming and inside the lead window qualifies, and the idempotency marker
       * keeps it to one per cycle.
       */
      const pushDue = days > 0 && days <= pushLead;
      if (pushWanted && pushDue && !sentThisCycle.has(`${row.id}:reminder_pushed`)) {
        const result = await sendPushToUser(row.user_id, {
          title: `${name} renews in ${pushLead} days`,
          body: `${formatAmount(price, currency)} ${cycleLabel(row.billing_cycle)}. Tap to review.`,
          url: `/subscriptions?highlight=${row.id}&detail=true`,
          tag: `renewal-${row.id}`,
        });

        if (result.skipped) {
          // No permission or no VAPID key: not a failure, and no marker burned so
          // it can still fire once the user grants permission.
          summary.skippedNoEmail++;
        } else if (result.sent > 0) {
          summary.pushSent++;
          sentThisCycle.add(`${row.id}:reminder_pushed`);
          await logReminder(supabase, {
            userId: row.user_id,
            subscriptionId: row.id,
            subscriptionName: name,
            type: 'reminder_pushed',
            title: 'Renewal reminder pushed',
            description: `Push notification for a charge on ${row.next_billing_date}.`,
            amount: price,
            currency,
          });
        } else {
          summary.failed++;
        }
      }

      // ---- Email: opt-in only, at the user's chosen lead ----
      const emailLead = pref?.email_lead_days ?? null;
      /*
       * Same window logic as push: `days === emailLead` would drop the mail for
       * the whole cycle if the cron missed the exact day, and an email the user
       * explicitly asked for is the one thing here that must not be lost.
       */
      const emailDue = days > 0 && emailLead !== null && days <= emailLead;
      if (
        pref?.email_enabled &&
        emailDue &&
        summary.emailsSent < MAX_EMAILS_PER_RUN &&
        !sentThisCycle.has(`${row.id}:reminder_sent`)
      ) {
        const to = emailByUser.get(row.user_id);
        if (!to) {
          summary.skippedNoEmail++;
        } else {
          const data: SubscriptionEmailData = {
            id: row.id,
            name,
            price,
            currency,
            billingCycle: row.billing_cycle ?? 'monthly',
            nextBillingDate: row.next_billing_date ?? '',
            daysUntilRenewal: days,
          };

          const result = await sendRenewalReminderEmail(to, data);

          if (result.ok) {
            summary.emailsSent++;
            sentThisCycle.add(`${row.id}:reminder_sent`);
            await logReminder(supabase, {
              userId: row.user_id,
              subscriptionId: row.id,
              subscriptionName: name,
              type: 'reminder_sent',
              title: 'Renewal reminder sent',
              description: `Reminder emailed for a charge on ${row.next_billing_date}.`,
              amount: price,
              currency,
            });
          } else if (result.skipped) {
            // No API key: leave the marker unburned so a real send happens once
            // keys exist.
            summary.skippedNoEmail++;
          } else {
            summary.failed++;
            logger.error('[cron/send-reminders] email send failed', {
              subscriptionId: row.id,
              message: result.error,
            });
          }
        }
      }
    }

    logger.info('[cron/send-reminders] complete', summary);
    return NextResponse.json(summary);
  } catch (err) {
    logger.error('[cron/send-reminders] unexpected error', {
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

async function logReminder(
  supabase: ReturnType<typeof createAdminClient>,
  entry: {
    userId: string;
    subscriptionId: string;
    subscriptionName: string;
    type: string;
    title: string;
    description: string;
    amount: number;
    currency: string;
  }
) {
  await supabase.from('activity_log').insert({
    user_id: entry.userId,
    subscription_id: entry.subscriptionId,
    subscription_name: entry.subscriptionName,
    type: entry.type,
    title: entry.title,
    description: entry.description,
    timestamp: new Date().toISOString(),
    amount: entry.amount,
    currency: entry.currency,
  });
}

function cycleLabel(cycle: string | undefined): string {
  switch ((cycle || '').toLowerCase()) {
    case 'yearly':
    case 'annual':
      return 'a year';
    case 'weekly':
      return 'a week';
    case 'quarterly':
      return 'a quarter';
    case 'monthly':
    default:
      return 'a month';
  }
}

function formatAmount(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

export async function POST(request: Request) {
  return GET(request);
}