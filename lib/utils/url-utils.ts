/**
 * Returns the base site URL for the application depending on environment.
 * Priority:
 * 1. NEXT_PUBLIC_SITE_URL (explicit custom domain, e.g. https://subhalt.app)
 * 2. NEXT_PUBLIC_VERCEL_URL (automatically set by Vercel deployment)
 * 3. http://localhost:3000 (default fallback for local development)
 */
export function getSiteUrl(): string {
  // 1. Explicit custom site URL (e.g., NEXT_PUBLIC_SITE_URL=https://subhalt.app)
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    let url = process.env.NEXT_PUBLIC_SITE_URL;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    return url.replace(/\/+$/, '');
  }

  // 2. Browser window origin (client-side runtime)
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '');
  }

  // 3. Vercel environment variables (server-side runtime)
  let url =
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    'http://localhost:3000';

  // Ensure protocol is included
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  // Strip trailing slash for consistency
  return url.replace(/\/+$/, '');
}

/**
 * Returns the full callback URL for OAuth sign-in operations.
 *
 * In the browser this always uses the live origin. The PKCE code verifier is
 * written as a cookie on the host that started the flow, so a `redirectTo` on
 * any other host delivers the callback somewhere that cookie does not exist
 * and `exchangeCodeForSession` fails. Honouring NEXT_PUBLIC_SITE_URL here broke
 * that whenever the configured domain differed from the one being visited
 * (e.g. subhalt.xyz vs www.subhalt.xyz). Server-side callers still fall back to
 * the configured site URL.
 */
export function getAuthCallbackUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin.replace(/\/+$/, '')}/auth/callback`;
  }

  return `${getSiteUrl()}/auth/callback`;
}

/**
 * Upgrades a hand-typed URL to an absolute one by adding a scheme.
 *
 * Provider and account links are typed by users, so they are commonly stored
 * without a protocol ("netflix.com/account"). Passed straight into an href the
 * browser resolves that as a *relative* path, so the link silently navigated
 * nowhere (or reloaded the current page when the value was empty) instead of
 * opening the provider. Returns null for blank input so callers can decide to
 * render plain text rather than a broken link.
 */
export function toAbsoluteUrl(raw?: string | null): string | null {
  const value = raw?.trim();
  if (!value) return null;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

/**
 * Sanitizes a redirect path parameter to prevent open-redirect security vulnerabilities.
 * Ensures the target is a relative path starting with '/' and not '//' or containing scheme delimiters.
 */
export function getSafeRedirectUrl(target: string | null | undefined): string {
  if (!target) return '/';
  
  const trimmed = target.trim();
  if (
    trimmed.startsWith('/') &&
    !trimmed.startsWith('//') &&
    !trimmed.includes(':')
  ) {
    return trimmed;
  }
  
  return '/';
}
