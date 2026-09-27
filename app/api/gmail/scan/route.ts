import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/access';
import { scanGmailForSubscriptions } from '@/lib/services/gmail-service';

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

    const result = await scanGmailForSubscriptions(user.id);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
    console.error('[gmail/scan] unexpected error:', msg);
    return NextResponse.json(
      { error: 'Gmail scan failed. Please try again.', detail: msg },
      { status: 500 }
    );
  }
}