import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/access';
import {
  createGoogleAuthUrl,
  GMAIL_STATE_COOKIE,
  isGmailConfigured,
} from '@/lib/services/gmail-service';

/**
 * Starts the Google OAuth consent flow. Returns the accounts.google.com URL the
 * browser should navigate to. A short-lived httpOnly cookie holds the CSRF
 * `state` value that the callback validates on return.
 */
export async function GET() {
  try {
    const configured = isGmailConfigured();
    if (!configured.ok) {
      return NextResponse.json({ error: configured.reason }, { status: 500 });
    }

    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized user session.' }, { status: 401 });
    }

    const state = crypto.randomBytes(16).toString('hex');
    const cookieStore = await cookies();
    cookieStore.set(GMAIL_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 10 * 60,
    });

    const url = createGoogleAuthUrl(state, user.email ?? undefined);
    return NextResponse.json({ url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
    console.error('[gmail/auth] unexpected error:', msg);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}