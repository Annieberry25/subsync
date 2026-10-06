import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/access';
import { logger } from '@/lib/logger';
import { sendPushToUser } from '@/lib/push/send';
import { getPushableInsight } from '@/lib/insights/generate-insights';
import {
  fetchSubscriptions,
  filterActiveSubscriptions,
} from '@/lib/services/subscription-service';

export const dynamic = 'force-dynamic';

/**
 * Push when the assistant finds a new insight.
 *
 * The dashboard card announces which insight it is showing; this verifies that
 * against the server's own copy before sending. The client is not trusted to
 * decide what the user is told — it could ask for any notification at any time,
 * and an unauthenticated-looking endpoint that sends on demand is a spam relay.
 *
 * ## Idempotency
 * A `smart_insight_pushed` activity row records the id, and a repeat is rejected.
 * Without it every dashboard visit would re-notify, which is how a notification
 * channel gets muted.
 */

/** How long one insight stays "already announced" before it may fire again. */
const RE_ANNOUNCE_AFTER_DAYS = 30;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized user session.' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { insightId?: unknown };
    const claimedId = typeof body?.insightId === 'string' ? body.insightId : null;
    if (!claimedId) {
      return NextResponse.json({ error: 'insightId is required.' }, { status: 400 });
    }

    // Recompute server-side. This is the check that matters: it is what stops the
    // endpoint from being used to push arbitrary content to arbitrary users.
    const { data: rows } = await fetchSubscriptions();
    const insight = getPushableInsight(filterActiveSubscriptions(rows ?? []));

    if (!insight) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'no-actionable-insight' });
    }

    if (insight.id !== claimedId) {
      // The client's view and the server's disagree. Most likely a stale tab after
      // a subscription changed. Sending the server's own insight instead is wrong
      // (the user has not seen this one yet) and sending the claimed one is
      // unverified, so nothing goes out.
      return NextResponse.json({ ok: true, skipped: true, reason: 'stale-insight-id' });
    }

    const reAnnounceBefore = new Date(
      Date.now() - RE_ANNOUNCE_AFTER_DAYS * 86400000
    ).toISOString();

    const { data: recent } = await supabase
      .from('activity_log')
      .select('id, metadata')
      .eq('type', 'smart_insight_pushed')
      .gte('timestamp', reAnnounceBefore)
      .order('timestamp', { ascending: false })
      .limit(1);

    const lastAnnounced = (recent ?? [])[0]?.metadata as
      | { insightId?: string }
      | null
      | undefined;

    if (lastAnnounced?.insightId === insight.id) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'already-announced' });
    }

    const result = await sendPushToUser(user.id, {
      title: 'SubHalt found something',
      body: 'Hey friend, look what your SubHalt assistant found for you. Tap to review',
      // The card lives on the dashboard; there is no separate insights route, so
      // this is where the tap has to land for the user to see the same insight
      // that triggered the notification.
      url: '/',
      tag: `insight-${insight.id}`,
    });

    if (result.skipped) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'no-subscription' });
    }

    if (result.sent > 0) {
      await supabase.from('activity_log').insert({
        user_id: user.id,
        type: 'smart_insight_pushed',
        title: 'Insight notification pushed',
        description: insight.preview,
        metadata: { insightId: insight.id },
        timestamp: new Date().toISOString(),
        amount: 0,
        currency: 'USD',
      });
    }

    return NextResponse.json({ ok: true, sent: result.sent });
  } catch (err) {
    logger.error('[push/insight] unexpected error', {
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}