'use client';

import { clearUserScopedStorage } from '@/lib/auth/user-storage';

/**
 * Signs the user out and reports whether the browser session was cleared.
 *
 * ## Why a server endpoint is required
 *
 * The browser client's `signOut()` only clears cookies it can see, and it can
 * be racing the app's own storage writes. Expiring the auth cookies on a
 * response this app controls is deterministic: the middleware stops resolving a
 * signed-in user, so /login no longer bounces straight back to the dashboard.
 * Historically this was also the only way to clear an httpOnly cookie; the
 * shared cookie options are no longer httpOnly (see
 * `lib/supabase/cookie-options.ts` for why), but the endpoint remains the
 * single place that decides what "signed out" means.
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
  // 1. Clear first, before any network call.
  //
  // The caches were written under one global key per feature, so the next person
  // to sign in on this browser inherited them -- including one path that INSERTed
  // them into the new account. Clearing before the request means an unreachable
  // Supabase, a timeout, or a thrown error leaves nothing behind; clearing after
  // would mean a failed sign-out silently keeps the previous user's data on the
  // device. `ensureCacheOwnership` is the backstop for when this never runs.
  clearUserScopedStorage();

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
    if (body?.cleared !== true) return false;

    // 2. Hard navigation, not router.push().
    //
    // This is the part that made account switching unusable. A client-side push
    // to /login keeps the React tree alive, so every provider that loaded the
    // outgoing account once on mount keeps serving it: the sidebar still showed
    // the previous email and plan, and their billing details. It also leaves
    // module state resident, so the in-memory subscription cache survived even
    // though localStorage had been wiped.
    //
    // Assigning the location discards the tree and re-evaluates every module, so
    // the next account genuinely starts from nothing. Worth the full page load:
    // the alternative is a login screen that still knows who signed out.
    //
    // `assign` rather than `replace` so Back does not return to an authenticated
    // page rendering the previous session's data.
    window.location.assign('/login');
    return true;
  } catch (err) {
    console.error('[auth] sign-out failed:', err);
    return false;
  }
}
