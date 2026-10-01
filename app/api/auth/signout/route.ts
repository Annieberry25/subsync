import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SESSION_COOKIE_OPTIONS } from '@/lib/supabase/cookie-options';

/**
 * Server-side sign-out.
 *
 * ## Why this endpoint exists
 *
 * The auth cookie is written `httpOnly: true` by the middleware, on the server
 * (lib/supabase/cookie-options.ts). Browsers refuse to let JavaScript read or
 * clear an httpOnly cookie — a `document.cookie` write carrying HttpOnly is
 * silently ignored — so the browser client's `signOut()` could never remove the
 * session. The middleware kept resolving a signed-in user and /login bounced
 * straight back to the dashboard, making the button look dead.
 *
 * ## Why the cookie is deleted here rather than via supabase.auth.signOut()
 *
 * `_signOut` in @supabase/auth-js calls `admin.signOut(accessToken, scope)` —
 * a network round trip to Supabase — whenever an access token exists, *even for
 * `scope: 'local'`*. The scope only decides what happens after that call
 * returns. So awaiting `signOut()` makes logout depend on Supabase being
 * reachable and fast: if that request hangs, the click appears to do nothing at
 * all, which is the symptom this endpoint replaces.
 *
 * Therefore the session cookies are expired directly, with no network involved,
 * and token revocation is attempted afterwards without being allowed to block
 * the response. Logout is then instant and works offline.
 */

const AUTH_COOKIE_PATTERN = /auth-token/;

/** Milliseconds we are willing to wait on best-effort token revocation. */
const REVOKE_TIMEOUT_MS = 3000;

/**
 * Expires every Supabase auth cookie on `response`. No network required.
 *
 * Must be called with the very response that will be returned — mutating a
 * throwaway NextResponse and returning a different one silently drops the
 * Set-Cookie headers, which is exactly how the session survived logout.
 *
 * @returns the names of the cookies that were expired.
 */
function clearAuthCookies(request: NextRequest, response: NextResponse): string[] {
  const cleared = request.cookies
    .getAll()
    .filter((cookie) => AUTH_COOKIE_PATTERN.test(cookie.name))
    .map((cookie) => cookie.name);

  for (const name of cleared) {
    response.cookies.set(name, '', {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: 0,
      expires: new Date(0),
    });
  }

  return cleared;
}

/**
 * Best-effort server-side revocation of the refresh token so the session is
 * dead everywhere, not just in this browser. Never blocks or fails the logout.
 */
async function revokeRemotely(request: NextRequest): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) return;

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Guarded: an unreachable Supabase must not turn into a hung logout button.
  await Promise.race([
    supabase.auth.signOut({ scope: 'global' }).catch(() => null),
    new Promise((resolve) => setTimeout(resolve, REVOKE_TIMEOUT_MS)),
  ]);
}

export async function POST(request: NextRequest) {
  // The cookies must be expired on the response we actually return.
  const response = NextResponse.json({ cleared: true });
  const cleared = clearAuthCookies(request, response);

  if (cleared.length === 0) {
    // Nothing to clear: already signed out. Report success so the client can
    // still navigate rather than treating it as an error.
    return NextResponse.json({ cleared: true, reason: 'already_signed_out' });
  }

  // Fire and forget — do not let a slow network call hold the response open.
  void revokeRemotely(request);

  return response;
}

export async function GET() {
  return NextResponse.json({ error: 'Use POST' }, { status: 405, headers: { Allow: 'POST' } });
}
