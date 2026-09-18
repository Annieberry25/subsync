import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/auth/access';
import {
  getSiteUrl,
  verifyTransaction,
  isPaystackConfigured,
} from '@/lib/paystack';
import {
  grantPlanSubscription,
  markPlanSubscriptionFailed,
} from '@/lib/paystack/grants';

function redirectTo(status: string): NextResponse {
  return NextResponse.redirect(
    `${getSiteUrl()}/settings?section=plan&billing=${status}`
  );
}

export async function GET(request: NextRequest) {
  const reference = request.nextUrl.searchParams.get('reference') ?? '';
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  if (!user || !reference || !isPaystackConfigured()) {
    return redirectTo('failed');
  }

  let tx;
  try {
    tx = await verifyTransaction(reference);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown Paystack error';
    console.error('[paystack/callback] verification failed:', msg);
    return redirectTo('failed');
  }

  // Validate against the pending row recorded at checkout (amount/currency are
  // dynamic: the $4.99 list price is converted to naira at the then-current rate).
  const admin = createAdminClient();
  const { data: subscription } = await admin
    .from('plan_subscriptions')
    .select('amount, currency')
    .eq('paystack_reference', reference)
    .maybeSingle();

  const matchesPlan =
    subscription !== null &&
    tx.status === 'success' &&
    tx.reference === reference &&
    tx.currency.toUpperCase() === (subscription.currency ?? '').toUpperCase() &&
    tx.amount === subscription.amount;

  if (!matchesPlan) {
    console.warn(
      '[paystack/callback] verified transaction does not match stored plan row',
      { reference, status: tx.status, currency: tx.currency, amount: tx.amount }
    );
    await markPlanSubscriptionFailed(reference);
    return redirectTo('failed');
  }

  // Idempotent: a repeated callback simply re-grants (same paid state).
  await grantPlanSubscription(reference, tx.paidAt);

  return redirectTo('paid');
}