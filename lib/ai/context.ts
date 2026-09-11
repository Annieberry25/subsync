import type { Database } from '@/lib/types/database.types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row'];
type BillPaymentRow = Database['public']['Tables']['bill_payments']['Row'];

/**
 * Server-only helpers that build a compact, privacy-filtered snapshot of the
 * user's SubHalt data to feed the AI assistant. Only the fields needed to
 * answer spending / billing / renewal questions are included — no keys, tokens
 * or anything sensitive beyond financial summaries the user already sees.
 */

interface SubscriptionSummary {
  name: string;
  price: number;
  currency: string;
  billingCycle: SubscriptionRow['billing_cycle'];
  category: SubscriptionRow['category'];
  status: SubscriptionRow['status'];
  nextBillingDate: string;
  paymentMethod?: string | null;
  providerUrl?: string | null;
  notes?: string | null;
}

interface BillSummary {
  providerName: string;
  category: string;
  customCategory?: string | null;
  amount: number;
  currency: string;
  paymentDate: string;
  paymentFrequency?: BillPaymentRow['payment_frequency'];
  isRecurring: boolean;
  status: BillPaymentRow['status'];
  source: BillPaymentRow['source'];
  country?: string | null;
  region?: string | null;
  officialProviderUrl?: string | null;
  providerReference?: string | null;
  notes?: string | null;
}

export interface AiUserContext {
  hasData: boolean;
  profile: { displayName?: string | null; email?: string | null } | null;
  subscriptions: SubscriptionSummary[];
  bills: BillSummary[];
  summaryText: string;
}

const MAX_SUBSCRIPTION_NOTES = 140;
const MAX_BILL_NOTES = 120;

function summarizeSubscription(row: SubscriptionRow): SubscriptionSummary {
  return {
    name: row.name,
    price: Number(row.price),
    currency: row.currency || 'USD',
    billingCycle: row.billing_cycle,
    category: row.category,
    status: row.status,
    nextBillingDate: row.next_billing_date,
    paymentMethod: row.payment_method,
    providerUrl: row.provider_url,
    notes: row.notes ? row.notes.slice(0, MAX_SUBSCRIPTION_NOTES) : null,
  };
}

function summarizeBill(row: BillPaymentRow): BillSummary {
  return {
    providerName: row.provider_name,
    category: row.category,
    customCategory: row.custom_category,
    amount: Number(row.amount),
    currency: row.currency || 'NGN',
    paymentDate: row.payment_date,
    paymentFrequency: row.payment_frequency,
    isRecurring: Boolean(row.is_recurring),
    status: row.status,
    source: row.source,
    country: row.country,
    region: row.region,
    officialProviderUrl: row.official_provider_url,
    providerReference: row.provider_reference,
    notes: row.notes ? row.notes.slice(0, MAX_BILL_NOTES) : null,
  };
}

/** Renders the user snapshot as a readable block for a prompt. */
export function renderUserContext(ctx: Pick<AiUserContext, 'subscriptions' | 'bills'>): string {
  const lines: string[] = [];

  if (ctx.subscriptions.length === 0 && ctx.bills.length === 0) {
    return '';
  }

  lines.push(`Subscriptions (${ctx.subscriptions.length}):`);
  if (ctx.subscriptions.length === 0) {
    lines.push('  - none tracked');
  } else {
    for (const s of ctx.subscriptions) {
      lines.push(
        `  - ${s.name} | ${s.price} ${s.currency}/${s.billingCycle} | category: ${s.category} | status: ${s.status}` +
          ` | next billing: ${s.nextBillingDate}` +
          (s.paymentMethod ? ` | payment method: ${s.paymentMethod}` : '') +
          (s.providerUrl ? ` | manage url: ${s.providerUrl}` : '') +
          (s.notes ? ` | notes: ${s.notes}` : '')
      );
    }
  }

  lines.push('');
  lines.push(`Bills & payments (${ctx.bills.length} most recent):`);
  if (ctx.bills.length === 0) {
    lines.push('  - none tracked');
  } else {
    for (const b of ctx.bills) {
      lines.push(
        `  - ${b.providerName} | ${b.amount} ${b.currency} | ${b.category}${b.customCategory ? ` (${b.customCategory})` : ''}` +
          ` | date: ${b.paymentDate} | status: ${b.status}` +
          ` | recurring: ${b.isRecurring}${b.paymentFrequency ? ` (${b.paymentFrequency})` : ''}` +
          (b.country ? ` | country: ${b.country}` : '') +
          (b.region ? `, ${b.region}` : '') +
          (b.officialProviderUrl ? ` | pay url: ${b.officialProviderUrl}` : '') +
          (b.providerReference ? ` | reference: ${b.providerReference}` : '') +
          (b.notes ? ` | notes: ${b.notes}` : '')
      );
    }
  }

  return lines.join('\n');
}

/**
 * Builds the AI context from Supabase rows. Safe to call even when some
 * queries fail — missing sections simply come back empty.
 */
export function buildAiUserContext(params: {
  profile: ProfileRow | null;
  subscriptions: SubscriptionRow[];
  bills: BillPaymentRow[];
}): AiUserContext {
  const { profile, subscriptions, bills } = params;

  const subs = subscriptions.map(summarizeSubscription);
  const billList = bills.map(summarizeBill);

  const subscriptionsWithStatus = subs.filter((s) => s.status === 'active' || s.status === 'trial');
  const recurringBills = billList.filter((b) => b.isRecurring);

  let summaryText = '';
  if (subs.length > 0 || billList.length > 0) {
    const totalMonthlySubs = subs.reduce((acc, s) => {
      const monthly = s.billingCycle === 'yearly' ? Number(s.price) / 12 : s.billingCycle === 'weekly' ? Number(s.price) * 4.33 : s.billingCycle === 'quarterly' ? Number(s.price) / 3 : Number(s.price);
      return acc + (s.status === 'active' || s.status === 'trial' ? monthly : 0);
    }, 0);
    summaryText = [
      subscriptionsWithStatus.length > 0
        ? `${subscriptionsWithStatus.length} active subscription(s)`
        : 'no active subscriptions',
      `tracking ${billList.length} bill payment(s)`,
      recurringBills.length > 0 ? `${recurringBills.length} recurring bill(s)` : 'no recurring bills',
      totalMonthlySubs > 0 ? `approx. ${totalMonthlySubs.toFixed(2)}/mo committed in subscriptions` : '',
    ]
      .filter(Boolean)
      .join(' · ');
  }

  return {
    hasData: subs.length > 0 || billList.length > 0,
    profile: profile ? { displayName: profile.full_name, email: profile.email } : null,
    subscriptions: subs,
    bills: billList,
    summaryText,
  };
}