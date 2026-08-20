import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/types/database.types';
import type {
  BillPayment,
  BillPaymentInsert,
  BillPaymentUpdate,
  BillSpendingSummary,
  CategorySpending,
  ProviderSpending,
  BillFilterOptions,
} from '@/lib/types/bills.types';
import { convertAmount } from '@/lib/services/currency-service';
import { getVerifiedProvider } from '@/lib/constants/verified-providers';

export type BillPaymentRow = Database['public']['Tables']['bill_payments']['Row'];

const STORAGE_KEY = 'subsync_bill_payments';
let cachedBills: BillPayment[] | null = null;

// Initial Mock Seed Payments for First-time users or offline demo
const INITIAL_DEMO_BILLS: BillPayment[] = [
  {
    id: 'bill_demo_1',
    userId: 'demo_user',
    category: 'Electricity',
    customCategory: null,
    providerName: 'Ikeja Electric (IKEDC)',
    amount: 25000,
    currency: 'NGN',
    paymentDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 days ago
    country: 'Nigeria',
    region: 'Lagos',
    city: 'Ikeja',
    paymentFrequency: 'monthly',
    isRecurring: true,
    notes: 'August 2026 Prepaid Electricity Token',
    receipts: [
      {
        id: 'rec_1',
        fileName: 'IKEDC_Token_Receipt_Aug2026.pdf',
        uploadDate: new Date().toISOString(),
        price: 25000,
        currency: 'NGN',
        provider: 'Ikeja Electric (IKEDC)',
      },
    ],
    source: 'receipt_scan',
    providerReference: 'IKEDC-94827103',
    officialProviderUrl: 'https://www.ikejaelectric.com/pay',
    status: 'paid',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'bill_demo_2',
    userId: 'demo_user',
    category: 'Internet',
    customCategory: null,
    providerName: 'Spectranet 4G LTE',
    amount: 19500,
    currency: 'NGN',
    paymentDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    country: 'Nigeria',
    region: 'Lagos',
    city: 'Lekki',
    paymentFrequency: 'monthly',
    isRecurring: true,
    notes: 'Unlimited Freedom Plan renewal',
    receipts: [],
    source: 'manual',
    providerReference: 'SPEC-7739102',
    officialProviderUrl: 'https://selfcare.spectranet.com.ng',
    status: 'paid',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'bill_demo_3',
    userId: 'demo_user',
    category: 'Airtime / Mobile Data',
    customCategory: null,
    providerName: 'MTN Nigeria',
    amount: 5000,
    currency: 'NGN',
    paymentDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    country: 'Nigeria',
    region: 'Lagos',
    city: null,
    paymentFrequency: 'monthly',
    isRecurring: false,
    notes: 'Monthly data bundle top-up',
    receipts: [],
    source: 'manual',
    providerReference: 'MTN-882019',
    officialProviderUrl: 'https://mymtn.com.ng',
    status: 'paid',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'bill_demo_4',
    userId: 'demo_user',
    category: 'Other',
    customCategory: 'Water',
    providerName: 'Lagos Water Corporation (LWC)',
    amount: 8500,
    currency: 'NGN',
    paymentDate: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    country: 'Nigeria',
    region: 'Lagos',
    city: 'Victoria Island',
    paymentFrequency: 'monthly',
    isRecurring: true,
    notes: 'Estate water utility charge',
    receipts: [],
    source: 'manual',
    providerReference: 'LWC-30192',
    officialProviderUrl: 'https://lagoswater.org/pay',
    status: 'paid',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'bill_demo_5',
    userId: 'demo_user',
    category: 'Software / Digital Services',
    customCategory: null,
    providerName: 'Amazon Web Services (AWS)',
    amount: 45.0,
    currency: 'USD',
    paymentDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    country: 'Global',
    region: null,
    city: null,
    paymentFrequency: 'monthly',
    isRecurring: true,
    notes: 'Cloud hosting & S3 storage',
    receipts: [],
    source: 'email_discovered',
    providerReference: 'AWS-INV-99201',
    officialProviderUrl: 'https://console.aws.amazon.com/billing/home',
    status: 'paid',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function transformRowToBill(row: any): BillPayment {
  return {
    id: row.id,
    userId: row.user_id,
    category: row.category,
    customCategory: row.custom_category || null,
    providerName: row.provider_name,
    amount: Number(row.amount),
    currency: row.currency || 'NGN',
    paymentDate: row.payment_date,
    country: row.country || null,
    region: row.region || null,
    city: row.city || null,
    paymentFrequency: row.payment_frequency || null,
    isRecurring: Boolean(row.is_recurring),
    notes: row.notes || null,
    receipts: Array.isArray(row.receipts) ? row.receipts : [],
    source: row.source || 'manual',
    providerReference: row.provider_reference || null,
    officialProviderUrl: row.official_provider_url || null,
    status: row.status || 'paid',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getLocalBills(): BillPayment[] {
  if (typeof window === 'undefined') return INITIAL_DEMO_BILLS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
    // Initialize demo seed
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DEMO_BILLS));
    return INITIAL_DEMO_BILLS;
  } catch {
    return INITIAL_DEMO_BILLS;
  }
}

function setLocalBills(bills: BillPayment[]) {
  cachedBills = bills;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bills));
      window.dispatchEvent(new Event('subsync_bills_updated'));
    } catch {
      // Ignore
    }
  }
}

