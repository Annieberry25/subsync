import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/auth/access';
import {
  PLUS_PLAN,
  generateTransactionReference,
  getPlanCharge,
  getSiteUrl,
  initializeTransaction,
  isPaystackConfigured,
  resolvePublicOrigin,
  transactionMatchesPlan,
  verifyTransaction,
} from '@/lib/paystack';
import { grantPlanSubscription, markPlanSubscriptionFailed } from '@/lib/paystack/grants';

/** How far back a `pending` row is still worth settling before it is stale. */
const PENDING_LOOKBACK_MS = 30 * 60 * 1000;

/** How long a `pending` row is assumed to be a checkout the customer is still inside. */
const IN_FLIGHT_MS = 5 * 60 * 1000;

const IN_FLIGHT_ERROR =
  'We are still confirming your previous payment. Please try again in a moment.';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized user session.' }, { status: 401 });
    }

    if (!isPaystackConfigured()) {
      return NextResponse.json(
        { error: 'Payments are not configured yet. Please try again later.', configured: false },
        { status: 503 }
      );
    }

    const admin = createAdminClient();

    // Idempotency guard: already on an active paid plan -> no new checkout.
    const { data: profile } = await admin
      .from('profiles')
      .select('plan_tier, plan_expires_at')
      .eq('id', user.id)
      .maybeSingle();

    if (
      profile?.plan_tier === 'plus' &&
      profile.plan_expires_at &&
      new Date(profile.plan_expires_at) > new Date()
    ) {
      return NextResponse.json({ alreadyActive: true, expiresAt: profile.plan_expires_at });
    }

    // The profile can lag behind the payments it was paid for: a grant whose
    // profiles write never landed, or a cancelled plan that still has its paid
    // period to ride out. The rows are therefore checked directly, so a
    // customer who already paid for this month cannot pay for it twice.
    const { data: paidRow } = await admin
      .from('plan_subscriptions')
      .select('expires_at')
      .eq('user_id', user.id)
      .in('status', ['paid', 'cancelled'])
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .maybeSingle();

    if (paidRow?.expires_at) {
      return NextResponse.json({ alreadyActive: true, expiresAt: paidRow.expires_at });
    }

    // A checkout from the last half hour is either still being paid or was
    // abandoned without ever reaching the callback. Settle it before starting
    // another one: a completed charge is granted here (and then blocks), an
    // abandoned one is retired so it stops counting, and one Paystack has not
    // resolved yet stops this request outright — two concurrent checkouts are
    // how the same month could be paid for more than once.
    const { data: recentPending } = await admin
      .from('plan_subscriptions')
      .select('paystack_reference, amount, currency, created_at')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .gte('created_at', new Date(Date.now() - PENDING_LOOKBACK_MS).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentPending) {
      try {
        const tx = await verifyTransaction(recentPending.paystack_reference);

        if (
          transactionMatchesPlan(tx, {
            reference: recentPending.paystack_reference,
            amount: recentPending.amount,
            currency: recentPending.currency ?? '',
          })
        ) {
          // The previous checkout was paid; grant it and refuse the new one.
          const granted = await grantPlanSubscription(
            recentPending.paystack_reference,
            tx.paidAt
          );
          if (!granted) {
            console.error('[paystack/initialize] could not grant settled checkout', {
              reference: recentPending.paystack_reference,
            });
            return NextResponse.json(
              { error: 'Could not confirm your previous payment. Please try again shortly.' },
              { status: 502 }
            );
          }
          return NextResponse.json({ alreadyActive: true });
        }

        if (tx.status === 'failed' || tx.status === 'abandoned') {
          await markPlanSubscriptionFailed(recentPending.paystack_reference);
        } else if (tx.status === 'pending') {
          return NextResponse.json(
            { pendingConfirmation: true, error: IN_FLIGHT_ERROR },
            { status: 409 }
          );
        }
        // Any other outcome (a success that does not match the row) is left for
        // reconcile, which re-verifies against Paystack — checkout proceeds so
        // the customer is never locked out by a row nothing here can settle.
      } catch (err) {
        console.error('[paystack/initialize] could not settle recent checkout', {
          reference: recentPending.paystack_reference,
          message: err instanceof Error ? err.message : String(err),
        });

        const ageMs = Date.now() - new Date(recentPending.created_at).getTime();
        if (ageMs < IN_FLIGHT_MS) {
          // Too recent to be abandoned: the customer may be paying right now,
          // and starting a second checkout here is exactly what must not happen.
          return NextResponse.json(
            { pendingConfirmation: true, error: IN_FLIGHT_ERROR },
            { status: 409 }
          );
        }
        // Unverifiable and stale. Retire it (reconcile re-checks failed rows for
        // 24h, so a payment that really did land is still recoverable).
        await markPlanSubscriptionFailed(recentPending.paystack_reference);
      }
    }

    let charge;
    try {
      charge = await getPlanCharge();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not compute plan charge';
      console.error('[paystack/initialize] getPlanCharge failed:', msg);
      return NextResponse.json(
        { error: 'Could not start secure checkout. Please try again.' },
        { status: 502 }
      );
    }

    let reference = generateTransactionReference(user.id);

    // Record the pending payment BEFORE any checkout exists. Both the callback
    // and the webhook settle against this row, so a charge raised without one
    // can never be granted — the previous order (initialize, then insert) meant
    // a failed insert produced a payable link that went nowhere.
    const { error: insertError } = await admin.from('plan_subscriptions').insert({
      user_id: user.id,
      paystack_reference: reference,
      plan: PLUS_PLAN.tier,
      status: 'pending',
      amount: charge.amount,
      currency: charge.currency,
      access_code: null,
    });

    if (insertError) {
      console.error('[paystack/initialize] failed to record pending subscription:', insertError.message);
      return NextResponse.json(
        { error: 'Could not start secure checkout. Please try again.' },
        { status: 500 }
      );
    }

    // The callback URL must return the user to the deployment that started the
    // checkout: session cookies are host-scoped, so a hardcoded apex domain
    // would drop the session on previews and local runs.
    const origin = resolvePublicOrigin(request);
    const callbackOrigin = origin.startsWith('https://') ? origin : getSiteUrl();

    let checkout: { authorization_url: string; access_code: string | null; reference: string };
    try {
      checkout = await initializeTransaction({
        email: user.email ?? '',
        amount: charge.amount,
        currency: charge.currency,
        reference,
        callbackUrl: `${callbackOrigin}/api/paystack/callback`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown Paystack error';
      console.error('[paystack/initialize] failed to start checkout:', msg);
      await markPlanSubscriptionFailed(reference);
      return NextResponse.json(
        { error: 'Could not start secure checkout. Please try again.' },
        { status: 502 }
      );
    }

    if (!checkout.authorization_url) {
      await markPlanSubscriptionFailed(reference);
      return NextResponse.json(
        { error: 'Paystack did not return a checkout link. Please try again.' },
        { status: 502 }
      );
    }

    // Paystack may echo a different reference than the one sent (it enforces
    // its own character set). Whatever it echoes is what the callback and
    // webhook will report, so the row has to follow it or the payment would
    // come back to a reference nobody can find. The access code lands in the
    // same write — it is surfaced in the admin payment list.
    const referenceChanged = Boolean(checkout.reference) && checkout.reference !== reference;
    const { error: finalizeError } = await admin
      .from('plan_subscriptions')
      .update({
        access_code: checkout.access_code,
        ...(referenceChanged ? { paystack_reference: checkout.reference } : {}),
      })
      .eq('paystack_reference', reference);

    if (finalizeError) {
      console.error('[paystack/initialize] failed to finalise pending subscription:', finalizeError.message);
      await markPlanSubscriptionFailed(reference);
      return NextResponse.json(
        { error: 'Could not start secure checkout. Please try again.' },
        { status: 500 }
      );
    }

    if (referenceChanged) {
      reference = checkout.reference;
    }

    return NextResponse.json({
      authorizationUrl: checkout.authorization_url,
      reference,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
    console.error('[paystack/initialize] unexpected error:', msg);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}