import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { SESSION_COOKIE_OPTIONS } from '@/lib/supabase/cookie-options';
import type { Database } from '@/lib/types/database.types';

/**
 * One Supabase client per browser tab, reused by every caller.
 *
 * `createBrowserClient` only caches its client when `isSingleton` is true *or*
 * when no options object is passed at all — passing options silently opts out.
 * Every caller here passes `cookieOptions`, so without the explicit flag each
 * `createClient()` built a fresh `GoTrueClient`, and the auth screens call this
 * inside the render body.
 *
 * That is not just wasteful. auth-js runs `_initialize()` -> `_recoverAndRefresh()`
 * per instance, and a stale session makes that call `_removeSession()`, which
 * deletes `sb-<ref>-auth-token-code-verifier` from storage. Clicking "Continue
 * with Google" sets `socialLoading` first, so the resulting re-render started a
 * fresh client whose cleanup raced `signInWithOAuth` writing the PKCE verifier.
 * The verifier was deleted mid-flight and `/auth/callback` failed
 * `exchangeCodeForSession`. The SDK itself warns about this:
 * "Multiple GoTrueClient instances detected in the same browser context."
 */
export function createClient(): SupabaseClient<Database> {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { cookieOptions: SESSION_COOKIE_OPTIONS, isSingleton: true }
  );
}