export async function fetchBillPayments(): Promise<{ data: BillPayment[]; error: Error | null }> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data, error } = await supabase
        .from('bill_payments')
        .select('*')
        .order('payment_date', { ascending: false });

      if (!error && data) {
        const transformed = data.map(transformRowToBill);
        const local = getLocalBills().filter((b) => b.userId === 'demo_user' || !data.some((d) => d.id === b.id));
        const merged = [...transformed, ...local];
        cachedBills = merged;
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          } catch {}
        }
        return { data: merged, error: null };
      }
    }
  } catch {
    // Fall back to local
  }

  const local = getLocalBills();
  cachedBills = local;
  return { data: local, error: null };
}

export async function createBillPayment(
  billData: Omit<BillPaymentInsert, 'user_id'> & { custom_category?: string | null }
): Promise<{ data: BillPayment | null; error: Error | null }> {
  const verified = getVerifiedProvider(billData.provider_name);
  const officialUrl = verified?.officialPaymentUrl || billData.official_provider_url || null;

  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data, error } = await supabase
        .from('bill_payments')
        .insert({
          user_id: user.id,
          category: billData.category,
          custom_category: billData.custom_category || null,
          provider_name: billData.provider_name,
          amount: billData.amount,
          currency: billData.currency || 'NGN',
          payment_date: billData.payment_date || new Date().toISOString().split('T')[0],
          country: billData.country || 'Nigeria',
          region: billData.region || null,
          city: billData.city || null,
          payment_frequency: billData.payment_frequency || null,
          is_recurring: billData.is_recurring ?? false,
          notes: billData.notes || null,
          receipts: billData.receipts as any || [],
          source: billData.source || 'manual',
          provider_reference: billData.provider_reference || null,
          official_provider_url: officialUrl,
          status: billData.status || 'paid',
        })
        .select()
        .single();

      if (!error && data) {
        const bill = transformRowToBill(data);
        const existing = getLocalBills();
        const updated = [bill, ...existing.filter((b) => b.id !== bill.id)];
        setLocalBills(updated);
        return { data: bill, error: null };
      }
    }
  } catch {
    // Ignore error
  }

  // Fallback local storage creation
  const newBill: BillPayment = {
    id: `bill_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    userId: 'demo_user',
    category: billData.category,
    customCategory: billData.custom_category || null,
    providerName: billData.provider_name,
    amount: billData.amount,
    currency: billData.currency || 'NGN',
    paymentDate: billData.payment_date || new Date().toISOString().split('T')[0],
    country: billData.country || 'Nigeria',
    region: billData.region || null,
    city: billData.city || null,
    paymentFrequency: billData.payment_frequency || null,
    isRecurring: billData.is_recurring ?? false,
    notes: billData.notes || null,
    receipts: (billData.receipts as any) || [],
    source: billData.source || 'manual',
    providerReference: billData.provider_reference || null,
    officialProviderUrl: officialUrl,
    status: billData.status || 'paid',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const existing = getLocalBills();
  const updated = [newBill, ...existing];
  setLocalBills(updated);

  return { data: newBill, error: null };
}

export async function updateBillPayment(
  id: string,
  updates: Partial<BillPayment>
): Promise<{ data: BillPayment | null; error: Error | null }> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const payload: any = {};
      if (updates.category !== undefined) payload.category = updates.category;
      if (updates.customCategory !== undefined) payload.custom_category = updates.customCategory;
      if (updates.providerName !== undefined) payload.provider_name = updates.providerName;
      if (updates.amount !== undefined) payload.amount = updates.amount;
      if (updates.currency !== undefined) payload.currency = updates.currency;
      if (updates.paymentDate !== undefined) payload.payment_date = updates.paymentDate;
      if (updates.country !== undefined) payload.country = updates.country;
      if (updates.region !== undefined) payload.region = updates.region;
      if (updates.city !== undefined) payload.city = updates.city;
      if (updates.paymentFrequency !== undefined) payload.payment_frequency = updates.paymentFrequency;
      if (updates.isRecurring !== undefined) payload.is_recurring = updates.isRecurring;
      if (updates.notes !== undefined) payload.notes = updates.notes;
      if (updates.receipts !== undefined) payload.receipts = updates.receipts;
      if (updates.providerReference !== undefined) payload.provider_reference = updates.providerReference;
      if (updates.officialProviderUrl !== undefined) payload.official_provider_url = updates.officialProviderUrl;
      if (updates.status !== undefined) payload.status = updates.status;

      const { data, error } = await supabase
        .from('bill_payments')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (!error && data) {
        const updatedBill = transformRowToBill(data);
        const existing = getLocalBills();
        const list = existing.map((b) => (b.id === id ? updatedBill : b));
        setLocalBills(list);
        return { data: updatedBill, error: null };
      }
    }
  } catch {
    // Ignore error
  }

  const existing = getLocalBills();
  let updatedBill: BillPayment | null = null;
  const list = existing.map((b) => {
    if (b.id === id) {
      updatedBill = { ...b, ...updates, updatedAt: new Date().toISOString() };
      return updatedBill;
    }
    return b;
  });

  setLocalBills(list);
  return { data: updatedBill, error: null };
}

export async function deleteBillPayment(id: string): Promise<{ error: Error | null }> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { error } = await supabase.from('bill_payments').delete().eq('id', id);
      if (error) {
        return { error: new Error(error.message) };
      }
    }
  } catch {
    // Ignore error
  }

  const existing = getLocalBills();
  const list = existing.filter((b) => b.id !== id);
  setLocalBills(list);
  return { error: null };
}

/**
 * Filter payments based on options
 */
export function filterBillPayments(bills: BillPayment[], options: BillFilterOptions): BillPayment[] {
  let result = [...bills];

  if (options.searchQuery && options.searchQuery.trim()) {
    const q = options.searchQuery.toLowerCase().trim();
    result = result.filter(
      (b) =>
        b.providerName.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q) ||
        (b.customCategory && b.customCategory.toLowerCase().includes(q)) ||
        (b.notes && b.notes.toLowerCase().includes(q)) ||
        (b.providerReference && b.providerReference.toLowerCase().includes(q)) ||
        (b.region && b.region.toLowerCase().includes(q))
    );
  }

  if (options.category && options.category !== 'All') {
    result = result.filter((b) => b.category === options.category || b.customCategory === options.category);
  }

  if (options.providerName && options.providerName !== 'All') {
    result = result.filter((b) => b.providerName === options.providerName);
  }

  if (options.currency && options.currency !== 'All') {
    result = result.filter((b) => b.currency.toUpperCase() === options.currency?.toUpperCase());
  }

  if (options.status && options.status !== 'all') {
    result = result.filter((b) => b.status === options.status);
  }

  if (options.dateFrom) {
    result = result.filter((b) => b.paymentDate >= options.dateFrom!);
  }

  if (options.dateTo) {
    result = result.filter((b) => b.paymentDate <= options.dateTo!);
  }

  // Sorting
  const sortBy = options.sortBy || 'date_desc';
  result.sort((a, b) => {
    if (sortBy === 'date_desc') {
      return new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime();
    }
    if (sortBy === 'date_asc') {
      return new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime();
    }
    if (sortBy === 'amount_desc') {
      return b.amount - a.amount;
    }
    if (sortBy === 'amount_asc') {
      return a.amount - b.amount;
    }
    if (sortBy === 'provider_asc') {
      return a.providerName.localeCompare(b.providerName);
    }
    return 0;
  });

  return result;
}

const CATEGORY_COLORS: Record<string, string> = {
  Electricity: '#F59E0B',
  Internet: '#3B82F6',
  'Airtime / Mobile Data': '#10B981',
  'TV / Streaming': '#EC4899',
  'Rent / Housing': '#8B5CF6',
  Insurance: '#6366F1',
  Education: '#14B8A6',
  'Software / Digital Services': '#06B6D4',
  Membership: '#F43F5E',
  Utilities: '#EAB308',
  Other: '#64748B',
};

/**
 * Calculates spending summaries (monthly total, category breakdown, provider breakdown, mo/mo change).
 */
export function calculateBillSpendingSummary(
  bills: BillPayment[],
  userDisplayCurrency = 'USD',
  exchangeRates: Record<string, number> = {}
): BillSpendingSummary {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
  const prevYear = prevMonthDate.getFullYear();
  const prevMonth = prevMonthDate.getMonth();

  let totalThisMonth = 0;
  let previousMonthTotal = 0;
  let totalCountThisMonth = 0;
  let recurringMonthlyTotal = 0;
  const rawCurrenciesThisMonth: Record<string, number> = {};

  const categoryTotals: Record<string, { amount: number; count: number }> = {};
  const providerTotals: Record<string, { amount: number; count: number; category: string; officialUrl?: string | null }> = {};

  for (const bill of bills) {
    const bDate = new Date(bill.paymentDate);
    const bYear = bDate.getFullYear();
    const bMonth = bDate.getMonth();

    const convertedAmount = convertAmount(bill.amount, bill.currency, userDisplayCurrency, exchangeRates);

    // Is Current Month payment?
    if (bYear === currentYear && bMonth === currentMonth) {
      totalThisMonth += convertedAmount;
      totalCountThisMonth += 1;

      // Track original raw currency amount
      const curr = (bill.currency || 'NGN').toUpperCase();
      rawCurrenciesThisMonth[curr] = (rawCurrenciesThisMonth[curr] || 0) + bill.amount;

      // Category breakdown
      const catKey = bill.category === 'Other' && bill.customCategory ? bill.customCategory : bill.category;
      if (!categoryTotals[catKey]) {
        categoryTotals[catKey] = { amount: 0, count: 0 };
      }
      categoryTotals[catKey].amount += convertedAmount;
      categoryTotals[catKey].count += 1;

      // Provider breakdown
      const provKey = bill.providerName;
      if (!providerTotals[provKey]) {
        providerTotals[provKey] = {
          amount: 0,
          count: 0,
          category: catKey,
          officialUrl: bill.officialProviderUrl,
        };
      }
      providerTotals[provKey].amount += convertedAmount;
      providerTotals[provKey].count += 1;
    }

    // Is Previous Month payment?
    if (bYear === prevYear && bMonth === prevMonth) {
      previousMonthTotal += convertedAmount;
    }

    // Calculate recurring monthly commitment
    if (bill.isRecurring) {
      let monthlyEquiv = convertedAmount;
      if (bill.paymentFrequency === 'yearly') monthlyEquiv = convertedAmount / 12;
      else if (bill.paymentFrequency === 'weekly') monthlyEquiv = convertedAmount * 4.33;
      else if (bill.paymentFrequency === 'quarterly') monthlyEquiv = convertedAmount / 3;
      recurringMonthlyTotal += monthlyEquiv;
    }
  }

  // Calculate percentage change
  let percentageChange: number | null = null;
  if (previousMonthTotal > 0) {
    percentageChange = Number((((totalThisMonth - previousMonthTotal) / previousMonthTotal) * 100).toFixed(1));
  }

  // Format Category Breakdown
  const categoryBreakdown: CategorySpending[] = Object.entries(categoryTotals)
    .map(([cat, data]) => ({
      category: cat,
      totalAmount: data.amount,
      count: data.count,
      percentage: totalThisMonth > 0 ? Number(((data.amount / totalThisMonth) * 100).toFixed(1)) : 0,
      color: CATEGORY_COLORS[cat] || '#14B8A6',
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);

  // Format Provider Breakdown
  const providerBreakdown: ProviderSpending[] = Object.entries(providerTotals)
    .map(([prov, data]) => ({
      providerName: prov,
      totalAmount: data.amount,
      count: data.count,
      category: data.category,
      officialUrl: data.officialUrl,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);

  const recentPayments = [...bills]
    .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
    .slice(0, 5);

  return {
    totalThisMonth,
    totalThisMonthOriginalCurrencies: rawCurrenciesThisMonth,
    previousMonthTotal,
    percentageChange,
    totalCountThisMonth,
    recurringMonthlyTotal,
    categoryBreakdown,
    providerBreakdown,
    recentPayments,
  };
}
