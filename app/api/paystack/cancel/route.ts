import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/access';
import { downgradeUserToFree } from '@/lib/paystack/grants';

export async function POST() {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized user session.' }, { status: 401 });
    }

    // Single-payment model: there is no Paystack subscription object to disable.
    // Cancelling downgrades to Free immediately server-side.
    await downgradeUserToFree(user.id);

    return NextResponse.json({ planTier: 'free' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
    console.error('[paystack/cancel] unexpected error:', msg);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}