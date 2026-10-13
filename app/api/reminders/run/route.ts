import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { createAdminClient } from '@/lib/supabase/admin';
import { runRenewalReminders } from '@/lib/reminders/run-reminders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Manual trigger for the daily renewal-reminder check.
 *
 * Exists so the engine can be verified without waiting days for a cron tick or
 * reaching for the cron secret. Admin-only (session), and it runs the exact code
 * the Vercel cron runs.
 *
 * `GET /api/reminders/run` — dry run: reports what would send, changes nothing.
 * `GET /api/reminders/run?dryRun=0` — actually sends and records deliveries.
 *
 * The response body is the full per-reminder trace (see ReminderRunReport), so
 * "what did it check and send" is answerable directly.
 */
export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    // Dry run unless explicitly told otherwise. A manual poke should not send
    // real notifications to real users by accident.
    const dryRun = new URL(request.url).searchParams.get('dryRun') !== '0';
    const supabase = createAdminClient();
    const report = await runRenewalReminders({ supabase, dryRun });

    return NextResponse.json(report);
  } catch (err) {
    console.error('[reminders/run] unexpected error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
