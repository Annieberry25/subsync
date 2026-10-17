/**
 * Postgres-backed sliding-window rate limiter.
 *
 * Each new counter is read/written via the `check_rate_limit` SECURITY DEFINER
 * RPC (persistent across cold starts and instances). A tiny in-memory cache
 * short-circuits repeat requests within the same window so callers only touch
 * the database once per bucket per instance.
 *
 * Used by the Edge middleware for the global per-IP window, and directly by
 * sensitive route handlers that need a tighter or per-user bucket (account
 * method lookup, AI chat, Gmail scans, deletion codes, receipt scans).
 */

import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import type { Database } from '@/lib/types/database.types';

const WINDOW_SECONDS = 60; // sliding window length for the global IP bucket
const MAX_REQUESTS = 30; // allowed requests per window per IP

/** Cap for the in-memory decision cache; stale entries are pruned past it. */
const MAX_CACHE_ENTRIES = 10_000;

export interface RateLimitOptions {
  /** Sliding window length in seconds. */
  windowSeconds: number;
  /** Allowed requests per window. */
  maxRequests: number;
}

interface CachedDecision {
  allowed: boolean;
  expiresAt: number;
}

const decisionCache = new Map<string, CachedDecision>();

const supabase = createClient<Database>(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

function pruneCache(now: number): void {
  if (decisionCache.size < MAX_CACHE_ENTRIES) return;
  for (const [key, decision] of decisionCache) {
    if (decision.expiresAt <= now) decisionCache.delete(key);
  }
  while (decisionCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = decisionCache.keys().next().value;
    if (oldest === undefined) break;
    decisionCache.delete(oldest);
  }
}

/**
 * Checks (and consumes) one unit from `bucketKey`. Returns true when the
 * request is allowed.
 *
 * Fails open: if the rate-limit store is unreachable the request is allowed,
 * so an infrastructure error never bricks the app. The failure is cached for
 * a few seconds to avoid hammering a broken store.
 */
export async function checkRateLimit(
  bucketKey: string,
  options: RateLimitOptions
): Promise<boolean> {
  const now = Date.now();

  const cached = decisionCache.get(bucketKey);
  if (cached && cached.expiresAt > now) {
    return cached.allowed;
  }

  try {
    const { data } = await supabase.rpc('check_rate_limit', {
      p_bucket_key: bucketKey,
      p_window_seconds: options.windowSeconds,
      p_max_requests: options.maxRequests,
    });

    const allowed = data?.allowed !== false;
    const retryAfter = data?.retry_after_seconds ?? options.windowSeconds;
    pruneCache(now);
    decisionCache.set(bucketKey, { allowed, expiresAt: now + retryAfter * 1000 });
    return allowed;
  } catch {
    pruneCache(now);
    decisionCache.set(bucketKey, { allowed: true, expiresAt: now + 5_000 });
    return true;
  }
}

export async function isRateLimited(request: Request): Promise<boolean> {
  const allowed = await checkRateLimit(`ip:${getClientIp(request)}`, {
    windowSeconds: WINDOW_SECONDS,
    maxRequests: MAX_REQUESTS,
  });
  return !allowed;
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