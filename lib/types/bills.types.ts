import type { Database } from './database.types';

export type BillPaymentRow = Database['public']['Tables']['bill_payments']['Row'];
export type BillPaymentInsert = Database['public']['Tables']['bill_payments']['Insert'];
export type BillPaymentUpdate = Database['public']['Tables']['bill_payments']['Update'];

export type BillProviderRow = Database['public']['Tables']['bill_providers']['Row'];

export type BillSource = 'manual' | 'receipt_scan' | 'email_discovered';
export type BillStatus = 'paid' | 'pending' | 'overdue';
export type BillFrequency = 'one_time' | 'monthly' | 'yearly' | 'weekly' | 'quarterly' | 'custom';

export const STANDARD_BILL_CATEGORIES = [
  'Electricity',
  'Internet',
  'Airtime / Mobile Data',
  'TV / Streaming',
  'Rent / Housing',
  'Insurance',
  'Education',
  'Software / Digital Services',
  'Membership',
  'Utilities',
  'Other',
] as const;

export type StandardBillCategory = (typeof STANDARD_BILL_CATEGORIES)[number];

export interface AttachedBillReceipt {
  id: string;
  fileName: string;
  uploadDate: string;
  price?: number | null;
  currency?: string | null;
  provider?: string | null;
  rawText?: string | null;
  fileUrl?: string | null;
}

export interface BillPayment {
  id: string;
  userId: string;
  category: string;
  customCategory?: string | null;
  providerName: string;
  amount: number;
  currency: string;
  paymentDate: string;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  paymentFrequency?: BillFrequency | null;
  isRecurring: boolean;
  notes?: string | null;
  receipts?: AttachedBillReceipt[] | null;
  source: BillSource;
  providerReference?: string | null;
  officialProviderUrl?: string | null;
  status: BillStatus;
  createdAt: string;
  updatedAt: string;
}

export interface VerifiedProvider {
  id?: string;
  name: string;
  category: string;
  country: string;
  region?: string | null;
  officialWebsite?: string | null;
  officialPaymentUrl?: string | null;
  verificationStatus: 'verified' | 'user_submitted' | 'unverified';
  supportedRegions?: string[] | null;
}

export interface ExtractedBillReceiptData {
  providerName: string;
  amount: number;
  currency: string;
  paymentDate: string;
  category: string;
  customCategory?: string;
  providerReference?: string;
  paymentFrequency?: BillFrequency;
  region?: string;
  rawText?: string;
  fileName?: string;
  fileUrl?: string;
}

export interface CategorySpending {
  category: string;
  totalAmount: number; // Converted to user currency
  count: number;
  percentage: number;
  color: string;
}

export interface ProviderSpending {
  providerName: string;
  totalAmount: number; // Converted to user currency
  count: number;
  category: string;
  officialUrl?: string | null;
}

export interface BillSpendingSummary {
  totalThisMonth: number;
  totalThisMonthOriginalCurrencies: Record<string, number>;
  previousMonthTotal: number;
  percentageChange: number | null; // e.g. +12.5 or -5.2
  totalCountThisMonth: number;
  recurringMonthlyTotal: number;
  categoryBreakdown: CategorySpending[];
  providerBreakdown: ProviderSpending[];
  recentPayments: BillPayment[];
}

export interface BillFilterOptions {
  searchQuery?: string;
  category?: string;
  providerName?: string;
  currency?: string;
  status?: BillStatus | 'all';
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc' | 'provider_asc';
}
