/**
 * Monthly receipt-scan accounting.
 *
 * `maxReceiptScansPerMonth` was declared in the plan limits but had no
 * enforcement site, so a free account could call a provider-backed vision
 * endpoint without bound. This module records each scan and reads the count
 * back for quota checks.
 *
 * Both reads and writes go through the service role. `receipt_scan_usage` is
 * granted to `service_role` only: quota rows must be non-forgeable, and a
 * client-readable counter would be trivially defeated. The `userId` passed in
 * always comes from a verified session, never from request input.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

export type ReceiptScanSource = 'upload' | 'paste' | 'email' | 'gmail';

/** Start of the current calendar month in UTC, as an ISO timestamp. */
export function startOfCurrentMonthUtc(now: Date = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/**
 * Counts scans used in the current calendar month.
 *
 * Reads used to run through the caller's RLS-scoped session client, but the
 * table grants `SELECT` to `service_role` alone. Every read therefore failed
 * with a permission error, the catch below turned that into `0`, and the
 * quota never tripped — free accounts got unlimited provider-backed scans
 * while the UI showed the limit as untouched.
 *
 * Fails open on a genuine database error so a hiccup does not block a paying
 * user, but logs at error level because an unreadable counter means the quota
 * is not actually being enforced.
 */
export async function countReceiptScansThisMonth(
  userId: string,
  now: Date = new Date()
): Promise<number> {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    logger.error('[receipt-scan-usage] service role key missing; quota cannot be enforced');
    return 0;
  }
  try {
    const { count, error } = await createAdminClient()
      .from('receipt_scan_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startOfCurrentMonthUtc(now));

    if (error) {
      logger.error('[receipt-scan-usage] count failed; quota not enforced', {
        message: error.message,
      });
      return 0;
    }
    return count ?? 0;
  } catch (err) {
    logger.error('[receipt-scan-usage] count threw; quota not enforced', { message: String(err) });
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
    const { error } = await createAdminClient()
      .from('receipt_scan_usage')
      .insert({ user_id: userId, source });
    if (error) {
      logger.warn('[receipt-scan-usage] insert failed', { message: error.message });
    }
  } catch (err) {
    logger.warn('[receipt-scan-usage] insert threw', { message: String(err) });
  }
}
