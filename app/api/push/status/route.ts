import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/auth/access';
import { isPushConfigured } from '@/lib/push/send';

export const dynamic = 'force-dynamic';

/**
 * Push health for the signed-in account, so "my reminders aren't arriving" is
 * answerable in the app instead of by reading server logs.
 *
 * The delivery ledger is written as a claim *before* the send and released again
 * when nothing was delivered, so a row here means the push service accepted the
 * message. That is still not the same as a notification appearing on a phone —
 * iOS accepts pushes for subscriptions created outside an installed web app and
 * displays nothing — so the client labels this as "accepted", never "received".
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized user session.' }, { status: 401 });
    }

    const admin = createAdminClient();

    const [endpointsRes, pushRes, emailRes] = await Promise.all([
      admin.from('push_subscriptions').select('id, last_used_at').eq('user_id', user.id),
      admin
        .from('reminder_deliveries')
        .select('sent_at, subscription_name')
        .eq('user_id', user.id)
        .eq('channel', 'push')
        .order('sent_at', { ascending: false })
        .limit(1),
      admin
        .from('reminder_deliveries')
        .select('sent_at')
        .eq('user_id', user.id)
        .eq('channel', 'email')
        .order('sent_at', { ascending: false })
        .limit(1),
    ]);

    const syncTimes = (endpointsRes.data ?? [])
      .map((row) => row.last_used_at)
      .filter((value): value is string => typeof value === 'string')
      .sort();

    return NextResponse.json({
      configured: isPushConfigured(),
      devices: endpointsRes.data?.length ?? 0,
      lastDeviceSyncAt: syncTimes.length ? syncTimes[syncTimes.length - 1] : null,
      lastPushAt: pushRes.data?.[0]?.sent_at ?? null,
      lastPushFor: pushRes.data?.[0]?.subscription_name ?? null,
      lastEmailAt: emailRes.data?.[0]?.sent_at ?? null,
    });
  } catch (err) {
    console.error('[push/status] unexpected error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}