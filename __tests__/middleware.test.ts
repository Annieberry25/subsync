import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * The per-IP window (30 requests / 60s) sits in front of every path, including
 * the two that Paystack calls back into. When it tripped, the browser returned
 * from checkout onto a bare "Too Many Requests" page: the payment completed,
 * the grant never ran, and the app looked like it had simply done nothing.
 *
 * Both routes are authenticated elsewhere (Paystack API verification and the
 * HMAC signature), so rate limiting can only ever drop them.
 */
const mocks = vi.hoisted(() => ({
  isRateLimited: vi.fn(async () => false),
  updateSession: vi.fn(
    async () => new NextResponse(null, { status: 204 }) as unknown as NextResponse
  ),
}));

vi.mock('@/lib/rate-limit', () => ({
  isRateLimited: mocks.isRateLimited,
}));

vi.mock('@/lib/supabase/middleware', () => ({
  updateSession: mocks.updateSession,
}));

import { middleware } from '@/middleware';

function makeRequest(pathname: string): NextRequest {
  return {
    url: `https://subhalt.xyz${pathname}`,
    nextUrl: { pathname },
    headers: new Headers(),
    cookies: { getAll: () => [] },
  } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isRateLimited.mockResolvedValue(false);
});

describe('middleware rate limiting', () => {
  it('never rate limits the Paystack callback', async () => {
    mocks.isRateLimited.mockResolvedValue(true);

    const response = await middleware(makeRequest('/api/paystack/callback'));

    expect(mocks.isRateLimited).not.toHaveBeenCalled();
    expect(mocks.updateSession).toHaveBeenCalled();
    expect(response.status).not.toBe(429);
  });

  it('never rate limits the Paystack webhook', async () => {
    mocks.isRateLimited.mockResolvedValue(true);

    const response = await middleware(makeRequest('/api/paystack/webhook'));

    expect(mocks.isRateLimited).not.toHaveBeenCalled();
    expect(response.status).not.toBe(429);
  });

  it('still rate limits every other route', async () => {
    mocks.isRateLimited.mockResolvedValue(true);

    const response = await middleware(makeRequest('/api/paystack/initialize'));

    expect(mocks.isRateLimited).toHaveBeenCalled();
    expect(mocks.updateSession).not.toHaveBeenCalled();
    expect(response.status).toBe(429);
  });

  it('lets requests through when the window has room', async () => {
    const response = await middleware(makeRequest('/settings'));

    expect(mocks.updateSession).toHaveBeenCalled();
    expect(response.status).not.toBe(429);
  });
});
