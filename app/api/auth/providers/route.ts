import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { getAccountAuthMethods } from '@/lib/auth/account-methods';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

/**
 * Returns the sign-in methods of the account for a given email, so the login
 * flow can route a user to the method their account actually supports (a Google
 * account must go through Google; an email/password account must not be shown a
 * Google button). Uses the service-role key against the GoTrue admin users
 * endpoint — the `filter` query is not supported on this project, but `search`
 * is, so the result is exact-matched on email here.
 *
 * A missing account, a missing service-role config, or an admin-API error all
 * return `{ methods: [] }` with a non-200 status so the client falls back to the
 * stored/provider-based routing instead of breaking the login form.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email || !email.includes('@')) {
      return NextResponse.json({ methods: [] }, { status: 400 });
    }

    // This endpoint can confirm whether an account exists and which sign-in
    // methods it uses, so it is the app's main enumeration surface. A per-IP
    // bucket tighter than the global 30/min window keeps probing slow; on
    // exhaustion the client falls back to provider-based routing.
    const allowed = await checkRateLimit(`auth-providers:ip:${getClientIp(request)}`, {
      windowSeconds: 60,
      maxRequests: 5,
    });
    if (!allowed) {
      return NextResponse.json({ methods: [] }, { status: 429 });
    }

    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ methods: [] }, { status: 503 });
    }

    const searchParams = new URLSearchParams({
      search: email,
      per_page: '50',
    });

    const res = await fetch(
      `${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users?${searchParams.toString()}`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );

    if (!res.ok) {
      return NextResponse.json({ methods: [] }, { status: 502 });
    }

    const data = (await res.json().catch(() => ({ users: [] }))) as {
      users?: { email?: string; app_metadata?: Record<string, unknown> | null }[];
    };

    const match = (data.users || []).find(
      (user) => typeof user.email === 'string' && user.email.toLowerCase() === email
    );

    if (!match) {
      /*
       * Not found is not the same as found-with-no-methods, and the difference is
       * the whole point of this endpoint. Returning 200 with an empty list told the
       * client "this account cannot use Google", which is the one thing an empty
       * search result cannot establish — so a Google account whose row the search
       * missed was routed to a password form it can never pass.
       *
       * A non-200 is the endpoint's own documented signal for "I could not
       * determine this", and it is what makes the caller fall back to the provider
       * stored on the remembered account.
       */
      return NextResponse.json({ methods: [] }, { status: 404 });
    }

    return NextResponse.json({ methods: getAccountAuthMethods(match) });
  } catch {
    return NextResponse.json({ methods: [] }, { status: 500 });
  }
}