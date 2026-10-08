import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/access';
import { schedulePlanCancellation } from '@/lib/paystack/grants';

export async function POST() {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized user session.' }, { status: 401 });
    }

    // Single-payment model: there is no Paystack subscription object to cancel,
    // and the payment is not refunded — so cancellation only retires the renewal
    // path and leaves the already-paid access in place until plan_expires_at.
    const { planTier, expiresAt } = await schedulePlanCancellation(user.id);

    if (planTier === 'free') {
      // Nothing left to ride out (no active plan, or no expiry recorded).
      return NextResponse.json({ planTier: 'free', expiresAt: null });
    }

    return NextResponse.json({ planTier: 'plus', expiresAt });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
    console.error('[paystack/cancel] unexpected error:', msg);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
