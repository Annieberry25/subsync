/**
 * Server-side ingestion of discovered subscriptions (forwarded receipts and
 * background Gmail scans). Uses the service-role client so the webhook/cron
 * paths do not depend on any browser session.
 */
import { env } from '@/lib/env';
import { getPlanLimits, hasReachedSubscriptionCap } from '@/lib/constants/plan-limits';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/types/database.types';
import { getKnownProviderWebsite } from '@/lib/services/subscription-service';
import {
  buildReceiptDraft,
  mapBillingCycleToBillFrequency,
  normalizeSubscriptionName,
  type ReceiptDraft,
} from '@/lib/services/receipt-discovery';
import type { DiscoveredSubscription } from '@/lib/types/gmail.types';

type AdminClient = SupabaseClient<Database>;

export interface InboundReceiptInput {
  recipient: string;
  from: string;
  subject: string;
  text: string;
  html?: string;
  date?: string;
}

export interface IngestResult {
  status: 'created' | 'duplicate' | 'limit_reached' | 'invalid' | 'not_configured';
  subscriptionId?: string;
  inboxItemId?: string;
  name?: string;
  price?: number;
  currency?: string;
  error?: string;
}

function buildSubscriptionRow(
  userId: string,
  draft: ReceiptDraft,
  source: string
): Database['public']['Tables']['subscriptions']['Insert'] {
  const nextBilling = new Date();
  nextBilling.setMonth(nextBilling.getMonth() + 1);

  return {
    user_id: userId,
    name: draft.name,
    price: draft.price,
    currency: draft.currency || 'USD',
    billing_cycle: draft.billingCycle,
    category: draft.category,
    status: 'active',
    start_date: draft.date || new Date().toISOString(),
    next_billing_date: nextBilling.toISOString(),
    provider_url: getKnownProviderWebsite(draft.name),
    notes: `[${source}] ${draft.from} — ${draft.subject}`,
    is_synced: true,
  };
}

export async function getInboundEmailDomain(): Promise<string | null> {
  if (env.INBOUND_EMAIL_DOMAIN) return env.INBOUND_EMAIL_DOMAIN.toLowerCase();
  return null;
}

export async function getUserForwardingAddress(userId: string): Promise<string | null> {
  const domain = await getInboundEmailDomain();
  if (!domain) return null;
  return `receipts+${userId}@${domain}`;
}

export function parseRecipientUserId(recipient: string): string | null {
  const raw = recipient || '';
  const emailMatch = raw.match(/<([^>]+)>/) ?? raw.match(/[^\s,;]+@[^\s,;]+/);
  if (!emailMatch) return null;
  const email = emailMatch[1].toLowerCase();
  const tagMatch = email.match(/^receipts\+([0-9a-f-]{36})@/);
  return tagMatch ? tagMatch[1] : null;
}

async function fetchProfileForUserId(
  admin: AdminClient,
  userId: string
): Promise<{ plan_tier: string | null; is_admin: boolean; plan_expires_at: string | null } | null> {
  const { data, error } = await admin
    .from('profiles')
    .select('plan_tier, plan_expires_at, is_admin')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    plan_tier: data.plan_tier,
    is_admin: data.is_admin === true,
    plan_expires_at: data.plan_expires_at,
  };
}

/**
 * Admins count as Plus regardless of `plan_tier`.
 *
 * The receipt paths enforce the cap server-side, so resolving admin here matters:
 * without it, an operator account scanning receipts hits the free limit while the
 * client UI — which resolves admin — says the features are unlocked.
 */
export async function isPlusUser(admin: AdminClient, userId: string): Promise<boolean> {
  const profile = await fetchProfileForUserId(admin, userId);
  if (!profile) return false;
  if (profile.is_admin) return true;
  if (profile.plan_tier !== 'plus' && profile.plan_tier !== 'premium') return false;
  if (!profile.plan_expires_at) return true;
  return new Date(profile.plan_expires_at).getTime() > Date.now();
}

