/**
 * Postgres-backed sliding-window rate limiter for the Edge middleware.
 *
 * Each new counter is read/written via the `check_rate_limit` SECURITY DEFINER
 * RPC (persistent across cold starts and instances). A tiny in-memory cache
 * short-circuits repeat requests within the same window so the middleware
 * only touches the database once per bucket per instance.
 */

import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import type { Database } from '@/lib/types/database.types';

const WINDOW_SECONDS = 60; // sliding window length
const MAX_REQUESTS = 30; // allowed requests per window per client

interface CachedDecision {
  allowed: boolean;
  expiresAt: number;
}

const decisionCache = new Map<string, CachedDecision>();

const supabase = createClient<Database>(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

export async function isRateLimited(request: Request): Promise<boolean> {
  const bucketKey = `ip:${getClientIp(request)}`;
  const now = Date.now();

  const cached = decisionCache.get(bucketKey);
  if (cached && cached.expiresAt > now) {
    return !cached.allowed;
  }

  try {
    const { data } = await supabase.rpc('check_rate_limit', {
      p_bucket_key: bucketKey,
      p_window_seconds: WINDOW_SECONDS,
      p_max_requests: MAX_REQUESTS,
    });

    const allowed = data?.allowed !== false;
    const retryAfter = data?.retry_after_seconds ?? WINDOW_SECONDS;
    decisionCache.set(bucketKey, { allowed, expiresAt: now + retryAfter * 1000 });
    return !allowed;
  } catch {
    // Fail open if the rate-limit store is unreachable; never brick the app
    // behind an infrastructure error. Re-check after a short backoff.
    decisionCache.set(bucketKey, { allowed: true, expiresAt: now + 5_000 });
    return false;
  }
}

export function getClientIp(request: Request): string {
  // x-real-ip is set by the trusted proxy and cannot be spoofed by the client,
  // so it wins over the forwarded chain.
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;

  // When only x-forwarded-for exists, trust the RIGHTMOST value. Proxies append
  // the real client IP as the final entry and the browser-supplied value is the
  // leftmost, so using the first entry would let an attacker rotate buckets by
  // sending a different header value per request, bypassing the limiter.
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const last = forwarded.split(',').pop()?.trim();
    if (last) return last;
  }
  return 'unknown';
}