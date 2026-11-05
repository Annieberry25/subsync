export const ACCOUNT_TYPES = ['Individual', 'Family', 'Work', 'Main Account', 'Other'] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const RECEIPT_ACCOUNT_TYPES = ['Individual', 'Family', 'Work', 'Other'] as const;

export type ReceiptAccountType = (typeof RECEIPT_ACCOUNT_TYPES)[number];

/**
 * Keeps older rows readable after the account type was renamed. The stored
 * label is the type, so only the exact old value is migrated; custom labels a
 * user typed are left alone.
 */
export function normalizeAccountTypeLabel(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';
  return trimmed.toLowerCase() === 'personal' ? 'Individual' : trimmed;
}
