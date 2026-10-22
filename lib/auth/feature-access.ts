import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database.types';
import { FEATURE_FLAGS, type FeatureKey } from '@/lib/config/feature-flags';
import { isUserAdmin } from './access';

/**
 * Server-side counterpart of useFeatureFlag.
 *
 * Hiding an entry point is not access control: a non-admin could still call
 * the route directly. Admin-only flags are therefore checked here as well,
 * against the profiles row rather than anything the client sent.
 */
export async function isFeatureEnabledForUser(
  supabase: SupabaseClient<Database>,
  userId: string | undefined,
  key: FeatureKey
): Promise<boolean> {
  const feature = FEATURE_FLAGS[key];
  if (!feature.enabled || !userId) return false;
  if (!feature.adminOnly) return true;
  return isUserAdmin(supabase, userId);
}
