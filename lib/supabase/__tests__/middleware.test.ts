import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * The auth redirect used to swallow the metadata routes that crawlers fetch
 * before any page. The middleware matcher only excludes a fixed list of image
 * extensions, so `.txt`, `.xml` and `.webmanifest` fell through to it and every
 * one of them answered with the login page:
 *
 *   /robots.txt  /sitemap.xml  /manifest.webmanifest
 *
 * AdSense verification reads robots.txt first, so this blocked it outright.
 */
const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser,
      onAuthStateChange: vi.fn(),
    },
  })),
}));

function makeRequest(pathname: string): NextRequest {
  const url = `https://subhalt.xyz${pathname}`;
  // A real URL for nextUrl: the middleware calls nextUrl.clone() and hands the
  // result to NextResponse.redirect(), which rejects a plain object with
  // "URL is malformed". jsdom's URL has no clone(), so it is attached here.
  const nextUrl = new URL(url) as URL & { clone: () => URL };
  nextUrl.clone = () => new URL(url);

  return {
    url,
    nextUrl,
    cookies: { getAll: () => [] },
    headers: new Headers(),
  } as unknown as NextRequest;
}

describe('updateSession public routes', () => {
  beforeAll(() => {
    // Without these the middleware short-circuits on its missing-env guard and
    // redirects to /login before reaching any of the auth logic, which would make
    // every assertion below pass for the wrong reason.
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project-ref.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    getUser.mockReset();
    // Unauthenticated: this is the case that produced the login page.
    getUser.mockResolvedValue({ data: { user: null }, error: null });
  });

  it.each(['/robots.txt', '/sitemap.xml', '/manifest.webmanifest'])(
    'serves %s instead of redirecting to /login',
    async (pathname) => {
      const response = await updateSession(makeRequest(pathname));

      expect(response.status).toBe(200);
      const location = response.headers.get('location');
      expect(location ?? '').not.toContain('/login');
      // Reaching the auth check at all is what caused the bug.
      expect(getUser).not.toHaveBeenCalled();
    }
  );

  it('still redirects a protected page to /login when signed out', async () => {
    const response = await updateSession(makeRequest('/subscriptions'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/login');
  });

  it('leaves the auth pages reachable so /login does not redirect to itself', async () => {
    const response = await updateSession(makeRequest('/login'));

    expect(response.status).toBe(200);
    expect(response.headers.get('location') ?? '').not.toContain('/login');
  });

  /**
   * The exemption is compared on a segment boundary. A bare `startsWith('/api')`
   * would also match `/api-keys`, letting a real page slip past the auth check.
   */
  it('does not treat a prefixed lookalike route as public', async () => {
    const response = await updateSession(makeRequest('/robots.txt.bak'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/login');
  });
});

describe('NextResponse interop', () => {
  it('returns a NextResponse the middleware can return directly', () => {
    // Guards against a refactor returning a plain Response, which Next's
    // middleware adapter rejects at runtime rather than at build time.
    expect(NextResponse.next()).toBeInstanceOf(Response);
  });
});