export async function fetchActiveSubscriptionNames(admin: AdminClient, userId: string): Promise<string[]> {
  const { data } = await admin
    .from('subscriptions')
    .select('name')
    .eq('user_id', userId)
    .not('status', 'eq', 'canceled')
    .limit(500);
  if (!data) return [];
  return data.map((s) => normalizeSubscriptionName(s.name));
}

async function findExistingByName(
  admin: AdminClient,
  userId: string,
  name: string
): Promise<boolean> {
  const names = await fetchActiveSubscriptionNames(admin, userId);
  return names.includes(normalizeSubscriptionName(name));
}

export async function ingestReceiptDraft(
  admin: AdminClient,
  userId: string,
  draft: ReceiptDraft,
  source: string
): Promise<IngestResult> {
  const trimmedName = (draft.name || '').trim();
  if (!trimmedName || draft.price == null || draft.price <= 0) {
    return { status: 'invalid', error: 'Could not determine provider or amount from the receipt.' };
  }

  if (await findExistingByName(admin, userId, trimmedName)) {
    return { status: 'duplicate', name: trimmedName, price: draft.price, currency: draft.currency };
  }

  const plus = await isPlusUser(admin, userId);
  const tier = plus ? 'plus' : 'free';
  const { count } = await admin
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('status', 'eq', 'canceled');
  if (hasReachedSubscriptionCap({ tier, activeCount: typeof count === 'number' ? count : 0 })) {
    const limit = getPlanLimits(tier).maxSubscriptions;
    return {
      status: 'limit_reached',
      name: trimmedName,
      price: draft.price,
      currency: draft.currency,
      error: `Upgrade to Plus to track more than ${limit} subscriptions.`,
    };
  }

  const { data: sub, error } = await admin
    .from('subscriptions')
    .insert(buildSubscriptionRow(userId, draft, source))
    .select()
    .single();

  if (error || !sub) {
    return { status: 'invalid', error: error?.message ?? 'Failed to create subscription.' };
  }

  const { data: item, error: inboxError } = await admin
    .from('inbox_items')
    .insert({
      user_id: userId,
      type: 'plan_update',
      title: `${trimmedName} added`,
      description: `A new subscription with ${sub.name} for ${sub.price} ${sub.currency} was detected from your email forwarding.`,
      date: new Date().toISOString(),
      is_read: false,
      is_favourited: false,
      is_urgent: true,
      action_type: null,
      action_label: null,
      subscription_name: sub.name,
      subscription_price: sub.price,
      currency: sub.currency,
      provider_url: sub.provider_url,
      metadata: {
        source,
        created_from: 'email_forwarding',
      } as Json,
    })
    .select()
    .single();

  if (inboxError) {
    return { status: 'invalid', error: `Subscription created but inbox item failed: ${inboxError.message}` };
  }

  return {
    status: 'created',
    subscriptionId: sub.id,
    inboxItemId: item.id,
    name: sub.name,
    price: sub.price,
    currency: sub.currency,
  };
}

export async function ingestDiscoveredGmailSubscriptions(
  admin: AdminClient,
  userId: string,
  discovered: DiscoveredSubscription[]
): Promise<{ created: number; duplicates: number; limitReached: number; invalid: number }> {
  const counts = { created: 0, duplicates: 0, limitReached: 0, invalid: 0 };
  for (const item of discovered) {
    const draft: ReceiptDraft = buildReceiptDraft({
      providerName: item.providerName,
      amount: item.amount,
      currency: item.currency,
      category: item.category,
      paymentFrequency: mapBillingCycleToBillFrequency(item.billingCycle),
      from: item.from,
      subject: item.subject,
      paymentDate: item.date,
    });
    const result = await ingestReceiptDraft(admin, userId, draft, 'Gmail Monitoring');
    if (result.status === 'created') counts.created += 1;
    else if (result.status === 'duplicate') counts.duplicates += 1;
    else if (result.status === 'limit_reached') counts.limitReached += 1;
    else counts.invalid += 1;
  }
  return counts;
}