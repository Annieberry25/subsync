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