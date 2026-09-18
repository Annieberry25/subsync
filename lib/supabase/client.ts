import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { SESSION_COOKIE_OPTIONS } from '@/lib/supabase/cookie-options';
import type { Database } from '@/lib/types/database.types';

export function createClient(): SupabaseClient<Database> {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { cookieOptions: SESSION_COOKIE_OPTIONS }
  );
}
