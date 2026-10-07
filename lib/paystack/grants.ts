/**
 * Server-only grant/cancel helpers for Paystack plan purchases.
 *
 * Shared by the callback and webhook routes so the grant path can never
 * diverge. Uses the service-role (admin) client because plan_subscriptions
 * has no client write policies by design — only the server may flip a
 * subscription to paid or change profiles.plan_tier.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database.types';
import { createAdminClient } from '@/lib/supabase/admin';
import { PLUS_PLAN } from '@/lib/paystack/index';

const PLAN_TIER_BY_PLAN: Record<string, 'free' | 'plus' | 'premium'> = {
  plus: 'plus',
  premium: 'premium',
};

function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

async function applyGrant(
  admin: SupabaseClient<Database>,
  userId: string,
  plan: string,
  reference: string,
  paidAt: string | null
): Promise<void> {
  // Key the 30-day window off the payment itself, not off "now": a grant that
  // runs late (reconcile after a missed callback) must not silently extend a
  // plan the customer already paid for, and a repair of an existing grant must
  // land on the same expiry instead of pushing it further out.
  const parsedPaidAt = paidAt ? new Date(paidAt) : null;
  const paidDate =
    parsedPaidAt && !Number.isNaN(parsedPaidAt.getTime()) ? parsedPaidAt : new Date();
  const expiresAt = addUtcDays(paidDate, PLUS_PLAN.durationDays).toISOString();
  const tier = PLAN_TIER_BY_PLAN[plan] ?? 'plus';

  // Every write is checked. These previously ran unawaited-for-errors, so a
  // rejected profiles or auth update left plan_subscriptions saying "paid"
  // while the account stayed on Free — the payment looked like it vanished.
  const { error: subscriptionError } = await admin
    .from('plan_subscriptions')
    .update({ status: 'paid', paid_at: paidDate.toISOString(), expires_at: expiresAt })
    .eq('paystack_reference', reference);
  if (subscriptionError) {
    throw new Error(`plan_subscriptions update failed: ${subscriptionError.message}`);
  }

  const { error: profileError } = await admin
    .from('profiles')
    .update({ plan_tier: tier, plan_expires_at: expiresAt })
    .eq('id', userId);
  if (profileError) {
    throw new Error(`profiles update failed: ${profileError.message}`);
  }

  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: { plan_tier: tier, plan_expires_at: expiresAt },
  });
  if (authError) {
    throw new Error(`user metadata update failed: ${authError.message}`);
  }
}

/**
 * Grant access for a payment already linked to a plan_subscriptions row.
 *
 * Idempotent: re-running it re-applies the same grant, which is how a partial
 * failure (row paid, profile not) repairs itself on the next attempt. Returns
 * false only when the row is unknown or a write failed — both are logged by
 * the caller's context and must never be mistaken for success.
 */
export async function grantPlanSubscription(
  reference: string,
  paidAt: string | null
): Promise<boolean> {
  const admin = createAdminClient();
  const { data: subscription, error } = await admin
    .from('plan_subscriptions')
    .select('user_id, plan')
    .eq('paystack_reference', reference)
    .maybeSingle();

  if (error || !subscription) {
    console.warn('[paystack/grants] cannot grant unknown reference', {
      reference,
      error: error?.message,
    });
    return false;
  }

  try {
    await applyGrant(admin, subscription.user_id, subscription.plan, reference, paidAt);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[paystack/grants] grant failed', { reference, userId: subscription.user_id, message: msg });
    return false;
  }
}

/**
 * Mark a payment as failed/not-granted when verification does not check out.
 *
 * Only rows still `pending` are touched: a settled row must never be demoted
 * by a later, differently-shaped event (a webhook that omits a field would
 * otherwise flip an already-granted subscription back to failed while the
 * customer keeps the plan).
 */
export async function markPlanSubscriptionFailed(reference: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('plan_subscriptions')
    .update({ status: 'failed' })
    .eq('paystack_reference', reference)
    .eq('status', 'pending');
  if (error) {
    console.error('[paystack/grants] could not mark reference failed', {
      reference,
      error: error.message,
    });
  }
}

/** Cancel a user's plan immediately (single-payment model: no billing-period grace). */
export async function downgradeUserToFree(userId: string): Promise<void> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { error: subscriptionError } = await admin
    .from('plan_subscriptions')
    .update({ status: 'cancelled', paid_at: nowIso })
    .eq('user_id', userId)
    .in('status', ['pending', 'paid']);
  if (subscriptionError) {
    console.error('[paystack/grants] cancel could not update subscriptions', {
      userId,
      error: subscriptionError.message,
    });
  }

  const { error: profileError } = await admin
    .from('profiles')
    .update({ plan_tier: 'free', plan_expires_at: null })
    .eq('id', userId);
  if (profileError) {
    console.error('[paystack/grants] cancel could not update profile', {
      userId,
      error: profileError.message,
    });
  }

  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: { plan_tier: 'free', plan_expires_at: null },
  });
  if (authError) {
    console.error('[paystack/grants] cancel could not update user metadata', {
      userId,
      error: authError.message,
    });
  }
}