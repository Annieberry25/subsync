import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/access';
import { checkRateLimit } from '@/lib/rate-limit';
import { scanGmailForSubscriptions } from '@/lib/services/gmail-service';

const RATE_LIMIT_WINDOW_SECONDS = 600;
const RATE_LIMIT_MAX_SCANS = 5;

/**
 * Runs a bounded receipt scan against the user's connected Gmail inbox and
 * returns de-duplicated subscription candidates for the review step of the
 * Gmail connect modal.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized user session.' }, { status: 401 });
    }

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
    return NextResponse.json(result);
  } catch (err) {
    console.error('[gmail/scan] unexpected error:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Gmail scan failed. Please try again.' },
      { status: 500 }
    );
  }
}