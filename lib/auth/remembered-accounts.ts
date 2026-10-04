'use client';

import { safeSetItem, safeGetItem } from '@/lib/safe-local-storage';

export interface RememberedAccount {
  email: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
  lastUsed: number;
}

const STORAGE_KEY = 'subhalt_remembered_accounts';

/**
 * Subscribers let useSyncExternalStore re-render when the list changes.
 *
 * Reads are not enough on their own: without a notification, a component that
 * mounted before the first Google sign-in would keep rendering a stale (empty)
 * list until something else happened to re-render it.
 */
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeRememberedAccounts(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

function parse(raw: string | null): RememberedAccount[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
  } catch {
    return [];
  }
}

/**
 * Parsed list, cached against the raw string it came from.
 *
 * useSyncExternalStore calls getSnapshot on every render and compares the result
 * by identity to decide whether anything changed. Parsing fresh each time would
 * hand back a new array every call and spin React in an infinite loop, so the
 * previous value is reused while the underlying string is unchanged.
 */
let cache: { raw: string | null; parsed: RememberedAccount[] } = { raw: null, parsed: [] };

/** Client snapshot. Only safe to call in the browser. */
export function getRememberedAccountsSnapshot(): RememberedAccount[] {
  const raw = safeGetItem(STORAGE_KEY);
  if (raw === cache.raw) return cache.parsed;
  cache = { raw, parsed: parse(raw) };
  return cache.parsed;
}

/**
 * Server and hydration snapshot: always empty.
 *
 * This is what makes the login screen hydration-safe. Whether the chooser
 * applies depends on localStorage, which the server cannot read, so the server
 * emits the email step and React keeps that markup for the hydration render
 * before swapping to the chooser once the client store reports the real list.
 * Seeding the same chooser from a useState initializer instead produced a
 * mismatch on every /login visit for anyone who had signed in before, because
 * the initializer ran in the browser render and not on the server.
 */

/** Server and hydration snapshot: always empty. */
export function getRememberedAccountsServerSnapshot(): RememberedAccount[] {
  return EMPTY;
}

/**
 * Identity must be stable across calls — React compares snapshots by reference
 * to decide whether to re-render.
 */
const EMPTY: RememberedAccount[] = [];

/** Convenience read for non-reactive callers. */
export function getRememberedAccounts(): RememberedAccount[] {
  if (typeof window === 'undefined') return [];
  return getRememberedAccountsSnapshot();
}

export function saveRememberedAccount(account: Omit<RememberedAccount, 'lastUsed'> & { lastUsed?: number }) {
  if (typeof window === 'undefined') return;
  try {
    const current = getRememberedAccountsSnapshot();
    const existingIndex = current.findIndex((acc) => acc.email.toLowerCase() === account.email.toLowerCase());

    const updatedAccount: RememberedAccount = {
      email: account.email.toLowerCase().trim(),
      displayName: account.displayName || (existingIndex >= 0 ? current[existingIndex].displayName : undefined),
      username: account.username || (existingIndex >= 0 ? current[existingIndex].username : undefined),
      avatarUrl: account.avatarUrl || (existingIndex >= 0 ? current[existingIndex].avatarUrl : undefined),
      lastUsed: Date.now(),
    };

    if (existingIndex >= 0) {
      current[existingIndex] = updatedAccount;
    } else {
      current.push(updatedAccount);
    }

    safeSetItem(STORAGE_KEY, JSON.stringify(current));
    notify();
  } catch {
    // Local storage unavailable (private mode, quota) — sign-in still works,
    // the chooser just does not remember this account.
  }
}

export function removeRememberedAccount(email: string): RememberedAccount[] {
  if (typeof window === 'undefined') return [];
  try {
    const current = getRememberedAccountsSnapshot();
    const filtered = current.filter((acc) => acc.email.toLowerCase() !== email.toLowerCase().trim());
    safeSetItem(STORAGE_KEY, JSON.stringify(filtered));
    notify();
    return filtered;
  } catch {
    return [];
  }
}

// Another tab signing in or out should be reflected here too.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY || event.key === null) notify();
  });
}