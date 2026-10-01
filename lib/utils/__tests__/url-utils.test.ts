import { describe, it, expect, afterEach, vi } from 'vitest';
import { getSafeRedirectUrl, getSiteUrl, getAuthCallbackUrl, toAbsoluteUrl } from '@/lib/utils/url-utils';

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

describe('toAbsoluteUrl', () => {
  it('adds https:// to hand-typed URLs that have no scheme', () => {
    // Regression: these were used directly as href values, so the browser
    // resolved them as relative paths and the link went nowhere.
    expect(toAbsoluteUrl('netflix.com/account')).toBe('https://netflix.com/account');
    expect(toAbsoluteUrl('spotify.com')).toBe('https://spotify.com');
    expect(toAbsoluteUrl('  github.com/settings  ')).toBe('https://github.com/settings');
  });

  it('leaves URLs that already have a scheme untouched', () => {
    expect(toAbsoluteUrl('https://netflix.com')).toBe('https://netflix.com');
    expect(toAbsoluteUrl('http://netflix.com')).toBe('http://netflix.com');
    expect(toAbsoluteUrl('HTTPS://NETFLIX.COM')).toBe('HTTPS://NETFLIX.COM');
  });

  it('returns null for blank input so callers can skip rendering a link', () => {
    expect(toAbsoluteUrl('')).toBeNull();
    expect(toAbsoluteUrl('   ')).toBeNull();
    expect(toAbsoluteUrl(null)).toBeNull();
    expect(toAbsoluteUrl(undefined)).toBeNull();
  });
});
