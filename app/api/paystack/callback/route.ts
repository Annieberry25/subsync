import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  resolvePublicOrigin,
  verifyTransaction,
  isPaystackConfigured,
} from '@/lib/paystack';
import {
  grantPlanSubscription,
  markPlanSubscriptionFailed,
} from '@/lib/paystack/grants';

/**
 * Where the browser lands after Paystack finishes.
 *
 * Derived from the incoming request rather than a configured site URL: this is
 * the host Paystack already redirected to, so the user has cookies here and the
 * settings page they reach is the deployment that processed the payment.
 */
function redirectTo(request: NextRequest, status: string): NextResponse {
  return NextResponse.redirect(
    `${resolvePublicOrigin(request)}/settings?section=plan&billing=${status}`
  );
}

/**
 * Paystack redirects here once checkout completes. This is a server-to-server
 * verification against Paystack's own API, and every field is compared with the
 * row recorded at checkout — so, exactly like the webhook, it does not depend on
 * the browser still holding a session.
 *
 * It previously bailed to `billing=failed` whenever the session was missing or
 * stale. A customer who took longer than the session lifetime to pay (or who was
 * returned to a different host) was charged, told "payment was not completed",
 * and left on Free unless the separately-registered webhook happened to fire.
 */
export async function GET(request: NextRequest) {
  // Paystack sends the same value as both `reference` and `trxref`.
  const reference =
    request.nextUrl.searchParams.get('reference') ??
    request.nextUrl.searchParams.get('trxref') ??
    '';

  if (!reference) {
    console.warn('[paystack/callback] redirect carried no reference', {
      search: request.nextUrl.search,
    });
    return redirectTo(request, 'failed');
  }

  if (!isPaystackConfigured()) {
    console.error('[paystack/callback] PAYSTACK_SECRET_KEY is not configured');
    return redirectTo(request, 'error');
  }

  const admin = createAdminClient();
  const { data: subscription, error: rowError } = await admin
    .from('plan_subscriptions')
    .select('amount, currency, status, user_id')
    .eq('paystack_reference', reference)
    .maybeSingle();

  if (rowError) {
    console.error('[paystack/callback] could not read pending subscription', {
      reference,
      error: rowError.message,
    });
    return redirectTo(request, 'error');
  }

  if (!subscription) {
    // Nothing to settle against: the checkout was initialised elsewhere or the
    // row was never written. Log loudly — this is a payment we cannot account for.
    console.warn('[paystack/callback] no subscription row for reference', { reference });
    return redirectTo(request, 'error');
  }

  let tx;
  try {
    tx = await verifyTransaction(reference);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown Paystack error';
    console.error('[paystack/callback] verification failed:', msg, { reference });
    return redirectTo(request, 'error');
  }

  // amount/currency are dynamic: the $3.99 list price is converted to naira at
  // the then-current rate, so the row — not a constant — is the source of truth.
  const matchesPlan =
    tx.status === 'success' &&
    tx.reference === reference &&
    tx.currency.toUpperCase() === (subscription.currency ?? '').toUpperCase() &&
    tx.amount === subscription.amount;

  if (!matchesPlan) {
    console.warn('[paystack/callback] verified transaction does not match stored plan row', {
      reference,
      expected: { amount: subscription.amount, currency: subscription.currency },
      actual: { status: tx.status, amount: tx.amount, currency: tx.currency },
    });
    // Never demote a settled row (the webhook may already have granted it), and
    // leave anything still in flight alone so the webhook or a later reconcile
    // can pick it up once Paystack resolves it.
    if (subscription.status === 'pending' && (tx.status === 'failed' || tx.status === 'abandoned')) {
      await markPlanSubscriptionFailed(reference);
    }
    return redirectTo(request, tx.status === 'success' ? 'error' : 'failed');
  }

  // Idempotent: a repeated callback simply re-grants (same paid state).
  const granted = await grantPlanSubscription(reference, tx.paidAt);
  if (!granted) {
    console.error('[paystack/callback] payment verified but grant failed', { reference });
    return redirectTo(request, 'error');
  }

  return redirectTo(request, 'paid');
}
