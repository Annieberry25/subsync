import { describe, it, expect } from 'vitest';
import {
  SESSION_COOKIE_OPTIONS,
  BROWSER_SESSION_COOKIE_OPTIONS,
} from '@/lib/supabase/cookie-options';

/**
 * `createBrowserClient` persists auth state via `document.cookie`, and browsers
 * discard any script-written cookie that carries HttpOnly. Reintroducing
 * httpOnly on the browser client silently breaks the PKCE handshake: no code
 * verifier is stored, so `/auth/callback` fails `exchangeCodeForSession` and
 * OAuth/one-time-code sign-in never completes.
 */
describe('BROWSER_SESSION_COOKIE_OPTIONS', () => {
  it('must not be httpOnly, or script-written auth cookies are dropped', () => {
    expect(BROWSER_SESSION_COOKIE_OPTIONS.httpOnly).toBe(false);
  });

  it('keeps the rest of the session cookie attributes aligned with the server client', () => {
    expect(BROWSER_SESSION_COOKIE_OPTIONS.sameSite).toBe(
      SESSION_COOKIE_OPTIONS.sameSite
    );
    expect(BROWSER_SESSION_COOKIE_OPTIONS.secure).toBe(
      SESSION_COOKIE_OPTIONS.secure
    );
  });
});

describe('SESSION_COOKIE_OPTIONS', () => {
  it('stays httpOnly for sessions minted on the server', () => {
    expect(SESSION_COOKIE_OPTIONS.httpOnly).toBe(true);
  });
});
