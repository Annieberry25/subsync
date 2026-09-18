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