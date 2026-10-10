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
const PUBLIC_ROUTES = ['/api', '/robots.txt', '/sitemap.xml', '/manifest.webmanifest'] as const;

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export async function updateSession(request: NextRequest) {
  if (isPublicRoute(request.nextUrl.pathname)) {
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

  // If user is not logged in and trying to access protected routes
  if (!user && !isAuthPage && !isCallbackRoute) {
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
