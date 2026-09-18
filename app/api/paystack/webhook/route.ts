import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/paystack';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  grantPlanSubscription,
  markPlanSubscriptionFailed,
} from '@/lib/paystack/grants';

interface PaystackChargeSuccessEvent {
  event: string;
  data: {
    status?: string;
    reference?: string;
    amount?: number | string;
    currency?: string;
    paid_at?: string | null;
  };
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-paystack-signature');

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: PaystackChargeSuccessEvent;
  try {
    event = JSON.parse(rawBody) as PaystackChargeSuccessEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  if (event.event === 'charge.success') {
    const data = event.data ?? {};
    const reference = data.reference;

    // Validate against the pending row recorded at checkout (amount/currency
    // are dynamic: the $4.99 list price is converted to naira at the
    // then-current rate, so the stored row — not a constant — is the
    // source of truth).
    let expectedAmount: number | null = null;
    let expectedCurrency: string | null = null;
    if (reference) {
      const admin = createAdminClient();
      const { data: subscription } = await admin
        .from('plan_subscriptions')
        .select('amount, currency')
        .eq('paystack_reference', reference)
        .maybeSingle();
      expectedAmount = subscription?.amount ?? null;
      expectedCurrency = subscription?.currency ?? null;
    }

    const matchesPlan =
      Boolean(reference) &&
      expectedAmount !== null &&
      expectedCurrency !== null &&
      data.status === 'success' &&
      Number(data.amount) === expectedAmount &&
      String(data.currency ?? '').toUpperCase() === expectedCurrency.toUpperCase();

    if (reference && matchesPlan) {
      const granted = await grantPlanSubscription(reference, data.paid_at ?? null);
      if (!granted) {
        console.warn(
          '[paystack/webhook] charge.success for unknown reference, ignoring',
          reference
        );
      }
    } else {
      console.warn(
        '[paystack/webhook] charge.success payload did not match stored plan row',
        { reference, status: data.status, currency: data.currency, amount: data.amount }
      );
      if (reference) {
        await markPlanSubscriptionFailed(reference);
      }
    }
  }

  return NextResponse.json({ received: true });
}