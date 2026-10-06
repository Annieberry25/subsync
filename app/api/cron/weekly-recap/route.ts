import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';
import { sendPushToUser } from '@/lib/push/send';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Weekly recap, pushed every weekend.
 *
 * ## Why this exists
 *
 * Two problems at once. It is the retention nudge the product needs — a weekly
 * "here is what you are paying for" is the message most likely to bring someone
 * back — and it costs nothing on the Resend allowance, which is the constraint
 * that pushed the other alerts off email. A per-subscription creation mail would
 * have been the same message N times over; this is once a week regardless of how
 * much the user added.
 *
 * ## Schedule
 * vercel.json declares `"0 10 * * 6"` — 10:00 UTC on Saturday. Saturday rather than
 * Sunday because a weekend-morning recap is useful before people start planning
 * purchases, and the daily reminder cron sits at 09:00 so the two do not collide.
 *
 * ## Idempotency
 * Guarded by an activity_log row keyed to the ISO week, so a retried or
 * overlapping run cannot send the recap twice. Retries here are plausible: Vercel
 * will re-run a cron that overruns its window, and this sends one message per user
 * rather than per subscription.
 */

const MAX_USERS_PER_RUN = 500;

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

/**
 * Monday 00:00 UTC of the week containing `date`.
 *
 * Used as the idempotency window rather than an ISO week label. The label is
 * correct but needs a date comparison the database cannot make against a string,
 * so the Monday boundary gives the same "once per week" guarantee with a plain
 * `gte` on a real timestamp.
 *
 * Exported so the weekly-rollover property is testable; the cron itself is the only
 * caller.
 */
export function isoWeekStart(date: Date): string {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber);
  return target.toISOString();
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const summary = { considered: 0, sent: 0, skippedNoSubscriptions: 0, skippedAlreadySent: 0, failed: 0 };

  try {
    const supabase = createAdminClient();
    const weekStart = isoWeekStart(new Date());

    // Every profile, not every subscription: the recap is one message per user.
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .limit(MAX_USERS_PER_RUN);

    if (profileError) throw profileError;
    summary.considered = profiles?.length ?? 0;

    if (!profiles || profiles.length === 0) {
      return NextResponse.json(summary);
    }

    const userIds = profiles.map((p) => p.id);

    // Active count per user in one query. Canceled rows are excluded because a
    // count that includes them tells the user they are paying for something they
    // cancelled, which is worse than not sending.
    const { data: counts, error: countError } = await supabase
      .from('subscriptions')
      .select('user_id')
      .in('user_id', userIds)
      .neq('status', 'canceled')
      .limit(MAX_USERS_PER_RUN * 10);

    if (countError) throw countError;

    const countByUser = new Map<string, number>();
    for (const row of counts ?? []) {
      if (!row.user_id) continue;
      countByUser.set(row.user_id, (countByUser.get(row.user_id) ?? 0) + 1);
    }

    const { data: alreadySent } = await supabase
      .from('activity_log')
      .select('user_id')
      .eq('type', 'weekly_recap_pushed')
      .gte('timestamp', weekStart);

    const sentThisWeek = new Set((alreadySent ?? []).map((r) => r.user_id).filter(Boolean) as string[]);

    for (const [userId, count] of countByUser) {
      if (count === 0) continue;
      if (sentThisWeek.has(userId)) {
        summary.skippedAlreadySent++;
        continue;
      }

      const body =
        count === 1
          ? 'You are tracking 1 subscription. Tap to see it.'
          : `You are tracking ${count} subscriptions. Tap to review them.`;

      const result = await sendPushToUser(userId, {
        title: 'Your week in subscriptions',
        body,
        url: '/subscriptions',
        // One shared tag: a weekly recap is a single event, so a retry replaces
        // the earlier notification instead of stacking a second copy.
        tag: 'weekly-recap',
      });

      if (result.skipped) {
        // No permission granted. Normal — most users will be in this bucket.
        continue;
      }

      if (result.sent > 0) {
        summary.sent++;
        await supabase.from('activity_log').insert({
          user_id: userId,
          type: 'weekly_recap_pushed',
          title: 'Weekly recap pushed',
          description: `Weekly recap sent for ${count} active subscriptions.`,
          timestamp: new Date().toISOString(),
          amount: 0,
          currency: 'USD',
        });
      } else {
        summary.failed++;
      }
    }

    logger.info('[cron/weekly-recap] complete', summary);
    return NextResponse.json(summary);
  } catch (err) {
    logger.error('[cron/weekly-recap] unexpected error', {
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}