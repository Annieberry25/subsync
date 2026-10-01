import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { signOutAndRedirect } from '@/lib/auth/sign-out';

const originalFetch = globalThis.fetch;

const setFetch = (impl: (...args: unknown[]) => unknown) => {
  globalThis.fetch = vi.fn(impl) as unknown as typeof fetch;
};

describe('signOutAndRedirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const fetchMock = () => globalThis.fetch as unknown as ReturnType<typeof vi.fn>;

  it('posts to the server endpoint, since JS cannot clear an httpOnly cookie', async () => {
    setFetch(async () => ({ ok: true, status: 200, json: async () => ({ cleared: true }) }));

    await expect(signOutAndRedirect()).resolves.toBe(true);

    const [url, init] = fetchMock().mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/auth/signout');
    expect(init.method).toBe('POST');
  });

  it('makes exactly one network call, to our own endpoint', async () => {
    /* supabase.auth.signOut() calls admin.signOut() even for scope:'local', so
       awaiting it made logout depend on Supabase being reachable. The helper
       must only talk to the endpoint, which expires the cookie without network. */
    setFetch(async () => ({ ok: true, status: 200, json: async () => ({ cleared: true }) }));

    await signOutAndRedirect();

    expect(fetchMock()).toHaveBeenCalledTimes(1);
    expect(fetchMock().mock.calls[0][0]).toBe('/api/auth/signout');
  });

  it('does not import the Supabase client at all', async () => {
    // Guards the regression that made logout hang: a browser signOut() call
    // here would reintroduce a network round trip with no timeout. Comments
    // are stripped first, since the file documents the very call it avoids.
    const raw = await readFile(join(process.cwd(), 'lib', 'auth', 'sign-out.ts'), 'utf8');
    const code = raw
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

    expect(code).not.toContain('supabase/client');
    expect(code).not.toContain('auth.signOut');
    expect(code).not.toContain('createClient');
  });

  it('sends a timeout signal so the UI cannot get stuck', async () => {
    setFetch(async () => ({ ok: true, status: 200, json: async () => ({ cleared: true }) }));

    await signOutAndRedirect();

    const [, init] = fetchMock().mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('reports failure on a non-ok response', async () => {
    // Redirecting with a live cookie bounces off /login and looks inert.
    setFetch(async () => ({ ok: false, status: 500, json: async () => ({ cleared: false }) }));

    await expect(signOutAndRedirect()).resolves.toBe(false);
  });

  it('reports failure when the endpoint is unreachable', async () => {
    setFetch(() => {
      throw new Error('network down');
    });

    await expect(signOutAndRedirect()).resolves.toBe(false);
  });

  it('reports failure when the response body does not confirm the clear', async () => {
    setFetch(async () => ({ ok: true, status: 200, json: async () => ({}) }));

    await expect(signOutAndRedirect()).resolves.toBe(false);
  });

  it('reports failure when the body is not JSON', async () => {
    setFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('not json');
      },
    }));

    await expect(signOutAndRedirect()).resolves.toBe(false);
  });
});
