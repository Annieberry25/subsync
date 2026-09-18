import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import type { Database } from '@/lib/types/database.types';

/**
 * Admin (service-role) Supabase client.
 *
 * Server-only. Bypasses RLS — only use in trusted API routes for privileged
 * operations (e.g. account deletion). Never call this from client code or
 * pass this client down to components.
 */
export function createAdminClient(): SupabaseClient<Database> {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  }

  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}