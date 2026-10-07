import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature, transactionMatchesPlan } from '@/lib/paystack';
import type { VerifiedTransaction } from '@/lib/paystack';
import { createAdminClient } from '@/lib/supabase/admin';
import { grantPlanSubscription } from '@/lib/paystack/grants';

interface PaystackChargeSuccessEvent {
  event: string;
  data: {
    status?: string;
    reference?: string;
    amount?: number | string;
    requested_amount?: number | string;
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
    // Any internal failure must surface as a 500: Paystack only retries events
    // that were not acknowledged, and a swallowed error here meant a payment
    // nobody ever saw again.
    try {
      const data = event.data ?? {};
      const reference = data.reference;

      if (!reference) {
        console.warn('[paystack/webhook] charge.success carried no reference');
        return NextResponse.json({ received: true });
      }

      const admin = createAdminClient();
      const { data: subscription } = await admin
        .from('plan_subscriptions')
        .select('amount, currency, status')
        .eq('paystack_reference', reference)
        .maybeSingle();

      // amount/currency are dynamic: the $3.99 list price is converted to naira
      // at the then-current rate, so the stored row — not a constant — is the
      // source of truth. The shared matcher accepts the charge-with-fee shape
      // (requested_amount vs amount) that Paystack reports for some charges.
      const tx: VerifiedTransaction = {
        status: data.status ?? '',
        reference,
        amount: Number(data.amount) || 0,
        requestedAmount:
          typeof data.requested_amount === 'number'
            ? data.requested_amount
            : Number(data.requested_amount) || null,
        currency: String(data.currency ?? '').toUpperCase(),
        customerEmail: null,
        paidAt: data.paid_at ?? null,
        channel: null,
      };

      const matchesPlan = transactionMatchesPlan(
        tx,
        subscription
          ? { reference, amount: subscription.amount, currency: subscription.currency ?? '' }
          : null
      );

      if (matchesPlan) {
        const granted = await grantPlanSubscription(reference, data.paid_at ?? null);
        if (!granted) {
          console.error('[paystack/webhook] charge.success verified but grant failed', reference);
          return NextResponse.json({ error: 'Grant failed' }, { status: 500 });
        }
        return NextResponse.json({ received: true });
      }

      // A charge.success event NEVER demotes a row. If it does not look like
      // ours, leave it pending for the reconcile pass, which re-verifies against
      // Paystack's verify payload — the payload that carries requested_amount
      // and can therefore settle a charge reported with the fee added on top.
      // Demoting here is what turned five successful charges into `failed` rows
      // that no settlement path would ever look at again.
      console.warn(
        '[paystack/webhook] charge.success did not match stored plan row; leaving it for reconcile',
        {
          reference,
          status: subscription?.status,
          expected: subscription
            ? { amount: subscription.amount, currency: subscription.currency }
            : null,
          actual: { amount: tx.amount, requestedAmount: tx.requestedAmount, currency: tx.currency },
        }
      );
      return NextResponse.json({ received: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[paystack/webhook] failed to process charge.success:', msg);
      return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}