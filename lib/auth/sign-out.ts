'use client';

/**
 * Signs the user out and reports whether the browser session was cleared.
 *
 * ## Why a server endpoint is required
 *
 * The auth cookie is written `httpOnly: true` by the middleware, on the server
 * (lib/supabase/cookie-options.ts). Browsers refuse to let JavaScript read or
 * delete an httpOnly cookie — a `document.cookie` write carrying HttpOnly is
 * silently dropped — so the browser client's `signOut()` never removed the
 * cookie, the middleware kept resolving a signed-in user, and /login bounced
 * straight back to the dashboard. The button appeared to do nothing.
 *
 * ## Why nothing else is awaited
 *
 * `supabase.auth.signOut()` performs a network round trip to Supabase even for
 * `scope: 'local'` (it calls `admin.signOut` whenever an access token exists),
 * so awaiting it here would make logout hang whenever Supabase is slow or
 * unreachable — the exact "nothing happens" symptom. The endpoint expires the
 * cookies without touching the network, and this helper adds its own timeout so
 * the UI can never get stuck waiting.
 *
 * @returns true when this browser is signed out — safe to redirect.
 */

/** Upper bound on the sign-out round trip before we report failure. */
const SIGN_OUT_TIMEOUT_MS = 5000;

export async function signOutAndRedirect(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/signout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(SIGN_OUT_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.error('[auth] sign-out endpoint returned', res.status);
      return false;
    }

    const body = (await res.json().catch(() => null)) as { cleared?: boolean } | null;
    return body?.cleared === true;
  } catch (err) {
    console.error('[auth] sign-out failed:', err);
    return false;
  }
}
