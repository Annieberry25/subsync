'use client';

import { createSubscription, fetchSubscriptions } from '@/lib/services/subscription-service';
import { recordActivity } from '@/lib/services/activity-service';
import {
  PLUS_PLAN,
  SUBHALT_SUBSCRIPTION_NAME,
  buildPlusSubscriptionRecord,
} from '@/lib/constants/plus-plan';
import type { InboxItem } from '@/lib/contexts/inbox-context';

type AddInboxItem = (item: Omit<InboxItem, 'id' | 'date' | 'isRead'>) => void;

export interface PlusPurchaseOptions {
  addInboxItem: AddInboxItem;
  planExpiresAt?: string | null;
  paymentMethod?: string | null;
}

/**
 * Post-payment bookkeeping for a successful SubHalt Plus purchase.
 *
 * Runs on the client only AFTER Paystack has verified the charge (the new
 * /api/paystack/* routes own the authoritative grant). This helper keeps the
 * in-app record in sync:
 *  - creates the SubHalt subscription entry when the server did not already
 *  - records an activity event
 *  - adds an inbox notification
 */
export async function syncPlusPurchaseRecord({
  addInboxItem,
  planExpiresAt,
  paymentMethod,
}: PlusPurchaseOptions): Promise<void> {
  const { data: existing } = await fetchSubscriptions();
  const alreadyListed = (existing ?? []).some(
    (sub) => sub.name.toLowerCase().trim() === SUBHALT_SUBSCRIPTION_NAME.toLowerCase()
  );

  if (!alreadyListed) {
    const result = await createSubscription(
      buildPlusSubscriptionRecord({
        paidAt: new Date(),
        expiresAt: planExpiresAt,
        paymentMethod,
      })
    );
    if (result.error) throw result.error;
  }

  await recordActivity({
    subscriptionName: SUBHALT_SUBSCRIPTION_NAME,
    type: 'added',
    title: 'SubHalt Subscription Created',
    description: `SubHalt — $${PLUS_PLAN.price} — Paid`,
    amount: PLUS_PLAN.price,
    currency: PLUS_PLAN.currency,
  });

  addInboxItem({
    type: 'plan_update',
    title: `${PLUS_PLAN.name} Active`,
    description: `Your ${PLUS_PLAN.name} plan is now active for the next ${PLUS_PLAN.durationDays} days.`,
    actionType: 'view',
    actionLabel: 'View subscription',
    subscriptionName: SUBHALT_SUBSCRIPTION_NAME,
    subscriptionPrice: PLUS_PLAN.price,
    currency: PLUS_PLAN.currency,
  });
}

/**
 * Ask the server to settle a recent Paystack charge that never got granted —
 * a checkout whose callback never ran, or a grant that only half-applied.
 *
 * Returns true only when a grant actually changed something, so the caller can
 * refresh the session and pick the new plan up. Every failure mode is swallowed:
 * this is a background repair, and the normal callback/webhook paths stay
 * authoritative.
 */
export async function recoverPlusPurchase(): Promise<boolean> {
  try {
    const res = await fetch('/api/paystack/reconcile', { method: 'POST' });
    if (!res.ok) return false;
    const data = (await res.json().catch(() => null)) as { granted?: boolean } | null;
    return data?.granted === true;
  } catch {
    return false;
  }
}
