import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { getAccountAuthMethods } from '@/lib/auth/account-methods';

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

    return NextResponse.json({ methods: match ? getAccountAuthMethods(match) : [] });
  } catch {
    return NextResponse.json({ methods: [] }, { status: 500 });
  }
}