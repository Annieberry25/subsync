import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSiteUrl, getSafeRedirectUrl } from '@/lib/utils/url-utils';

function redirectToLoginError(baseOrigin: string, message: string): NextResponse {
  const url = new URL('/login', baseOrigin);
  url.searchParams.set('error', message);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const nextParam = requestUrl.searchParams.get('next');
  const safePath = getSafeRedirectUrl(nextParam);

  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  const isLocalEnv = process.env.NODE_ENV === 'development';

  let baseOrigin: string;
  if (isLocalEnv) {
    baseOrigin = requestUrl.origin;
  } else if (forwardedHost) {
    baseOrigin = `${forwardedProto}://${forwardedHost}`;
  } else {
    baseOrigin = getSiteUrl();
  }

  // Supabase redirects here with `error`/`error_description` when it refuses the
  // callback (site URL not allow-listed, user cancelled, provider denied).
  if (!code) {
    console.error('[auth/callback] no authorization code in callback', {
      error: requestUrl.searchParams.get('error'),
      errorDescription: requestUrl.searchParams.get('error_description'),
      errorCode: requestUrl.searchParams.get('error_code'),
    });
    return redirectToLoginError(baseOrigin, 'Sign-in could not be completed. Please try again.');
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Almost always a missing/stale PKCE code verifier: the browser must have
    // stored it before leaving for the provider, and it is only usable when the
    // callback lands on the same browser.
    console.error('[auth/callback] exchangeCodeForSession failed', {
      code: error.code,
      message: error.message,
      status: error.status,
    });
    return redirectToLoginError(baseOrigin, 'Sign-in could not be completed. Please try again.');
  }

  return NextResponse.redirect(new URL(safePath, baseOrigin));
}
