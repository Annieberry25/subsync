import type { CookieOptions } from '@supabase/ssr';

/**
 * Shared auth-token cookie attributes for every Supabase client.
 *
 * httpOnly keeps the session token out of JS scope (mitigates XSS token theft),
 * secure restricts it to HTTPS (mitigates interception over plain HTTP),
 * sameSite: 'lax' keeps the default CSRF posture.
 *
 * `secure` is enabled only when the site is served over HTTPS. Local `next dev`
 * runs on plain http://localhost, and browsers drop Secure cookies there which
 * makes sign-in appear to "bounce" — so we switch it off for non-HTTPS
 * environments instead.
 */
const isHttps = (): boolean => {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) return siteUrl.startsWith('https://');
  return process.env.NODE_ENV === 'production';
};

export const SESSION_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: isHttps(),
  sameSite: 'lax',
};

/**
 * Auth cookie attributes for `createBrowserClient`.
 *
 * The browser client persists auth state through `document.cookie`, and browsers
 * silently discard any script-written cookie carrying HttpOnly. That breaks the
 * PKCE handshake: `signInWithOAuth` / `signInWithOtp` must stash the code
 * verifier before leaving for the provider, so with httpOnly the verifier never
 * lands and `/auth/callback` fails `exchangeCodeForSession` — which is what
 * surfaced as `/login?error=Could not authenticate`. The same applies to the
 * session stored after `verifyOtp` / `signUp`.
 *
 * So the browser client must opt out. Sessions this app mints itself (password
 * sign-in, OAuth callback) are still written by the server above and keep the
 * httpOnly guarantee.
 */
export const BROWSER_SESSION_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: false,
  secure: isHttps(),
  sameSite: 'lax',
};
