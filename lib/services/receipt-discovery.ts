/**
 * Shared helpers for turning inbound receipt emails (Gmail scan, forwarded
 * receipts) into subscription drafts. Pure functions only — no I/O.
 */
import type { BillFrequency } from '@/lib/types/bills.types';

export type SubscriptionBillingCycle = 'monthly' | 'yearly' | 'weekly' | 'quarterly' | 'custom';
export type SubscriptionCategory =
  | 'Streaming'
  | 'Software'
  | 'Utilities'
  | 'Fitness'
  | 'Finance'
  | 'Education'
  | 'Gaming'
  | 'Other';

export const GENERIC_PROVIDER_NAME = 'General Provider';

export function deriveProviderFromSender(from: string): string {
  const match = from.match(/[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+)/);
  if (!match) return GENERIC_PROVIDER_NAME;
  const domain = match[1].toLowerCase().replace(/\.co$/, '').replace(/\.com$/, '').replace(/\.app$/, '');
  if (!domain) return GENERIC_PROVIDER_NAME;
  return domain
    .split('.')[0]
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const CATEGORY_MAP: Array<{ keys: string[]; category: SubscriptionCategory }> = [
  {
    keys: ['tv', 'stream', 'netflix', 'spotify', 'hulu', 'disney', 'prime video', 'youtube premium', 'apple tv'],
    category: 'Streaming',
  },
  {
    keys: ['software', 'digital', 'cloud', 'aws', 'github', 'openai', 'microsoft', 'adobe', 'figma', 'linear', 'notion', 'slack', 'zoom'],
    category: 'Software',
  },
  {
    keys: ['gaming', 'playstation', 'xbox', 'steam', 'nintendo', 'playstation plus', 'xbox game pass', 'game'],
    category: 'Gaming',
  },
  {
    keys: ['gym', 'fitness', 'workout', 'member', 'club', 'crossfit'],
    category: 'Fitness',
  },
  {
    keys: ['insurance', 'policy', 'finance', 'bank', 'investment', 'loan', 'credit'],
    category: 'Finance',
  },
  {
    keys: ['tuition', 'school', 'education', 'university', 'course', 'waec', 'jamb', 'coursera', 'udemy', 'duolingo'],
    category: 'Education',
  },
];

export function mapBillCategoryToSubscriptionCategory(raw: string): SubscriptionCategory {
  const norm = (raw || '').toLowerCase();
  for (const entry of CATEGORY_MAP) {
    if (entry.keys.some((key) => norm.includes(key))) {
      return entry.category;
    }
  }
  return 'Other';
}

const BILLING_MAP: Record<BillFrequency, SubscriptionBillingCycle> = {
  one_time: 'custom',
  monthly: 'monthly',
  yearly: 'yearly',
  weekly: 'weekly',
  quarterly: 'quarterly',
  custom: 'custom',
};

export function mapPaymentFrequencyToBillingCycle(
  frequency: BillFrequency | undefined | null
): SubscriptionBillingCycle {
  if (frequency && frequency in BILLING_MAP) return BILLING_MAP[frequency];
  return 'monthly';
}

export function normalizeSubscriptionName(name: string | null | undefined): string {
  return (name || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function mapBillingCycleToBillFrequency(cycle: string | undefined | null): BillFrequency | undefined {
  switch ((cycle || '').toLowerCase()) {
    case 'monthly':
      return 'monthly';
    case 'yearly':
      return 'yearly';
    case 'weekly':
      return 'weekly';
    case 'quarterly':
      return 'quarterly';
    case 'one_time':
    case 'custom':
    case 'unknown':
    case '':
    case undefined:
      return 'one_time';
  }
}

export function stripHtmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface ReceiptDraft {
  name: string;
  price: number;
  currency: string;
  billingCycle: SubscriptionBillingCycle;
  category: SubscriptionCategory;
  from: string;
  subject: string;
  date: string;
}

export function buildReceiptDraft(opts: {
  providerName: string;
  amount: number;
  currency: string;
  category: string;
  paymentFrequency?: BillFrequency;
  from: string;
  subject: string;
  paymentDate: string;
}): ReceiptDraft {
  return {
    name: opts.providerName.trim(),
    price: opts.amount,
    currency: opts.currency || 'USD',
    billingCycle: mapPaymentFrequencyToBillingCycle(opts.paymentFrequency),
    category: mapBillCategoryToSubscriptionCategory(opts.category),
    from: opts.from,
    subject: opts.subject,
    date: opts.paymentDate,
  };
}