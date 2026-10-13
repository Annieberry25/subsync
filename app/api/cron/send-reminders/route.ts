import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { runRenewalReminders } from '@/lib/reminders/run-reminders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Renewal reminders — the automatic day-before, plus each user's opt-in reminder.
 *
 * This one cannot be a database webhook: a reminder is a function of the clock,
 * not of a row changing, so nothing in the database fires at the right moment.
 *
 * ## Cadence
 *
 * The automatic day-before reminder is anchored 24h before the renewal, so a
 * single daily run catches it. The user's own reminder can be as close as 3
 * hours before, which only a run at least that often can deliver on time:
 * schedule this route hourly (`0 * * * *`) for hour-precision. On a Vercel plan
 * that only allows a daily cron, point a free external timer at this endpoint
 * hourly with the cron secret instead. The daily `"0 9 * * *"` in `vercel.json`
 * is the fallback that still delivers the day-before reminder.
 *
 * The logic lives in `lib/reminders/run-reminders.ts` so the manual admin
 * trigger runs the identical code path. This route is only auth + invoke.
 *
 * ## Idempotency
 *
 * Every send is recorded in `reminder_deliveries`, keyed by
 * (subscription, renewal date, lead offset in minutes, channel) with a unique
 * constraint. A run — or a retry, or an overlapping cron — cannot deliver the
 * same reminder twice for the same renewal. Because the key is the renewal and
 * not the send time, a run that was missed still catches up on a later run
 * without duplicating, until the renewal passes.
 *
 * ## Manual run
 *
 * `GET /api/cron/send-reminders?dryRun=1` computes what would send and changes
 * nothing. `?dryRun=0` (the default) sends. Both require the cron secret and
 * return the full per-reminder trace.
 */
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

  const dryRun = new URL(request.url).searchParams.get('dryRun') === '1';

  try {
    const supabase = createAdminClient();
    const report = await runRenewalReminders({ supabase, dryRun });
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
