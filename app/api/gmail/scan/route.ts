import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/auth/access';
import { checkRateLimit } from '@/lib/rate-limit';
import { fetchActiveSubscriptionNames } from '@/lib/services/receipt-ingestion';
import {
  GmailTokenExpiredError,
  partitionNewDiscoveries,
  recordGmailScanFailure,
  scanGmailForSubscriptions,
} from '@/lib/services/gmail-service';

const RATE_LIMIT_WINDOW_SECONDS = 600;
const RATE_LIMIT_MAX_SCANS = 5;

/**
 * Runs a bounded receipt scan against the user's connected Gmail inbox and
 * returns de-duplicated subscription candidates for the review step of the
 * Gmail connect modal.
 *
 * Failures are reported in a form the client can act on: a dead Google grant
 * comes back as 401 `gmail_token_expired` (the only fix is a re-authorization),
 * distinct from the generic 500, so the UI can offer Reconnect instead of
 * showing the same "failed" message for every cause.
 */
export async function POST() {
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized user session.' }, { status: 401 });
    }
    userId = user.id;

    // Each scan reads a batch of messages from the Gmail API, so one account
    // is bounded well above normal use but far below what abuse needs.
    const allowed = await checkRateLimit(`user:gmail-scan:${user.id}`, {
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
      maxRequests: RATE_LIMIT_MAX_SCANS,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: 'You have scanned recently. Please wait a few minutes and try again.' },
        { status: 429 }
      );
    }

    const result = await scanGmailForSubscriptions(user.id);

    // A scan re-reads a year of mail, so only surface what the user does not
    // already track. `alreadyKnown` lets the UI say "nothing new" instead of
    // showing an empty list that looks like a failed scan.
    const admin = createAdminClient();
    const existingNames = await fetchActiveSubscriptionNames(admin, user.id);
    const { discovered, alreadyKnown } = partitionNewDiscoveries(result.discovered, existingNames);

    return NextResponse.json({ discovered, alreadyKnown, scannedAt: result.scannedAt });
  } catch (err) {
    if (err instanceof GmailTokenExpiredError) {
      // The service already recorded the dead grant on the row; nothing to add.
      console.warn('[gmail/scan] google grant expired, reconnect required');
      return NextResponse.json(
        {
          error: 'Your Gmail connection has expired. Reconnect Gmail to keep scanning.',
          code: 'gmail_token_expired',
        },
        { status: 401 }
      );
    }

    const message = err instanceof Error ? err.message : String(err);
    console.error('[gmail/scan] scan failed:', message);
    if (userId) await recordGmailScanFailure(userId);

    return NextResponse.json(
      { error: 'Gmail scan failed. Please try again.', code: 'gmail_scan_failed' },
      { status: 500 }
    );
  }
}