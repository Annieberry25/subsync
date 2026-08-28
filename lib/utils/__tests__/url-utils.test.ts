import { describe, it, expect, afterEach, vi } from 'vitest';
import { getSafeRedirectUrl, getSiteUrl, getAuthCallbackUrl } from '@/lib/utils/url-utils';

const ORIG_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIG_ENV };
  delete globalThis.window;
});

describe('getSafeRedirectUrl', () => {
  it('returns "/" for null, undefined, and empty input', () => {
    expect(getSafeRedirectUrl(null)).toBe('/');
    expect(getSafeRedirectUrl(undefined)).toBe('/');
    expect(getSafeRedirectUrl('')).toBe('/');
  });

  it('returns "/" for external URLs and protocol-relative URLs', () => {
    expect(getSafeRedirectUrl('https://evil.com')).toBe('/');
    expect(getSafeRedirectUrl('//evil.com')).toBe('/');
    expect(getSafeRedirectUrl('javascript:alert(1)')).toBe('/');
  });

  it('returns the path for safe relative URLs', () => {
    expect(getSafeRedirectUrl('/settings')).toBe('/settings');
    expect(getSafeRedirectUrl('  /plans  ')).toBe('/plans');
  });

  it('rejects paths containing a colon', () => {
    expect(getSafeRedirectUrl('/foo:bar')).toBe('/');
  });
});

describe('getSiteUrl', () => {
  it('uses NEXT_PUBLIC_SITE_URL when set, normalizing scheme and trailing slash', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'subhalt.app';
    expect(getSiteUrl()).toBe('https://subhalt.app');

    process.env.NEXT_PUBLIC_SITE_URL = 'https://subhalt.app/';
    expect(getSiteUrl()).toBe('https://subhalt.app');
  });

  it('uses window.location.origin when present and no SITE_URL', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    vi.stubGlobal('window', {
      location: { origin: 'https://example.com' },
    });
    expect(getSiteUrl()).toBe('https://example.com');
    vi.unstubAllGlobals();
  });

  it('falls back to localhost when nothing is set', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_VERCEL_URL;
    delete process.env.VERCEL_URL;
    delete process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
    expect(getSiteUrl()).toBe('http://localhost:3000');
  });
});

describe('getAuthCallbackUrl', () => {
  it('appends /auth/callback to the site URL', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://subhalt.app';
    expect(getAuthCallbackUrl()).toBe('https://subhalt.app/auth/callback');
  });
});
