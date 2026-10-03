import { describe, it, expect, vi } from 'vitest';
import * as cookieOptions from '@/lib/supabase/cookie-options';
import {
  SESSION_COOKIE_OPTIONS,
  SOCIAL_AUTH_PROVIDERS,
} from '@/lib/supabase/cookie-options';

// createClient() reads these through the validated env module; the values only
// have to be well-formed for the client to be constructed.
vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://project-ref.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  },
}));

/**
 * The auth cookie used to be httpOnly on the server while the browser client
 * was forced to `httpOnly: false` (browsers drop a `document.cookie` write
 * carrying HttpOnly, which broke the PKCE verifier and so broke OAuth).
 *
 * That split could not work: a `Set-Cookie` for `sb-<ref>-auth-token` carrying
 * HttpOnly replaces the JS-visible cookie of the same name, so every
 * server-minted session — `/api/auth/login` and `/auth/callback` — left the
 * browser client unable to read it. Every client-side read then went out
 * unauthenticated, which is why a Google sign-in landed on an empty dashboard.
 *
 * These tests pin the invariants that keep that from coming back.
 */
describe('SESSION_COOKIE_OPTIONS', () => {
  it('must not be httpOnly, or the client-side Supabase data layer goes blind', () => {
    expect(SESSION_COOKIE_OPTIONS.httpOnly).toBe(false);
  });

  /**
   * The PKCE code verifier has to ride along on the top-level GET navigation
   * Google makes back to /auth/callback. `lax` sends it; `strict` would not.
   */
  it('keeps the auth cookie lax so the OAuth callback carries the session', () => {
    expect(SESSION_COOKIE_OPTIONS.sameSite).toBe('lax');
  });

  it('is the only cookie config exported, so the clients cannot drift apart', () => {
    expect(cookieOptions).not.toHaveProperty('BROWSER_SESSION_COOKIE_OPTIONS');
  });
});

/**
 * `createBrowserClient` reuses its client only when `isSingleton` is true or
 * when it is handed no options at all. Passing options silently opts out, and
 * the auth screens build a client inside the render body — so each render made
 * a new GoTrueClient, whose `_recoverAndRefresh()` deletes
 * `sb-<ref>-auth-token-code-verifier` when it sees a stale session. That raced
 * `signInWithOAuth` writing the verifier and broke the callback.
 */
describe('createClient', () => {
  it('returns the same browser client on repeated calls', async () => {
    const { createClient } = await import('@/lib/supabase/client');
    expect(createClient()).toBe(createClient());
  });
});

/**
 * Apple is disabled on the Supabase project, and `signInWithOAuth` against a
 * disabled provider cannot produce a session. Rendering it as a button is a
 * dead control that reads as a bug in the app.
 */
describe('SOCIAL_AUTH_PROVIDERS', () => {
  it('only offers providers that are enabled on the Supabase project', () => {
    expect(SOCIAL_AUTH_PROVIDERS.map((provider) => provider.id)).toEqual(['google']);
  });

  it('gives every provider a label', () => {
    for (const provider of SOCIAL_AUTH_PROVIDERS) {
      expect(provider.label).toMatch(/^Continue with /);
    }
  });
});
