import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_OPTIONS } from '@/lib/supabase/cookie-options';
import { hasVerifiedMfaFactor } from '@/lib/auth/mfa';

/**
 * Paths that must stay reachable without a session.
 *
 * `/api` routes manage their own auth, so the redirect below would otherwise
 * swallow every unauthenticated API call.
 *
 * The three metadata routes are here because crawlers fetch them *before* any
 * page, and this middleware is in front of all of them. The matcher only
 * excludes a fixed list of image extensions, so `.txt`, `.xml` and
 * `.webmanifest` fell through to the auth redirect and every one of them
 * answered with the login page:
 *
 *   /robots.txt            -> login page HTML instead of robots directives
 *   /sitemap.xml           -> login page HTML instead of a sitemap
 *   /manifest.webmanifest  -> login page HTML, so the PWA manifest never loaded
 *
 * AdSense verification reads the robots file first, so this blocked it directly.
 * Compare on a segment boundary rather than a bare prefix so a route like
 * `/robots.txt.bak` cannot slip through on the strength of its prefix.
 */
const PUBLIC_ROUTES = [
  '/api',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.webmanifest',
  // The push service worker. It is a public static file, but the matcher in
  // middleware.ts only excludes image extensions, so `/sw.js` was being caught
  // and 307'd to /login for any request without the session cookie. A service
  // worker registration that receives the login page as its script fails with an
  // unsupported MIME type, so push silently never subscribed. It must be
  // fetchable by the browser's worker machinery without a session.
  '/sw.js',
] as const;

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/**
 * Google Search Console HTML-file verification, served from `public/`.
 *
 * Search Console does not follow redirects for the file-upload method, so a
 * 307 to /login is a hard failure: the verifier reads the login page instead of
 * the token and reports "wrong content". The file is static, but the matcher in
 * middleware.ts only excludes image extensions and `favicon.ico`, so an `.html`
 * request still lands here and would otherwise be redirected.
 *
 * Matched by pattern rather than exact name because Search Console issues a new
 * token filename whenever the property is re-verified.
 */
const GOOGLE_VERIFICATION_FILE = /^\/google[a-z0-9]+\.html$/;

export async function updateSession(request: NextRequest) {
  if (
    isPublicRoute(request.nextUrl.pathname) ||
    GOOGLE_VERIFICATION_FILE.test(request.nextUrl.pathname)
  ) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[middleware] Missing Supabase environment variables');
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: Do not run code between createServerClient and supabase.auth.getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPage =
    request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/signup');

  const isCallbackRoute = request.nextUrl.pathname.startsWith('/auth');

  /**
   * An account with a verified second factor signs in at `aal1` and must finish
   * the challenge before it can use the app. A password session is minted at
   * `aal1` regardless of the factor, so this cannot be inferred from the user
   * alone — the assurance level is read off the session token.
   *
   * The auth pages and the OAuth callback are deliberately exempt: the login
   * flow is where the challenge is completed, and the callback has to run before
   * the aal1 session even exists.
   */
  let needsMfaChallenge = false;
  if (user && hasVerifiedMfaFactor(user)) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    needsMfaChallenge = aal?.currentLevel !== 'aal2';
  }

  if (needsMfaChallenge && !isAuthPage && !isCallbackRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  /**
   * `/` is the public homepage, not a protected route, so a signed-out visitor
   * (and any crawler) has to be allowed through. Signed in, the page itself
   * renders the dashboard, so there is nothing to redirect either way.
   */
  const isLandingRoute = request.nextUrl.pathname === '/';

  // If user is not logged in and trying to access protected routes
  if (!user && !isAuthPage && !isCallbackRoute && !isLandingRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // If user is logged in and trying to access /login or /signup, redirect to
  // Dashboard — unless they still owe an MFA challenge, in which case /login is
  // exactly where they need to be to finish it.
  if (user && isAuthPage && !needsMfaChallenge) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // Admin area: only accounts with profiles.is_admin = true may enter.
  if (user && request.nextUrl.pathname.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();
    if (!profile?.is_admin) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
