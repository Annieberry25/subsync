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
} from '@/lib/paystack';
import { markPlanSubscriptionFailed } from '@/lib/paystack/grants';

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