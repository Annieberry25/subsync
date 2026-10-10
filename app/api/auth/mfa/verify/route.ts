import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Completes the second-factor challenge for the session already on the request.
 *
 * The password sign-in route writes the `aal1` session through the server cookie
 * adapter, and this route upgrades it the same way: `challengeAndVerify` mints a
 * new `aal2` token whose Set-Cookie lands on the response. Doing it server-side
 * (rather than in the browser) keeps the session in one place — the cookie the
 * middleware already trusts — instead of depending on the browser Supabase
 * singleton having hydrated the session mid-flow.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const factorId = typeof body.factorId === 'string' ? body.factorId : '';
    const code = typeof body.code === 'string' ? body.code.trim() : '';

    if (!factorId || !code) {
      return NextResponse.json(
        { error: 'Enter the 6-digit code from your authenticator app.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });

    if (error) {
      return NextResponse.json(
        { error: 'That code is incorrect or has expired. Try again.' },
        { status: 401 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'An unexpected error occurred while verifying the code.' },
      { status: 500 }
    );
  }
}
