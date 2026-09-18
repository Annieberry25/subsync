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
  const nowIso = new Date().toISOString();
  const expiresAt = addUtcDays(new Date(), PLUS_PLAN.durationDays).toISOString();
  const tier = PLAN_TIER_BY_PLAN[plan] ?? 'plus';

  await admin
    .from('plan_subscriptions')
    .update({ status: 'paid', paid_at: paidAt ?? nowIso, expires_at: expiresAt })
    .eq('paystack_reference', reference);

  await admin
    .from('profiles')
    .update({ plan_tier: tier, plan_expires_at: expiresAt })
    .eq('id', userId);

  await admin.auth.admin.updateUserById(userId, {
    user_metadata: { plan_tier: tier, plan_expires_at: expiresAt },
  });
}

/** Grant access for a payment already linked to a plan_subscriptions row (webhook path). */
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

  if (error || !subscription) return false;

  await applyGrant(admin, subscription.user_id, subscription.plan, reference, paidAt);
  return true;
}

/** Mark a payment as failed/not-granted when verification does not check out. */
export async function markPlanSubscriptionFailed(reference: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from('plan_subscriptions')
    .update({ status: 'failed' })
    .eq('paystack_reference', reference);
}

/** Cancel a user's plan immediately (single-payment model: no billing-period grace). */
export async function downgradeUserToFree(userId: string): Promise<void> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  await admin
    .from('plan_subscriptions')
    .update({ status: 'cancelled', paid_at: nowIso })
    .eq('user_id', userId)
    .in('status', ['pending', 'paid']);

  await admin
    .from('profiles')
    .update({ plan_tier: 'free', plan_expires_at: null })
    .eq('id', userId);

  await admin.auth.admin.updateUserById(userId, {
    user_metadata: { plan_tier: 'free', plan_expires_at: null },
  });
}