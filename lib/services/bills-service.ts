import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { safeSetItem, safeGetItem } from '@/lib/safe-local-storage';
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

const STORAGE_KEY = 'subhalt_bill_payments';

const LOCAL_BILL_USER_ID = 'user_mock';

export function isLocalOnlyBill(bill: Pick<BillPayment, 'userId'>): boolean {
  return bill.userId === LOCAL_BILL_USER_ID;
}

function transformRowToBill(row: BillPaymentRow): BillPayment {
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
  if (typeof window === 'undefined') return [];
  try {
    const stored = safeGetItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // Ignore corrupt/legacy payloads — treat as empty.
  }
  return [];
}

function setLocalBills(bills: BillPayment[]) {
  if (typeof window !== 'undefined') {
    try {
      safeSetItem(STORAGE_KEY, JSON.stringify(bills));
      window.dispatchEvent(new Event('subhalt_bills_updated'));
    } catch (err) {
      logger.warn('[bills-service] setLocalBills localStorage write failed', { message: err instanceof Error ? err.message : String(err) });
    }
  }
}

/**
 * Pushes locally-created (offline) bills into Supabase once a session exists and
 * the DB is reachable. Successful pushes leave the cache; their canonical rows
 * come back on the next fetch.
 */
export async function syncPendingBills(): Promise<number> {
  const local = getLocalBills();
  const pending = local.filter((b) => isLocalOnlyBill(b));
  if (pending.length === 0) return 0;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const syncedLocalIds = new Set<string>();
  for (const bill of pending) {
    const { error } = await supabase.from('bill_payments').insert({
      user_id: user.id,
      category: bill.category,
      custom_category: bill.customCategory ?? null,
      provider_name: bill.providerName,
      amount: bill.amount,
      currency: bill.currency || 'NGN',
      payment_date: bill.paymentDate,
      country: bill.country ?? 'Nigeria',
      region: bill.region || null,
      city: bill.city || null,
      payment_frequency: bill.paymentFrequency ?? null,
      is_recurring: bill.isRecurring ?? false,
      notes: bill.notes || null,
      receipts: bill.receipts || [],
      source: bill.source,
      provider_reference: bill.providerReference || null,
      official_provider_url: bill.officialProviderUrl || null,
      status: bill.status,
    });

    if (!error) {
      syncedLocalIds.add(bill.id);
    } else {
      logger.warn('[bills-service] syncPendingBills insert failed', { message: error.message, id: bill.id });
    }
  }

  if (syncedLocalIds.size > 0) {
    setLocalBills(local.filter((b) => !syncedLocalIds.has(b.id)));
  }
  return syncedLocalIds.size;
}

export async function fetchBillPayments(): Promise<{ data: BillPayment[]; error: Error | null }> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // Reconcile offline-created rows first so the merge below starts clean.
      if (getLocalBills().some((b) => isLocalOnlyBill(b))) {
        await syncPendingBills();
      }

      const { data, error } = await supabase
        .from('bill_payments')
        .select('*')
        .order('payment_date', { ascending: false })
        .limit(500);

      if (!error && data) {
        const transformed = data.map(transformRowToBill);
        // Keep any local (still-unsynced) rows that have no DB counterpart.
        const remoteIds = new Set(data.map((d) => d.id));
        const local = getLocalBills().filter((b) => !remoteIds.has(b.id));
        const merged = [...transformed, ...local];
        setLocalBills(merged);
        return { data: merged, error: null };
      }
      if (error) {
        const dbError = new Error(error.message);
        logger.warn('[bills-service] fetchBillPayments DB error, using cache', { message: error.message });
        return { data: getLocalBills(), error: dbError };
      }
    }
  } catch (err) {
    const dbError = err instanceof Error ? err : new Error(String(err));
    logger.error('[bills-service] fetchBillPayments exception, using cache', err);
    return { data: getLocalBills(), error: dbError };
  }

  const data = getLocalBills();
  return { data, error: null };
}

