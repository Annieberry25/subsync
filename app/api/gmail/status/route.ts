import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/access';
import { getGmailStatus } from '@/lib/services/gmail-service';

/**
 * Client-facing connection status. Only returns safe display fields
 * (connected flag + email + last scan) — never tokens.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized user session.' }, { status: 401 });
    }

    const status = await getGmailStatus(user.id);
    return NextResponse.json(status);
  } catch (err) {
    console.error('[gmail/status] unexpected error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}