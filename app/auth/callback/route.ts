import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSiteUrl, getSafeRedirectUrl } from '@/lib/utils/url-utils';

/**
 * Turns the query params GoTrue sends when it refuses a callback into something
 * a person can act on.
 *
 * The most important case is `redirect_to` not being in the project's Redirect
 * URLs allow-list. GoTrue does not error out — it silently discards the value
 * and redirects to the project Site URL instead, so the browser lands off-app
 * and this route is never reached. When it *is* reached, `error_code` carries
 * the reason and naming it turns an unactionable "please try again" into a
 * fixable instruction.
 */
function explainProviderError(
  errorCode: string | null,
  errorDescription: string | null
): string {
  switch (errorCode) {
    case 'access_denied':
      return 'Sign-in was cancelled or the provider refused the request.';
    case 'invalid_request':
      return errorDescription?.toLowerCase().includes('redirect')
        ? 'This sign-in link is not allowed by the site configuration.'
        : 'The sign-in request was rejected. Please try again.';
    case 'server_error':
      return 'The identity provider is unavailable right now. Please try again shortly.';
    default:
      return errorDescription
        ? `Sign-in could not be completed: ${errorDescription}`
        : 'Sign-in could not be completed. Please try again.';
  }
}

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

  // The post-callback redirect base. Forwarded headers are never consulted:
  // `x-forwarded-*` is client-controllable wherever a proxy stops overwriting
  // it, and using it for a redirect turns into an open redirect. Production
  // always uses the canonical site URL; development uses the request's own
  // origin so localhost/preview hosts stay self-consistent (the PKCE verifier
  // cookie is host-scoped).
  const baseOrigin =
    process.env.NODE_ENV === 'development' ? requestUrl.origin : getSiteUrl();

  // Supabase redirects here with `error`/`error_description` when it refuses the
  // callback (site URL not allow-listed, user cancelled, provider denied).
  if (!code) {
    const errorCode = requestUrl.searchParams.get('error_code');
    const errorDescription = requestUrl.searchParams.get('error_description');
    console.error('[auth/callback] no authorization code in callback', {
      error: requestUrl.searchParams.get('error'),
      errorDescription,
      errorCode,
    });
    return redirectToLoginError(baseOrigin, explainProviderError(errorCode, errorDescription));
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
    return redirectToLoginError(
      baseOrigin,
      'Sign-in could not be verified. If this keeps happening, cookies may be blocked for this site.'
    );
  }

  return NextResponse.redirect(new URL(safePath, baseOrigin));
}
