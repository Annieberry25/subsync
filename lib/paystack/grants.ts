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
import {
  PLUS_PLAN,
  SUBHALT_SUBSCRIPTION_NAME,
  addUtcDays,
  buildPlusSubscriptionRecord,
} from '@/lib/constants/plus-plan';

const PLAN_TIER_BY_PLAN: Record<string, 'free' | 'plus' | 'premium'> = {
  plus: 'plus',
  premium: 'premium',
};

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

  const listRecord = buildPlusSubscriptionRecord({ paidAt: paidDate, expiresAt });
  const { data: listed, error: listLookupError } = await admin
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('name', SUBHALT_SUBSCRIPTION_NAME)
    .limit(1)
    .maybeSingle();
  if (listLookupError) {
    throw new Error(`subscriptions lookup failed: ${listLookupError.message}`);
  }

  if (listed) {
    const { error: listUpdateError } = await admin
      .from('subscriptions')
      .update({ ...listRecord, updated_at: new Date().toISOString() })
      .eq('id', listed.id);
    if (listUpdateError) {
      throw new Error(`subscriptions update failed: ${listUpdateError.message}`);
    }
  } else {
    const { error: listInsertError } = await admin
      .from('subscriptions')
      .insert({ ...listRecord, user_id: userId });
    if (listInsertError) {
      throw new Error(`subscriptions insert failed: ${listInsertError.message}`);
    }
  }

  // Confirmation notice, written here rather than by the client so it still
  // lands when the browser is gone and the webhook (or a later reconcile) is
  // what confirmed the payment. Keyed off the reference: applyGrant is
  // re-runnable by design, and a repaired grant must not post a second copy.
  try {
    const activeTitle = `${PLUS_PLAN.name} Active`;
    const { data: existingNotice, error: noticeLookupError } = await admin
      .from('inbox_items')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'plan_update')
      .eq('title', activeTitle)
      .contains('metadata', { reference })
      .limit(1)
      .maybeSingle();
    if (noticeLookupError) {
      throw new Error(noticeLookupError.message);
    }
    if (!existingNotice) {
      const { error: noticeError } = await admin.from('inbox_items').insert({
        user_id: userId,
        type: 'plan_update',
        title: activeTitle,
        description: `Your ${PLUS_PLAN.name} plan is now active for the next ${PLUS_PLAN.durationDays} days.`,
        action_type: 'view',
        action_label: 'View subscription',
        subscription_name: SUBHALT_SUBSCRIPTION_NAME,
        metadata: { reference },
      });
      if (noticeError) {
        throw new Error(noticeError.message);
      }
    }
  } catch (err) {
    // Best-effort: the grant itself has already landed, so a rejected notice
    // must never turn a confirmed payment into a reported failure.
    console.error('[paystack/grants] could not record activation notice', {
      reference,
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
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

/** Demote a user to Free immediately (admin revocation, or a legacy plan with no billing period to ride out). */
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

/**
 * Cancel a plan at the end of its billing period instead of immediately.
 *
 * The cancel copy promises full access until the period ends, so profiles and
 * auth metadata are left untouched — only the payment rows are retired. Access
 * then ends on its own: the UI resolves an expired plan_expires_at to Free, and
 * the checkout route already refuses a new payment while plan_tier is plus
 * *and* plan_expires_at is in the future, so a cancelled plan cannot be bought
 * again until the paid period is actually over.
 *
 * A plus plan with no recorded expiry has no period to ride out, so it falls
 * back to the immediate downgrade. Throws when the profile cannot be read or
 * the payment rows cannot be updated, so the caller never reports a
 * cancellation the server did not perform.
 */
export async function schedulePlanCancellation(userId: string): Promise<{
  planTier: 'free' | 'plus';
  expiresAt: string | null;
}> {
  const admin = createAdminClient();

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('plan_tier, plan_expires_at')
    .eq('id', userId)
    .maybeSingle();
  if (profileError) {
    throw new Error(`profiles read failed: ${profileError.message}`);
  }
  if (!profile?.plan_tier || profile.plan_tier === 'free') {
    return { planTier: 'free', expiresAt: null };
  }

  const expiresAt = profile.plan_expires_at;
  const active = !expiresAt || new Date(expiresAt).getTime() > Date.now();
  if (!active) {
    // The period already passed: there is nothing left to cancel and the
    // account has already resolved to Free.
    return { planTier: 'free', expiresAt: null };
  }

  if (!expiresAt) {
    await downgradeUserToFree(userId);
    return { planTier: 'free', expiresAt: null };
  }

  const { error: subscriptionError } = await admin
    .from('plan_subscriptions')
    .update({ status: 'cancelled' })
    .eq('user_id', userId)
    .in('status', ['pending', 'paid']);
  if (subscriptionError) {
    throw new Error(`plan_subscriptions update failed: ${subscriptionError.message}`);
  }

  return { planTier: 'plus', expiresAt };
}