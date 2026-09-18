'use client';

import { createSubscription } from '@/lib/services/subscription-service';
import { recordActivity } from '@/lib/services/activity-service';
import type { InboxItem } from '@/lib/contexts/inbox-context';

type AddInboxItem = (item: Omit<InboxItem, 'id' | 'date' | 'isRead'>) => void;

export interface PlusPurchaseOptions {
  addInboxItem: AddInboxItem;
}

/**
 * Post-payment bookkeeping for a successful SubHalt Plus purchase.
 *
 * Runs on the client only AFTER Paystack has verified the charge (the new
 * /api/paystack/* routes own the authoritative grant). This helper keeps the
 * in-app record in sync:
 *  - creates the SubHalt subscription entry
 *  - records an activity event
 *  - adds an inbox notification
 */
export async function syncPlusPurchaseRecord({ addInboxItem }: PlusPurchaseOptions): Promise<void> {
  const nextBilling = new Date();
  nextBilling.setUTCDate(nextBilling.getUTCDate() + 30);

  await createSubscription({
    name: 'SubHalt',
    price: 4.99,
    currency: 'USD',
    billing_cycle: 'monthly',
    category: 'Software',
    next_billing_date: nextBilling.toISOString().split('T')[0],
    start_date: new Date().toISOString().split('T')[0],
    status: 'active',
    payment_method: 'Card',
    provider_url: process.env.NEXT_PUBLIC_SITE_URL || 'https://subhalt.com',
    notes: 'SubHalt Plus — single monthly payment secured via Paystack.',
  });

  await recordActivity({
    subscriptionName: 'SubHalt',
    type: 'added',
    title: 'SubHalt Subscription Created',
    description: 'SubHalt — $4.99 — Paid',
    amount: 4.99,
    currency: 'USD',
  });

  addInboxItem({
    type: 'plan_update',
    title: 'SubHalt Plus Active',
    description: 'Your SubHalt Plus plan is now active for the next 30 days.',
    actionType: 'view',
    actionLabel: 'View subscription',
    subscriptionName: 'SubHalt',
    subscriptionPrice: 4.99,
    currency: 'USD',
  });
}