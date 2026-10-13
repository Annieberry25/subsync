import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/access';
import { sendPushToUser, isPushConfigured } from '@/lib/push/send';
import { sendTestNotificationEmail } from '@/lib/email/send';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * One test push + one test email, immediately, to the signed-in user.
 *
 * The Settings button that calls this is how the whole path gets verified
 * without waiting for a renewal date: if the test arrives, the cron will too;
 * if it does not, the response says exactly which half failed and why (no
 * subscription for this device, VAPID key missing, no email on file, provider
 * rejected it).
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized user session.' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', user.id)
      .maybeSingle();

    const push = await sendPushToUser(user.id, {
      title: 'SubHalt test notification',
      body: 'If you can see this, renewal reminders will reach this device.',
      url: '/settings?section=preferences',
      tag: 'subhalt-test',
    });

    const to = profile?.email ?? user.email ?? null;
    const email = to
      ? await sendTestNotificationEmail(to, profile?.full_name ?? null)
      : { ok: false, error: 'No email address on file.' };

    return NextResponse.json({
      recipient: to,
      push: { ...push, configured: isPushConfigured() },
      email,
    });
  } catch (err) {
    console.error('[notifications/test] unexpected error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
