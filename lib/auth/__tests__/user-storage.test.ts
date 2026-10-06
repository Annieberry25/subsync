import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  USER_SCOPED_STORAGE_KEYS,
  clearUserScopedStorage,
  ensureCacheOwnership,
} from '@/lib/auth/user-storage';

/**
 * Regression: every one of these caches was written under a single global key, so
 * two people sharing a browser shared them. That was not only cosmetic --
 * `fetchSubscriptions` merged cached rows missing from the remote result, and
 * `syncPendingSubscriptions` then INSERTed any still-local-only row into the new
 * account under the new account's user_id. Data was migrated, not just shown.
 */
describe('clearUserScopedStorage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('removes every user-scoped key', () => {
    for (const key of USER_SCOPED_STORAGE_KEYS) {
      window.localStorage.setItem(key, 'leaked');
    }

    clearUserScopedStorage();

    for (const key of USER_SCOPED_STORAGE_KEYS) {
      expect(window.localStorage.getItem(key)).toBeNull();
    }
  });

  it('keeps the saved-accounts list, which is meant to outlive a session', () => {
    window.localStorage.setItem('subhalt_remembered_accounts', '[]');
    window.localStorage.setItem('subhalt_subscriptions', '[]');

    clearUserScopedStorage();

    // The login screen offers the previous account from this key; wiping it would
    // break the account chooser.
    expect(window.localStorage.getItem('subhalt_remembered_accounts')).toBe('[]');
    expect(window.localStorage.getItem('subhalt_subscriptions')).toBeNull();
  });

  it('keeps device-scoped market data', () => {
    window.localStorage.setItem('subhalt_exchange_rates', '{"NGN":1555}');
    window.localStorage.setItem('subhalt_exchange_rates_time', '123');

    clearUserScopedStorage();

    expect(window.localStorage.getItem('subhalt_exchange_rates')).toBe('{"NGN":1555}');
  });

  it('clears the entitlements and billing PII that were leaking', () => {
    // These are the highest-consequence keys: a free account inheriting a Plus
    // cache, or one account seeing another's address and card details.
    const sensitive = [
      'subhalt_plan_tier',
      'subhalt_billing_details',
      'subhalt_payment_methods',
      'subhalt_gmail_connected',
    ] as const;

    for (const key of sensitive) window.localStorage.setItem(key, 'secret');
    clearUserScopedStorage();

    for (const key of sensitive) {
      expect(window.localStorage.getItem(key)).toBeNull();
    }
  });
});

describe('ensureCacheOwnership', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('drops the cache when a different account signs in', () => {
    window.localStorage.setItem('subhalt_subscriptions', '[]');
    ensureCacheOwnership('user-a');

    expect(window.localStorage.getItem('subhalt_subscriptions')).toBeNull();
  });

  it('keeps the cache when the same account resolves again', () => {
    ensureCacheOwnership('user-a');
    window.localStorage.setItem('subhalt_subscriptions', '[]');

    ensureCacheOwnership('user-a');

    expect(window.localStorage.getItem('subhalt_subscriptions')).toBe('[]');
  });

  /**
   * First run after this shipped: caches exist from before any owner was recorded.
   * They must be treated as unowned rather than assumed to belong to whoever
   * happens to sign in first.
   */
  it('clears pre-existing caches that have no recorded owner', () => {
    window.localStorage.setItem('subhalt_bill_payments', '[]');
    window.localStorage.setItem('subhalt_activity_log', '[]');

    ensureCacheOwnership('user-a');

    expect(window.localStorage.getItem('subhalt_bill_payments')).toBeNull();
    expect(window.localStorage.getItem('subhalt_activity_log')).toBeNull();
  });

  it('is a no-op without a user id, so it never wipes on a signed-out render', () => {
    window.localStorage.setItem('subhalt_subscriptions', '[]');

    ensureCacheOwnership(undefined);

    expect(window.localStorage.getItem('subhalt_subscriptions')).toBe('[]');
  });

  it('does not throw when storage is unavailable', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(() => ensureCacheOwnership('user-a')).not.toThrow();
    expect(getItem).toHaveBeenCalled();
  });
});