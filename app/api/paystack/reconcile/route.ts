import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/auth/access';
import { verifyTransaction, isPaystackConfigured, transactionMatchesPlan } from '@/lib/paystack';
import { grantPlanSubscription } from '@/lib/paystack/grants';

/** How long a checkout stays worth settling; anything older is abandoned. */
const LOOKBACK_MS = 24 * 60 * 60 * 1000;

/**
 * POST /api/paystack/reconcile
 *
 * Self-heal for a completed Paystack payment that the normal settlement paths
 * missed. Two failures were previously unrecoverable:
 *
 *  - the callback never ran (tab closed, redirect blocked, request rate
 *    limited) and the webhook is not registered on the dashboard, so the row
 *    stayed `pending` forever while the customer had been charged;
 *  - a grant wrote `plan_subscriptions.status = 'paid'` but a later write to
 *    `profiles` / `user_metadata` failed, leaving the account on Free.
 *
 * Both are cheap to detect: read this user's recent rows, ask Paystack what
 * happened, and re-run the (idempotent) grant. A no-op costs one indexed read.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized user session.' }, { status: 401 });
    }

    if (!isPaystackConfigured()) {
      return NextResponse.json({ granted: false });
    }

    const admin = createAdminClient();
    const since = new Date(Date.now() - LOOKBACK_MS).toISOString();

    // `failed` is included on purpose: a webhook that could not reconcile its
    // own payload used to demote genuinely successful charges to `failed`, and
    // a row nobody re-read is exactly what this endpoint exists to recover.
    // Verification below is against Paystack itself, so a row that really did
    // fail verification stays failed.
    const { data: rows, error } = await admin
      .from('plan_subscriptions')
      .select('paystack_reference, status, amount, currency, paid_at, expires_at, created_at')
      .eq('user_id', user.id)
      .gte('created_at', since)
      .in('status', ['pending', 'paid', 'failed'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[paystack/reconcile] could not read subscriptions:', error.message);
      return NextResponse.json({ error: 'Could not check payments.' }, { status: 500 });
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ granted: false });
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('plan_tier, plan_expires_at')
      .eq('id', user.id)
      .maybeSingle();

    const activePlus =
      profile?.plan_tier === 'plus' &&
      (!profile?.plan_expires_at || new Date(profile.plan_expires_at) > new Date());

    // 1. Repair a settled row whose profile write never landed. Keyed off the
    //    row's own paid_at/expires_at, so re-granting cannot extend a plan the
    //    customer did not pay for.
    if (!activePlus) {
      const settled = rows.find(
        (row) => row.status === 'paid' && row.expires_at && new Date(row.expires_at) > new Date()
      );
      if (settled) {
        const granted = await grantPlanSubscription(settled.paystack_reference, settled.paid_at);
        if (granted) {
          console.info('[paystack/reconcile] repaired settled subscription', {
            reference: settled.paystack_reference,
          });
          return NextResponse.json({ granted: true });
        }
      }
    }

    // 2. Recover a charge Paystack may already have settled while the callback
    //    and webhook both missed it. Verification is against Paystack itself;
    //    the stored row decides whether it is *our* payment.
    if (!activePlus) {
      for (const row of rows) {
        // Settled rows are branch 1's business (repair only). `failed` rows are
        // re-checked because the demotion may itself have been the bug.
        if (row.status === 'paid') continue;

        let tx;
        try {
          tx = await verifyTransaction(row.paystack_reference);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn('[paystack/reconcile] verify failed', {
            reference: row.paystack_reference,
            message: msg,
          });
          continue;
        }

        const matchesPlan = transactionMatchesPlan(tx, {
          reference: row.paystack_reference,
          amount: row.amount,
          currency: row.currency ?? '',
        });

        if (!matchesPlan) continue;

        const granted = await grantPlanSubscription(row.paystack_reference, tx.paidAt);
        if (granted) {
          console.info('[paystack/reconcile] recovered ungranted payment', {
            reference: row.paystack_reference,
          });
          return NextResponse.json({ granted: true });
        }
      }
    }

    return NextResponse.json({ granted: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[paystack/reconcile] unexpected error:', msg);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
