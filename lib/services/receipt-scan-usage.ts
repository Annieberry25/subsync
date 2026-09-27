/**
 * Monthly receipt-scan accounting.
 *
 * `maxReceiptScansPerMonth` was declared in the plan limits but had no
 * enforcement site, so a free account could call a provider-backed vision
 * endpoint without bound. This module records each scan and reads the count
 * back for quota checks.
 *
 * Reads go through the caller's RLS-scoped session client (users can read their
 * own rows). Writes use the service role because quota rows must be
 * non-forgeable.
 */
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import type { Database } from '@/lib/types/database.types';

export type ReceiptScanSource = 'upload' | 'paste' | 'email' | 'gmail';

/** Start of the current calendar month in UTC, as an ISO timestamp. */
export function startOfCurrentMonthUtc(now: Date = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/**
 * Counts scans used in the current calendar month.
 * Fails open (returns 0) so a database hiccup never blocks a paying user;
 * the endpoint's own rate limiter is the backstop.
 */
export async function countReceiptScansThisMonth(
  supabase: SupabaseClient<Database>,
  userId: string,
  now: Date = new Date()
): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('receipt_scan_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startOfCurrentMonthUtc(now));

    if (error) {
      logger.warn('[receipt-scan-usage] count failed', { message: error.message });
      return 0;
    }
    return count ?? 0;
  } catch (err) {
    logger.warn('[receipt-scan-usage] count threw', { message: String(err) });
    return 0;
  }
}

/**
 * Records a scan. Must run with the service role: a client-writable counter
 * would be trivially defeated.
 */
export async function recordReceiptScan(
  userId: string,
  source: ReceiptScanSource = 'upload'
): Promise<void> {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    logger.warn('[receipt-scan-usage] service role key missing; scan not recorded');
    return;
  }
  try {
    const admin = createSupabaseClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { error } = await admin
      .from('receipt_scan_usage')
      .insert({ user_id: userId, source });
    if (error) {
      logger.warn('[receipt-scan-usage] insert failed', { message: error.message });
    }
  } catch (err) {
    logger.warn('[receipt-scan-usage] insert threw', { message: String(err) });
  }
}
