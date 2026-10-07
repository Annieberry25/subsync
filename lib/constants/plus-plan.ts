export const PLUS_PLAN = {
  name: 'SubHalt Plus',
  tier: 'plus',
  price: 3.99,
  amountCents: 399,
  currency: 'USD',
  interval: 'monthly',
  durationDays: 30,
} as const;

export const SUBHALT_SUBSCRIPTION_NAME = 'SubHalt';

export function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function toUtcDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface PlusSubscriptionRecordOptions {
  paidAt?: Date;
  expiresAt?: Date | string | null;
  paymentMethod?: string | null;
}

export function buildPlusSubscriptionRecord({
  paidAt,
  expiresAt,
  paymentMethod,
}: PlusSubscriptionRecordOptions) {
  const paid = paidAt && !Number.isNaN(paidAt.getTime()) ? paidAt : new Date();
  const parsedExpiry =
    expiresAt instanceof Date
      ? expiresAt
      : expiresAt
        ? new Date(expiresAt)
        : null;
  const expiry =
    parsedExpiry && !Number.isNaN(parsedExpiry.getTime())
      ? parsedExpiry
      : addUtcDays(paid, PLUS_PLAN.durationDays);

  return {
    name: SUBHALT_SUBSCRIPTION_NAME,
    price: PLUS_PLAN.price,
    currency: PLUS_PLAN.currency,
    billing_cycle: 'monthly' as const,
    category: 'Software' as const,
    status: 'active' as const,
    start_date: toUtcDateInput(paid),
    next_billing_date: toUtcDateInput(expiry),
    payment_method: paymentMethod || 'Card',
    provider_url: process.env.NEXT_PUBLIC_SITE_URL || 'https://subhalt.xyz',
    notes: `${PLUS_PLAN.name} (${PLUS_PLAN.interval})`,
  };
}
