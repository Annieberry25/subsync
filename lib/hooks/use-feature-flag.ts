'use client';

import { useAuth } from '@/lib/contexts/user-settings-context';
import { isFeatureAvailable, type FeatureKey } from '@/lib/config/feature-flags';

/**
 * Whether the signed-in account can use a flagged feature right now.
 *
 * The flag answers "is this shipped" and the account answers "is this one of
 * the admins it is being tried on". Components only need this one answer.
 */
export function useFeatureFlag(key: FeatureKey): boolean {
  const { isAdmin } = useAuth();
  return isFeatureAvailable(key, isAdmin);
}
