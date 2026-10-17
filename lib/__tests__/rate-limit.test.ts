import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpcMock = vi.hoisted(() => vi.fn());

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ rpc: rpcMock })),
}));

/**
 * The module builds its Supabase client at import time, so env vars and the
 * mock must be in place, and `resetModules` gives each test a fresh
 * decision cache (otherwise a cached decision leaks into the next test).
 */
beforeEach(() => {
  vi.resetModules();
  rpcMock.mockReset();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-key';
});

async function loadRateLimit() {
  return import('@/lib/rate-limit');
}

describe('checkRateLimit', () => {
  it('allows the request when the RPC allows it', async () => {
    rpcMock.mockResolvedValue({ data: { allowed: true, retry_after_seconds: 60 }, error: null });
    const { checkRateLimit } = await loadRateLimit();

    await expect(
      checkRateLimit('test:allow', { windowSeconds: 60, maxRequests: 5 })
    ).resolves.toBe(true);
  });

  it('denies the request when the RPC denies it', async () => {
    rpcMock.mockResolvedValue({ data: { allowed: false, retry_after_seconds: 30 }, error: null });
    const { checkRateLimit } = await loadRateLimit();

    await expect(
      checkRateLimit('test:deny', { windowSeconds: 60, maxRequests: 5 })
    ).resolves.toBe(false);
  });

  it('fails open when the store is unreachable', async () => {
    rpcMock.mockRejectedValue(new Error('network down'));
    const { checkRateLimit } = await loadRateLimit();

    await expect(
      checkRateLimit('test:fail-open', { windowSeconds: 60, maxRequests: 1 })
    ).resolves.toBe(true);
  });

  it('caches the decision inside its window', async () => {
    rpcMock.mockResolvedValue({ data: { allowed: false, retry_after_seconds: 30 }, error: null });
    const { checkRateLimit } = await loadRateLimit();

    await checkRateLimit('test:cached', { windowSeconds: 60, maxRequests: 1 });
    await checkRateLimit('test:cached', { windowSeconds: 60, maxRequests: 1 });

    expect(rpcMock).toHaveBeenCalledTimes(1);
  });
});

describe('isRateLimited', () => {
  it('reports limited when the IP bucket is exhausted', async () => {
    rpcMock.mockResolvedValue({ data: { allowed: false, retry_after_seconds: 30 }, error: null });
    const { isRateLimited } = await loadRateLimit();

    const request = new Request('https://subhalt.xyz/api/test', {
      headers: { 'x-real-ip': '203.0.113.9' },
    });

    await expect(isRateLimited(request)).resolves.toBe(true);
    expect(rpcMock).toHaveBeenCalledWith(
      'check_rate_limit',
      expect.objectContaining({ p_bucket_key: 'ip:203.0.113.9' })
    );
  });
});

describe('getClientIp', () => {
  it('prefers x-real-ip over the forwarded chain', async () => {
    const { getClientIp } = await loadRateLimit();
    const request = new Request('https://subhalt.xyz/', {
      headers: { 'x-real-ip': '198.51.100.7', 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    });

    expect(getClientIp(request)).toBe('198.51.100.7');
  });

  it('trusts the rightmost forwarded-for entry', async () => {
    const { getClientIp } = await loadRateLimit();
    const request = new Request('https://subhalt.xyz/', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    });

    expect(getClientIp(request)).toBe('5.6.7.8');
  });
});