export function toBillPaymentInsert(
  billData: Partial<BillPayment>
): Omit<BillPaymentInsert, 'user_id'> & { custom_category?: string | null } {
  const payload: Partial<BillPaymentInsert> & { custom_category?: string | null } = {};
  if (billData.category !== undefined) payload.category = billData.category;
  if (billData.customCategory !== undefined) payload.custom_category = billData.customCategory;
  if (billData.providerName !== undefined) payload.provider_name = billData.providerName;
  if (billData.amount !== undefined) payload.amount = billData.amount;
  if (billData.currency !== undefined) payload.currency = billData.currency;
  if (billData.paymentDate !== undefined) payload.payment_date = billData.paymentDate;
  if (billData.country !== undefined) payload.country = billData.country;
  if (billData.region !== undefined) payload.region = billData.region;
  if (billData.city !== undefined) payload.city = billData.city;
  if (billData.paymentFrequency !== undefined) payload.payment_frequency = billData.paymentFrequency;
  if (billData.isRecurring !== undefined) payload.is_recurring = billData.isRecurring;
  if (billData.notes !== undefined) payload.notes = billData.notes;
  if (billData.receipts !== undefined) payload.receipts = billData.receipts;
  if (billData.providerReference !== undefined) payload.provider_reference = billData.providerReference;
  if (billData.officialProviderUrl !== undefined) payload.official_provider_url = billData.officialProviderUrl;
  if (billData.status !== undefined) payload.status = billData.status;
  if (billData.source !== undefined) payload.source = billData.source;
  return payload as Omit<BillPaymentInsert, 'user_id'> & { custom_category?: string | null };
}

export type BillWriteResult = {
  data: BillPayment | null;
  error: Error | null;
  synced: boolean;
};

export async function createBillPayment(
  billData: Omit<BillPaymentInsert, 'user_id'> & { custom_category?: string | null }
): Promise<BillWriteResult> {
  const verified = getVerifiedProvider(billData.provider_name);
  const officialUrl = verified?.officialPaymentUrl || billData.official_provider_url || null;

  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

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
          receipts: billData.receipts || [],
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
        return { data: bill, error: null, synced: true };
      }
      if (error) {
        const dbError = new Error(error.message);
        logger.warn('[bills-service] createBillPayment DB error', { message: error.message });
        return { data: null, error: dbError, synced: false };
      }
    } else {
      logger.warn('[bills-service] createBillPayment called without authenticated user');
    }
  } catch (err) {
    // Offline / unreachable: fall through to the local-save fallback below.
    logger.error('[bills-service] createBillPayment exception, persisting locally', err);
  }

  // Offline / storage-only fallback: persisted locally, flagged for later sync.
  const newBill: BillPayment = {
    id: `bill_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    userId: LOCAL_BILL_USER_ID,
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
    receipts: billData.receipts || [],
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

  return { data: newBill, error: null, synced: false };
}

export async function updateBillPayment(
  id: string,
  updates: Partial<BillPayment>
): Promise<BillWriteResult> {
  // Offline-created rows live only in the cache — update them locally.
  const localRow = getLocalBills().find((b) => b.id === id && isLocalOnlyBill(b));
  if (localRow) {
    const updatedBill: BillPayment = { ...localRow, ...updates, updatedAt: new Date().toISOString() };
    setLocalBills(getLocalBills().map((b) => (b.id === id ? updatedBill : b)));
    return { data: updatedBill, error: null, synced: false };
  }

  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const payload: BillPaymentUpdate = {};
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
        return { data: updatedBill, error: null, synced: true };
      }
      if (error) {
        logger.warn('[bills-service] updateBillPayment DB error, updating locally', { message: error.message });
      }
    } else {
      logger.warn('[bills-service] updateBillPayment called without authenticated user');
    }
  } catch (err) {
    // Offline / unreachable: fall through to the local fallback below.
    logger.error('[bills-service] updateBillPayment exception, updating locally', err);
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
  return { data: updatedBill, error: null, synced: false };
}

export async function deleteBillPayment(id: string): Promise<{ error: Error | null; synced: boolean }> {
  // Offline-created rows live only in the cache — remove them locally.
  if (getLocalBills().some((b) => b.id === id && isLocalOnlyBill(b))) {
    setLocalBills(getLocalBills().filter((b) => b.id !== id));
    return { error: null, synced: false };
  }

  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { error } = await supabase.from('bill_payments').delete().eq('id', id);
      if (error) {
        const dbError = new Error(error.message);
        logger.warn('[bills-service] deleteBillPayment DB error, deleting locally', { message: error.message });
        return { error: dbError, synced: false };
      }
    } else {
      logger.warn('[bills-service] deleteBillPayment called without authenticated user');
    }
  } catch (err) {
    // Offline / unreachable: fall through to the local fallback below.
    logger.error('[bills-service] deleteBillPayment exception, deleting locally', err);
  }

  setLocalBills(getLocalBills().filter((b) => b.id !== id));
  return { error: null, synced: true };
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
