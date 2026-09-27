import type { User } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database.types';

export type PlanTier = 'free' | 'plus' | 'premium';

const PLAN_RANK: Record<PlanTier, number> = { free: 0, plus: 1, premium: 2 };

/**
 * Fetch the current signed-in user from a server-side client.
 * Returns null when no valid session exists (caller decides the 401 response).
 */
export async function getAuthUser(
  supabase: SupabaseClient<Database>
): Promise<User | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

/** Resolve the user's plan tier from user_metadata (defaults to free). */
export function getPlanTier(user: User): PlanTier {
  const meta = user.user_metadata?.plan_tier;
  return meta === 'plus' || meta === 'premium' ? meta : 'free';
}

/** True when the user's plan is at or above the required tier. */
export function hasPlanTier(user: User, minTier: PlanTier): boolean {
  return PLAN_RANK[getPlanTier(user)] >= PLAN_RANK[minTier];
}

/**
 * Resolve the admin flag for a user id from the profiles row.
 * Server-side only — uses the passed client (works from middleware too).
 */
export async function isUserAdmin(
  supabase: SupabaseClient<Database>,
  userId: string | undefined
): Promise<boolean> {
  if (!userId) return false;
  const { data, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle();
  return !error && data?.is_admin === true;
}

/** Convenience: fetch the current user and check the admin flag in one call. */
export async function isAdminUser(
  supabase: SupabaseClient<Database>
): Promise<boolean> {
  const user = await getAuthUser(supabase);
  if (!user) return false;
  return isUserAdmin(supabase, user.id);
}