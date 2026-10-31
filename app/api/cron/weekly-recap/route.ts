import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';
import { sendPushToUser } from '@/lib/push/send';
import { sendWeeklyRecapEmail } from '@/lib/email/send';
import { isoWeekStart } from '@/lib/utils/iso-week';
import { getSubscriptionHistoryState, isOverdueSubscription, type SubscriptionRow } from '@/lib/services/subscription-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Weekly recap, pushed every weekend.
 *
 * ## Why this exists
 *
 * One message per user summarising their subscriptions: what is coming up,
 * what was renewed this week, and what was added. Sent as both a push and an
 * email so it lands wherever the user is.
 *
 * ## Schedule
 * vercel.json declares `"0 10 * * 6"` — 10:00 UTC on Saturday.
 *
 * ## Idempotency
 * Claim-first and atomic. Before sending, the route inserts this week's
 * activity row via `upsert(..., ignoreDuplicates)`; the partial unique index
 * on (`user_id`, `title`) for `weekly_recap_pushed` rows (migration 020)
 * makes exactly one run win, so a retried or overlapping run cannot send the
 * recap twice and a new week re-arms the check on its own.
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Every profile, not every subscription: the recap is one message per user.
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, email')
      .limit(MAX_USERS_PER_RUN);

    if (profileError) throw profileError;
    summary.considered = profiles?.length ?? 0;

    if (!profiles || profiles.length === 0) {
      return NextResponse.json(summary);
    }

    const userIds = profiles.map((p) => p.id);
    const emailByUser = new Map<string, string>();
    for (const p of profiles ?? []) {
      if (p.id && p.email) emailByUser.set(p.id, p.email);
    }

    // Active subscriptions per user: excludes canceled, archived/deleted
    // (history state in notes) and overdue rows — only actively tracked ones.
    const { data: subs, error: subsError } = await supabase
      .from('subscriptions')
      .select('id, user_id, name, price, currency, notes, status, next_billing_date, start_date, created_at')
      .in('user_id', userIds)
      .neq('status', 'canceled')
      .limit(MAX_USERS_PER_RUN * 10);

    if (subsError) throw subsError;

    // Partition per user into coming up / recently renewed / new this week.
    const byUser = new Map<string, {
      count: number;
      comingUp: { name: string; nextBillingDate: string; price: number; currency: string | null }[];
      recentlyRenewed: { name: string; nextBillingDate: string }[];
      newThisWeek: { name: string; createdAt: string }[];
    }>();

    for (const row of subs ?? []) {
      if (!row.user_id) continue;
      if (getSubscriptionHistoryState(row as unknown as SubscriptionRow).state !== 'active') continue;
      if (isOverdueSubscription({ status: row.status, next_billing_date: row.next_billing_date }, today)) continue;

      let entry = byUser.get(row.user_id);
      if (!entry) {
        entry = { count: 0, comingUp: [], recentlyRenewed: [], newThisWeek: [] };
        byUser.set(row.user_id, entry);
      }
      entry.count++;

      const nextDate = row.next_billing_date;
      const diffTime = new Date(nextDate).getTime() - today.getTime();
      const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

      if (diffDays >= 0 && diffDays <= 10) {
        entry.comingUp.push({
          name: row.name,
          nextBillingDate: nextDate,
          price: Number(row.price) || 0,
          currency: row.currency ?? null,
        });
      }

      const createdAt = row.created_at || nextDate;
      const createdDiff = new Date(createdAt).getTime() - weekAgo.getTime();
      if (createdDiff >= 0) {
        entry.newThisWeek.push({
          name: row.name,
          createdAt: createdAt,
        });
      }
    }

    // Sort each bucket.
    for (const entry of byUser.values()) {
      entry.comingUp.sort((a, b) => new Date(a.nextBillingDate).getTime() - new Date(b.nextBillingDate).getTime());
      entry.recentlyRenewed.sort((a, b) => new Date(a.nextBillingDate).getTime() - new Date(b.nextBillingDate).getTime());
      entry.newThisWeek.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }

    const { data: alreadySent } = await supabase
      .from('activity_log')
      .select('user_id')
      .eq('type', 'weekly_recap_pushed')
      .gte('timestamp', weekStart);

    const sentThisWeek = new Set((alreadySent ?? []).map((r) => r.user_id).filter(Boolean) as string[]);

    for (const [userId, entry] of byUser) {
      if (entry.count === 0) continue;
      if (sentThisWeek.has(userId)) {
        summary.skippedAlreadySent++;
        continue;
      }

      const body =
        entry.count === 1
          ? 'You are tracking 1 subscription.'
          : `You are tracking ${entry.count} subscriptions.`;

      // Atomic claim before the send.
      const claim = await supabase
        .from('activity_log')
        .upsert(
          {
            user_id: userId,
            type: 'weekly_recap_pushed',
            title: `Weekly recap sent — ${weekStart.slice(0, 10)}`,
            description: `Weekly recap sent for ${entry.count} active subscriptions.`,
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

      // Push notification (best effort — email still sends even if push is skipped).
      const pushResult = await sendPushToUser(userId, {
        title: 'Your week in subscriptions',
        body,
        url: '/subscriptions',
        tag: 'weekly-recap',
      });

      // Email (summary lands before the sign-in button that the shell appends).
      const email = emailByUser.get(userId);
      let emailSent = false;
      if (email) {
        const emailResult = await sendWeeklyRecapEmail(email, {
          count: entry.count,
          comingUp: entry.comingUp,
          recentlyRenewed: entry.recentlyRenewed,
          newThisWeek: entry.newThisWeek,
        });
        emailSent = emailResult.ok;
      }

      if (pushResult.skipped) {
        // No push configured for this user; keep the claim so the run is
        // recorded as attempted, but count email as the delivery instead.
        if (emailSent) {
          summary.sent++;
        }
        continue;
      }

      if (pushResult.sent > 0 || emailSent) {
        summary.sent++;
        if (!claimId) {
          await supabase.from('activity_log').insert({
            user_id: userId,
            type: 'weekly_recap_pushed',
            title: 'Weekly recap sent',
            description: `Weekly recap sent for ${entry.count} active subscriptions.`,
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
