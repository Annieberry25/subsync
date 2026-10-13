import { type NextRequest, NextResponse } from 'next/server';
import { isRateLimited } from '@/lib/rate-limit';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Inbound payment confirmations. Both are authenticated by other means — the
 * callback verifies the reference against Paystack's API, the webhook checks
 * `x-paystack-signature` — so the per-IP window only ever drops them.
 * Neither client nor Paystack can control how many requests this browser
 * makes in a minute, and a 429 here silently abandons a completed payment:
 * the user sits on a plain "Too Many Requests" page and the grant never runs.
 */
const RATE_LIMIT_EXEMPT_PATHS: readonly string[] = [
  '/api/paystack/callback',
  '/api/paystack/webhook',
  // The push service worker script. It is served from /public and the matcher
  // does not exclude `.js`, so a normal page load plus a worker update can push
  // a client over the 30/min window and the browser would fetch a 429 as the
  // worker script. Static assets are not the thing this limiter is for.
  '/sw.js',
];

export async function proxy(request: NextRequest) {
  // Apply rate limiting to all requests (except static assets, which don't match anyway)
  if (
    !RATE_LIMIT_EXEMPT_PATHS.includes(request.nextUrl.pathname) &&
    (await isRateLimited(request))
  ) {
    return new NextResponse('Too Many Requests', { status: 429 });
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (static file)
     * - public files (svgs, images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};