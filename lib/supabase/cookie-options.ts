import type { CookieOptions } from '@supabase/ssr';

/**
 * Shared auth-token cookie attributes for every Supabase client — browser,
 * server component, middleware and route handler alike.
 *
 * ## Why there is only one set of options
 *
 * These used to be two constants that disagreed on `httpOnly`: the server
 * clients wrote the session with `httpOnly: true` while `createBrowserClient`
 * was forced to `false` (browsers silently drop a `document.cookie` write that
 * carries HttpOnly, which broke the PKCE handshake).
 *
 * That split is not viable for this app. A `Set-Cookie` for
 * `sb-<project-ref>-auth-token` carrying HttpOnly *replaces* the JS-visible
 * cookie of the same name, so the moment any server-side sign-in succeeded —
 * `/api/auth/login`, or `exchangeCodeForSession` in `/auth/callback` — the
 * browser client could no longer read the session at all. Every client-side
 * read then went out unauthenticated and came back empty or 401:
 * `subscription-service`, `bills-service`, `activity-service`,
 * `receipt-storage`, `Sidebar`, `user-settings-context`, `inbox-context`.
 *
 * The visible symptom was Google sign-in "not working": a brand-new Google user
 * has an empty `localStorage` cache, so `fetchSubscriptions` fell back to `[]`
 * and the dashboard rendered nothing after a successful sign-in.
 *
 * So `httpOnly` is off and one constant is shared. Hardening the token against
 * XSS requires moving every read and write behind an authenticated route
 * handler, which is incompatible with a browser-side Supabase data layer.
 *
 * `sameSite: 'lax'` keeps the default CSRF posture while still sending the
 * session on the top-level GET navigation Google performs back to
 * `/auth/callback`.
 */
const isHttps = (): boolean => {
  // In the browser the live protocol is the only correct answer: keying off
  // NEXT_PUBLIC_SITE_URL instead marked the cookie Secure while developing on
  // http://localhost, and browsers drop Secure cookies there, so sign-in
  // appeared to "bounce" with no error.
  if (typeof window !== 'undefined' && window.location?.protocol) {
    return window.location.protocol === 'https:';
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) return siteUrl.startsWith('https://');

  return     process.env.NODE_ENV === 'production';
};

/**
 * Supabase providers this app offers, with the label shown on the button.
 *
 * Must be kept in sync with Authentication -> Providers in the Supabase
 * dashboard: `signInWithOAuth` against a disabled provider returns a URL that
 * bounces off the provider with no usable session, which is indistinguishable
 * from a broken app. Apple is currently disabled on the project, so it is left
 * out rather than rendered as a button that can never succeed.
 */
export const SOCIAL_AUTH_PROVIDERS = [
  { id: 'google', label: 'Continue with Google' },
] as const;

export type SocialAuthProviderId = (typeof SOCIAL_AUTH_PROVIDERS)[number]['id'];

export const SESSION_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: false,
  secure: isHttps(),
  sameSite: 'lax',
};
