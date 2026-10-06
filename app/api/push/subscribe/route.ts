import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/access';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Stores and removes this device's push endpoint.
 *
 * Written through the user's own Supabase client rather than the service role so
 * the RLS policies in migration 012 are the thing actually enforcing ownership —
 * a service-role write here would bypass them and prove nothing.
 */

interface SubscribeBody {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
}

/**
 * Push endpoints are HTTPS URLs from a browser-controlled origin. Validated
 * because this value is stored and later handed back to the push service: a
 * non-HTTPS or non-host endpoint would be an outbound-request target we do not
 * control.
 */
function isValidEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidKey(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 512;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized user session.' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as SubscribeBody;

    if (!isValidEndpoint(body?.endpoint) || !isValidKey(body?.keys?.p256dh) || !isValidKey(body?.keys?.auth)) {
      return NextResponse.json({ error: 'Invalid push subscription payload.' }, { status: 400 });
    }

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        user_agent: request.headers.get('user-agent'),
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,endpoint' }
    );

    if (error) {
      logger.error('[push/subscribe] upsert failed', { message: error.message });
      return NextResponse.json({ error: 'Could not save the subscription.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[push/subscribe] unexpected error', {
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized user session.' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { endpoint?: unknown };
    if (!isValidEndpoint(body?.endpoint)) {
      return NextResponse.json({ error: 'Invalid push subscription payload.' }, { status: 400 });
    }

    // Scoped by user_id as well as endpoint, so a request cannot remove a row
    // belonging to somebody else even if the endpoint is somehow known.
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', body.endpoint);

    if (error) {
      logger.error('[push/subscribe] delete failed', { message: error.message });
      return NextResponse.json({ error: 'Could not remove the subscription.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[push/subscribe] unexpected delete error', {
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}