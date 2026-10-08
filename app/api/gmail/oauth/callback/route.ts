import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/access';
import { env } from '@/lib/env';
import {
  exchangeAuthorizationCode,
  GMAIL_READONLY_SCOPE,
  GMAIL_STATE_COOKIE,
  gmailStateMatches,
  storeGmailConnection,
} from '@/lib/services/gmail-service';

/**
 * Google redirects here after the user approves/denies the consent screen.
 * Validates the CSRF state cookie, checks the state is bound to the current
 * session's user, exchanges the one-time code for tokens, persists them in
 * Supabase (service role), then bounces back into the app.
 */
export async function GET(request: NextRequest) {
  const siteUrl = env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const home = `${siteUrl}/subscriptions`;

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  if (oauthError) {
    return NextResponse.redirect(`${home}?gmailError=1`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${home}?gmailError=1`);
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(GMAIL_STATE_COOKIE)?.value;
  cookieStore.delete(GMAIL_STATE_COOKIE);

  if (!expectedState || expectedState !== state) {
    return NextResponse.redirect(`${home}?gmailError=1`);
  }

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user || !gmailStateMatches(state, user.id)) {
      // The state is not bound to the authenticated user: either the flow was
      // started by a different account or the state was forged/replayed.
      return NextResponse.redirect(`${home}?gmailError=1`);
    }

    const { tokens, email } = await exchangeAuthorizationCode(code);
    await storeGmailConnection(user.id, email, tokens, GMAIL_READONLY_SCOPE);

    return NextResponse.redirect(`${home}?gmailConnected=1`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
    console.error('[gmail/callback] token exchange failed:', msg);
    return NextResponse.redirect(`${home}?gmailError=1`);
  }
}