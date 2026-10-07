/**
 * Email-discovery accounting.
 *
 * `maxEmailDiscoveryPerMonth` was declared in the plan limits (100 for Plus, 0
 * for Free) but had no enforcement site, so the inbound email webhook could
 * parse and insert subscriptions without bound. Mirrors `receipt-scan-usage`:
 * the same table also serves as the per-user burst window — counts within the
 * last hour back the webhook rate limiter, so a single faulty forward cannot
 * explode into a hundred rows before the monthly quota trips.
 *
 * Reads and writes go through the service role. `email_discovery_usage` grants
 * `SELECT`/`INSERT`/`DELETE` to `service_role` only: quota rows must be
 * non-forgeable, and a client-writable counter would be trivially defeated.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { startOfCurrentMonthUtc } from '@/lib/services/receipt-scan-usage';

export type EmailDiscoverySource = 'email_forwarding' | 'gmail_monitoring';

/** Fails open to zero (no quota enforced) exactly like the receipt-scan read. */
async function countInWindow(userId: string, sinceIso: string): Promise<number> {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    logger.error('[email-discovery-usage] service role key missing; quota cannot be enforced');
    return 0;
  }
  try {
    const { count, error } = await createAdminClient()
      .from('email_discovery_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', sinceIso);

    if (error) {
      logger.error('[email-discovery-usage] count failed; quota not enforced', {
        message: error.message,
      });
      return 0;
    }
    return count ?? 0;
  } catch (err) {
    logger.error('[email-discovery-usage] count threw; quota not enforced', { message: String(err) });
    return 0;
  }
}

/** Rows recorded since the start of the current calendar month (UTC). */
export async function countEmailDiscoveryThisMonth(
  userId: string,
  now: Date = new Date()
): Promise<number> {
  return countInWindow(userId, startOfCurrentMonthUtc(now));
}

/** Rows recorded since `now` minus the given number of hours (burst window). */
export async function countEmailDiscoverySinceHours(
  userId: string,
  hours: number,
  now: Date = new Date()
): Promise<number> {
  const since = new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
  return countInWindow(userId, since);
}

/** Write an accounting row. Must run with the service role. */
export async function recordEmailDiscovery(
  userId: string,
  source: EmailDiscoverySource = 'email_forwarding'
): Promise<void> {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    logger.warn('[email-discovery-usage] service role key missing; discovery not recorded');
    return;
  }
  try {
    const { error } = await createAdminClient()
      .from('email_discovery_usage')
      .insert({ user_id: userId, source });
    if (error) {
      logger.warn('[email-discovery-usage] insert failed', { message: error.message });
    }
  } catch (err) {
    logger.warn('[email-discovery-usage] insert threw', { message: String(err) });
  }
}