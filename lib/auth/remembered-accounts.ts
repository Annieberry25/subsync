'use client';

export interface RememberedAccount {
  email: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
  lastUsed: number;
}

const STORAGE_KEY = 'subsync_remembered_accounts';

export function getRememberedAccounts(): RememberedAccount[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
  } catch {
    return [];
  }
}

export function saveRememberedAccount(account: Omit<RememberedAccount, 'lastUsed'> & { lastUsed?: number }) {
  if (typeof window === 'undefined') return;
  try {
    const current = getRememberedAccounts();
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

    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Local storage fallback ignore
  }
}

export function removeRememberedAccount(email: string): RememberedAccount[] {
  if (typeof window === 'undefined') return [];
  try {
    const current = getRememberedAccounts();
    const filtered = current.filter((acc) => acc.email.toLowerCase() !== email.toLowerCase().trim());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return filtered;
  } catch {
    return [];
  }
}
