'use client';

/**
 * Every localStorage key that holds data belonging to a specific signed-in user.
 *
 * These were all written under one global key per feature, so two people using
 * the same browser shared them. That was not only a display bug: `fetchSubscriptions`
 * merges cached rows that are absent from the remote result, so the previous
 * user's subscriptions were carried into the next account's list, and any row
 * still marked local-only was then INSERTed into the new account with that
 * account's `user_id` by `syncPendingSubscriptions`. Data was not just visible,
 * it was migrated.
 *
 * Deliberately excluded:
 *   - `subhalt_remembered_accounts` — the point of that key is to outlive a
 *     session; it is how the login screen offers the previous account.
 *   - `subhalt_exchange_rates` / `subhalt_exchange_rates_time` — market data,
 *     identical for everyone on the device.
 */
export const USER_SCOPED_STORAGE_KEYS = [
  // Subscription data. The worst offender: it fed a cross-account INSERT.
  'subhalt_subscriptions',
  'subhalt_bill_payments',
  'subhalt_activity_log',
  'subhalt_assistant_conversations',
  'subhalt_restored_history',

  // Entitlements and payment identity. Leaking these showed one account the
  // previous account's plan and billing details.
  'subhalt_plan_tier',
  'subhalt_billing_details',
  'subhalt_billing_transactions',
  'subhalt_payment_methods',
  'subhalt_gmail_connected',

  // Per-account content and preferences.
  'subhalt_reminders',
  'subhalt_user_bio',
  'subhalt_avatar_color',
  'subhalt_assistant_name',
  'subhalt_custom_categories',
  'subhalt_category_metadata',
  'subhalt_notification_preferences',
  'subhalt_default_currency',
  'subhalt_timezone',
] as const;

/**
 * Records which user the user-scoped caches currently belong to, so a switch can
 * be detected even when sign-out did not run (expired session, second tab,
 * cookie cleared by hand).
 */
const OWNER_KEY = 'subhalt_cache_owner';

/**
 * Fired after the caches are wiped so in-memory holders can drop their copies.
 *
 * Needed because clearing localStorage is not enough on its own:
 * `getCachedSubscriptions()` falls back to a module-level array when the key is
 * absent, so without this the previous account's rows stay resident in the tab
 * and get served to whoever signs in next. That was the remaining half of the
 * "logging out does not work on the same browser" report.
 *
 * A DOM event rather than a direct import: the services that hold memory state
 * already import the Supabase client, and calling them from here would both
 * create an import cycle and pull the client into the sign-out path.
 */
export const USER_CACHE_CLEARED_EVENT = 'subhalt_user_cache_cleared';

function removeItem(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Private mode / disabled storage. Nothing to clear, and nothing to report.
  }
}

/**
 * Wipes every user-scoped cache. Called on sign-out, before the next account is
 * loaded.
 *
 * Deliberately fails toward clearing: if this throws or is skipped, the failure
 * mode is showing the previous user their own data again. It is called first in
 * the sign-out path, before the network request, so an unreachable server cannot
 * leave the cache populated.
 */
export function clearUserScopedStorage(): void {
  if (typeof window === 'undefined') return;

  for (const key of USER_SCOPED_STORAGE_KEYS) removeItem(key);
  removeItem(OWNER_KEY);
  notifyMemoryHolders();
}

/**
 * Tells in-memory cache holders to drop their copies. Failures in a listener are
 * contained so one bad subscriber cannot abort the sign-out.
 */
function notifyMemoryHolders(): void {
  try {
    window.dispatchEvent(new Event(USER_CACHE_CLEARED_EVENT));
  } catch {
    // Nothing to clear in memory, or no listener could be reached.
  }
}

/**
 * Drops the caches if they belong to a different account than the one now
 * signed in, then records the new owner.
 *
 * This is the backstop for sign-out clearing: it also fires when a session is
 * replaced without `clearUserScopedStorage` having run, so an account switch can
 * never inherit the previous account's rows even if the sign-out path was
 * bypassed.
 *
 * @param userId The signed-in user's id.
 */
export function ensureCacheOwnership(userId: string | undefined): void {
  if (typeof window === 'undefined' || !userId) return;

  let currentOwner: string | null = null;
  try {
    currentOwner = window.localStorage.getItem(OWNER_KEY);
  } catch {
    return;
  }

  if (currentOwner === userId) return;

  // No owner recorded but caches present: treat as unowned and clear, rather than
  // assuming the existing rows belong to whoever just signed in.
  if (currentOwner !== null || hasAnyUserScopedCache()) {
    for (const key of USER_SCOPED_STORAGE_KEYS) removeItem(key);
    notifyMemoryHolders();
  }

  try {
    window.localStorage.setItem(OWNER_KEY, userId);
  } catch {
    // Non-fatal: the next load will simply clear again.
  }
}

function hasAnyUserScopedCache(): boolean {
  try {
    return USER_SCOPED_STORAGE_KEYS.some((key) => window.localStorage.getItem(key) !== null);
  } catch {
    return false;
  }
}