import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';
import { sendPushToUser } from '@/lib/push/send';
import { isoWeekStart } from '@/lib/utils/iso-week';
import { getSubscriptionHistoryState, isOverdueSubscription } from '@/lib/services/subscription-service';

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
 * Claim-first and atomic. Before sending, the route inserts this week's
 * activity row via `upsert(..., ignoreDuplicates)`; the partial unique index
 * on (`user_id`, `title`) for `weekly_recap_pushed` rows (migration 020)
 * makes exactly one run win, so a retried or overlapping run cannot send the
 * recap twice and a new week re-arms the check on its own. A claim that does
 * not end in a send (no push permission, or push failure) is released so a
 * later run can retry it. If the index is missing (migration not applied),
 * the upsert errors and the route falls back to the old check-then-insert
 * behaviour rather than failing.
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
    // cancelled. Archived / deleted rows (history state in notes) and overdue
    // rows are also excluded — only actively tracked subscriptions count.
    const { data: counts, error: countError } = await supabase
      .from('subscriptions')
      .select('user_id, notes, status, next_billing_date')
      .in('user_id', userIds)
      .neq('status', 'canceled')
      .limit(MAX_USERS_PER_RUN * 10);

    if (countError) throw countError;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const countByUser = new Map<string, number>();
    for (const row of counts ?? []) {
      if (!row.user_id) continue;
      if (getSubscriptionHistoryState(row as unknown as import('@/lib/services/subscription-service').SubscriptionRow).state !== 'active') continue;
      if (isOverdueSubscription({ status: row.status, next_billing_date: row.next_billing_date }, today)) continue;
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

      // Atomic claim before the send: the partial unique index on
      // (user_id, title) makes a concurrent second claim lose, so only one
      // run can proceed to send. A missing index (migration not applied)
      // surfaces as claim.error and falls back to check-then-insert below.
      const claim = await supabase
        .from('activity_log')
        .upsert(
          {
            user_id: userId,
            type: 'weekly_recap_pushed',
            /* The visible title says "sent", like every other feed entry. The
               type keeps its migration-020 idempotency key, so the dedup claim
               and the weekStart check are untouched. */
            title: `Weekly recap sent — ${weekStart.slice(0, 10)}`,
            description: `Weekly recap sent for ${count} active subscriptions.`,
            timestamp: new Date().toISOString(),
            amount: 0,
            currency: 'USD',
          },
          { onConflict: 'user_id,title', ignoreDuplicates: true }
        )
        .select('id');

      const claimId = claim.data?.[0]?.id ?? null;

      if (claim.error) {
        logger.warn('[cron/weekly-recap] atomic claim unavailable; using fallback', {
          message: claim.error.message,
        });
      } else if (!claimId) {
        summary.skippedAlreadySent++;
        continue;
      }

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
        // Release the claim so a later run can retry it.
        if (claimId) await supabase.from('activity_log').delete().eq('id', claimId);
        continue;
      }

      if (result.sent > 0) {
        summary.sent++;
        if (!claimId) {
          // Fallback path (no unique index): record the send the way this
          // route always did.
          await supabase.from('activity_log').insert({
            user_id: userId,
            type: 'weekly_recap_pushed',
            title: 'Weekly recap sent',
            description: `Weekly recap sent for ${count} active subscriptions.`,
            timestamp: new Date().toISOString(),
            amount: 0,
            currency: 'USD',
          });
        }
      } else {
        summary.failed++;
        if (claimId) await supabase.from('activity_log').delete().eq('id', claimId);
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