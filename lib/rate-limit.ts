/**
 * Lightweight in-memory sliding-window rate limiter for the Edge middleware.
 *
 * NOTE: This is a single-instance limiter suitable for Vercel's function-per-request
 * model offset by being applied defensively. For multi-region / high-scale deployments,
 * swap the `store` implementation for @upstash/ratelimit backed by Redis/KV.
 */

interface RateRecord {
  count: number;
  resetAt: number;
}

const windowMs = 60_000; // 1 minute
const maxRequests = 30; // allow up to 30 requests/min/IP

// Simple Map-based store (does not persist across cold starts — accepted tradeoff)
// key -> { count, resetAt }
const store = new Map<string, RateRecord>();

export function rateLimit(ip: string): boolean {
  const now = Date.now();
  const key = `rl:${ip}`;
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (existing.count >= maxRequests) {
    return false;
  }

  existing.count += 1;
  return true;
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip') || 'unknown';
}
