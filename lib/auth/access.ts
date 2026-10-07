import type { User } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database.types';

export type PlanTier = 'free' | 'plus' | 'premium';

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

/**
 * Resolve the user's plan tier from the server-side profiles row.
 *
 * auth.user_metadata is CLIENT-CONTROLLED (anyone can call
 * `supabase.auth.updateUser()` to set plan_tier on their own account), so it
 * must never be used for enforcement. The profiles row is the authority:
 * migration 013 blocks clients from writing is_admin/plan_tier/plan_expires_at
 * on their own row, and the service role (Paystack webhook, admin grants) is
 * the only writer.
 *
 * Admin resolves to the premium token (getPlanLimits() then maps admin to the
 * unlimited tier). A plan whose plan_expires_at has passed resolves to free;
 * a NULL expiry is honored as before (indefinite) to avoid silently demoting
 * pre-existing paid rows. Defaults to free when there is no row.
 */
export async function resolveServerPlanTier(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<{ tier: PlanTier; isAdmin: boolean }> {
  const { data } = await supabase
    .from('profiles')
    .select('plan_tier, plan_expires_at, is_admin')
    .eq('id', userId)
    .maybeSingle();

  if (data?.is_admin === true) return { tier: 'premium', isAdmin: true };

  const expires = data?.plan_expires_at ? new Date(data.plan_expires_at) : null;
  if (expires && expires.getTime() <= Date.now()) {
    return { tier: 'free', isAdmin: false };
  }

  const raw = data?.plan_tier;
  const tier: PlanTier =
    raw === 'plus' ? 'plus' : raw === 'premium' || raw === 'pro' ? 'premium' : 'free';
  return { tier, isAdmin: false };
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