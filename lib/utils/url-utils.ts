/**
 * Returns the base site URL for the application depending on environment.
 * Priority:
 * 1. NEXT_PUBLIC_SITE_URL (explicit custom domain, e.g. https://subhalt.app)
 * 2. NEXT_PUBLIC_VERCEL_URL (automatically set by Vercel deployment)
 * 3. http://localhost:3000 (default fallback for local development)
 */
export function getSiteUrl(): string {
  let url =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
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
 * Uses browser origin if running on client, otherwise falls back to environment site URL.
 */
export function getAuthCallbackUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/auth/callback`;
  }
  return `${getSiteUrl()}/auth/callback`;
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
