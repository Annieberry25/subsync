import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/access';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runRenewalReminders } from '@/lib/reminders/run-reminders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Deliver this account's due reminders immediately.
 *
 * The cron runs once a day, so a reminder saved after its tick waits up to a day
 * before anything is sent — even when it was already due at the moment it was
 * configured. This endpoint closes that gap: saving a reminder calls it, and the
 * engine runs for the caller only, covering every stage that is genuinely due
 * across all of their subscriptions. Their own opt-in reminder goes out, and so do
 * the automatic ones that have come due, because those are always on.
 *
 * Scoping is the whole point of this route and is enforced three ways: the caller
 * must have a session, the caller id is taken from that session rather than the
 * request body, and it is passed to the engine as a filter rather than applied
 * afterwards. There is no way to ask for somebody else's rows.
 *
 * Sends rather than dry-runs by default, because the caller's intent in saving a
 * reminder is to receive it. Re-running is harmless: every send is claimed in
 * reminder_deliveries under a unique key, so whatever already went out is skipped
 * as already_delivered.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const dryRun = new URL(request.url).searchParams.get('dryRun') === '1';

    // The admin client is needed because the delivery writes, the inbox rows and
    // the activity feed all sit behind RLS. It is only ever pointed at this one
    // user id, which comes from the session above.
    const report = await runRenewalReminders({
      supabase: createAdminClient(),
      dryRun,
      userId: user.id,
      autoRemove: false,
    });

    return NextResponse.json(report);
  } catch (err) {
    console.error('[reminders/run-now] unexpected error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}