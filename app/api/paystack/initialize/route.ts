import { NextResponse } from 'next/server';
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
} from '@/lib/paystack';

export async function POST() {
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

    const reference = generateTransactionReference(user.id);

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

    let checkout: { authorization_url: string; access_code: string | null; reference: string };
    try {
      checkout = await initializeTransaction({
        email: user.email ?? '',
        amount: charge.amount,
        currency: charge.currency,
        reference,
        callbackUrl: `${getSiteUrl()}/api/paystack/callback`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown Paystack error';
      console.error('[paystack/initialize] failed to start checkout:', msg);
      return NextResponse.json(
        { error: 'Could not start secure checkout. Please try again.' },
        { status: 502 }
      );
    }

    if (!checkout.authorization_url) {
      return NextResponse.json(
        { error: 'Paystack did not return a checkout link. Please try again.' },
        { status: 502 }
      );
    }

    // Record the pending payment server-side. No client write policy exists for
    // this table; only these routes can create/update rows.
    const { error: insertError } = await admin.from('plan_subscriptions').insert({
      user_id: user.id,
      paystack_reference: reference,
      plan: PLUS_PLAN.tier,
      status: 'pending',
      amount: charge.amount,
      currency: charge.currency,
      access_code: checkout.access_code,
    });

    if (insertError) {
      console.error('[paystack/initialize] failed to record pending subscription:', insertError.message);
      return NextResponse.json(
        { error: 'Could not start secure checkout. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      authorizationUrl: checkout.authorization_url,
      reference: checkout.reference,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
    console.error('[paystack/initialize] unexpected error:', msg);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}