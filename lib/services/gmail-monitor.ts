/**
 * Background Gmail monitoring. Scans a batch of connected users' inboxes and
 * auto-imports any new subscription receipts (deduped, free-tier-aware).
 * Intended to run from a cron endpoint (or Vercel Cron / instrumentation).
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { scanGmailForSubscriptions } from '@/lib/services/gmail-service';
import {
  buildReceiptDraft,
  mapBillingCycleToBillFrequency,
  normalizeSubscriptionName,
} from '@/lib/services/receipt-discovery';
import {
  fetchActiveSubscriptionNames,
  ingestReceiptDraft,
} from '@/lib/services/receipt-ingestion';

export interface GmailMonitorSummary {
  scanned: number;
  created: number;
  duplicates: number;
  limitReached: number;
  invalid: number;
  errors: string[];
}

export async function monitorGmailSubscriptionsForAllUsers(opts?: {
  maxUsers?: number;
  maxResults?: number;
}): Promise<GmailMonitorSummary> {
  const admin = createAdminClient();
  const summary: GmailMonitorSummary = {
    scanned: 0,
    created: 0,
    duplicates: 0,
    limitReached: 0,
    invalid: 0,
    errors: [],
  };

  const { data: connections, error } = await admin
    .from('gmail_connections')
    .select('user_id')
    .eq('status', 'connected')
    .order('last_scan_at', { ascending: true, nullsFirst: true })
    .limit(opts?.maxUsers ?? 10);

  if (error) {
    summary.errors.push(`Listing connections failed: ${error.message}`);
    return summary;
  }
  if (!connections || connections.length === 0) return summary;

  for (const connection of connections) {
    const userId = connection.user_id;
    try {
      const { discovered } = await scanGmailForSubscriptions(userId, opts?.maxResults ?? 40);
      summary.scanned += 1;

      const existing = new Set(await fetchActiveSubscriptionNames(admin, userId));
      const candidates = discovered.filter(
        (item) => !existing.has(normalizeSubscriptionName(item.providerName))
      );

      const status = 'ok';
      for (const item of candidates) {
        const draft = buildReceiptDraft({
          providerName: item.providerName,
          amount: item.amount,
          currency: item.currency,
          category: item.category,
          paymentFrequency: mapBillingCycleToBillFrequency(item.billingCycle),
          from: item.from,
          subject: item.subject,
          paymentDate: item.date,
        });
        const result = await ingestReceiptDraft(admin, userId, draft, 'Gmail Monitoring');
        if (result.status === 'created') summary.created += 1;
        else if (result.status === 'duplicate') summary.duplicates += 1;
        else if (result.status === 'limit_reached') summary.limitReached += 1;
        else summary.invalid += 1;
      }

      await admin
        .from('gmail_connections')
        .update({
          last_scan_at: new Date().toISOString(),
          last_scan_status: status,
          last_scan_count: discovered.length,
        })
        .eq('user_id', userId);
    } catch (err) {
      summary.errors.push(`Scan failed for ${userId}: ${err instanceof Error ? err.message : String(err)}`);
      await admin
        .from('gmail_connections')
        .update({
          last_scan_at: new Date().toISOString(),
          last_scan_status: 'error',
        })
        .eq('user_id', userId);
    }
  }

  return summary;
}