import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser, isUserAdmin } from '@/lib/auth/access';

/**
 * Server-side admin guard for API routes. Returns the authed user when the
 * current session belongs to an account with profiles.is_admin = true,
 * otherwise null (caller decides 401/403).
 */
export async function requireAdmin(): Promise<User | null> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return null;
  const ok = await isUserAdmin(supabase, user.id);
  return ok ? user : null;
}