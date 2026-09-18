/**
 * Paystack (server-only) payment client.
 *
 * This module reads server-only env vars (PAYSTACK_SECRET_KEY) and uses Node
 * crypto. Do not import it into client components. Degrades gracefully when
 * PAYSTACK_SECRET_KEY is not configured (isPaystackConfigured() === false).
 *
 * Model: single-payment per month. Each Plus checkout creates one
 * plan_subscriptions row (pending) which flips to paid, and profiles.plan_tier
 * is server-authoritative. No Paystack Plans/subscriptions API / auto-renewal.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';
import { convertAmount, fetchExchangeRates } from '@/lib/services/currency-service';

export const PLUS_PLAN = {
  name: 'SubHalt Plus',
  tier: 'plus',
  price: 4.99,
  amountCents: 499,
  currency: 'USD',
  interval: 'monthly',
  durationDays: 30,
} as const;

/** Currency charged at checkout (Paystack charges in the merchant's local currency). */
export const PLAN_CHARGE_CURRENCY = 'NGN';

export interface PlanCharge {
  /** Smallest-units amount charged by Paystack (kobo for NGN). */
  amount: number;
  currency: string;
  /** USD price this charge is derived from, so verification + display stay in sync. */
  usdAmount: number;
  usdCurrency: string;
}

/**
 * Convert the USD list price to a naira charge using the latest USD→NGN rate,
 * falling back to the bundled rate when the API is unreachable. Charging a
 * hardcoded naira amount would drift from the displayed $4.99, and USD is not
 * accepted on all Paystack merchant accounts, so we convert server-side.
 */
export async function getPlanCharge(): Promise<PlanCharge> {
  const rates = await fetchExchangeRates();
  const naira = convertAmount(PLUS_PLAN.price, PLUS_PLAN.currency, PLAN_CHARGE_CURRENCY, rates);
  return {
    amount: Math.round(naira * 100),
    currency: PLAN_CHARGE_CURRENCY,
    usdAmount: PLUS_PLAN.price,
    usdCurrency: PLUS_PLAN.currency,
  };
}

const PAYSTACK_API = 'https://api.paystack.co';

export function getSiteUrl(): string {
  return env.NEXT_PUBLIC_SITE_URL || 'https://subhalt.com';
}

export function isPaystackConfigured(): boolean {
  return Boolean(env.PAYSTACK_SECRET_KEY);
}

export function generateTransactionReference(userId: string): string {
  const userIdFragment = userId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 12);
  const entropy = randomBytes(6).toString('hex').toUpperCase();
  return `SUBHALT_${userIdFragment}_${Date.now()}_${entropy}`;
}

export interface InitializeTransactionParams {
  email: string;
  amount: number;
  currency: string;
  reference: string;
  callbackUrl: string;
}

export interface InitializeTransactionResult {
  authorization_url: string;
  access_code: string | null;
  reference: string;
}

interface PaystackResponseBody {
  status?: boolean;
  message?: string;
  data?: Record<string, unknown>;
}

async function paystackRequest(
  path: string,
  init: RequestInit = {}
): Promise<PaystackResponseBody> {
  const response = await fetch(`${PAYSTACK_API}${path}`, init);
  const body = (await response.json().catch(() => null)) as PaystackResponseBody | null;

  if (!response.ok || body === null || body.status === false) {
    const message =
      body?.message ||
      `Paystack request failed with status ${response.status}`;
    throw new Error(message);
  }

  return body;
}

export async function initializeTransaction(
  params: InitializeTransactionParams
): Promise<InitializeTransactionResult> {
  const body = await paystackRequest('/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: params.email,
      amount: params.amount,
      currency: params.currency,
      reference: params.reference,
      callback_url: params.callbackUrl,
    }),
  });

  const data = body.data ?? {};
  return {
    authorization_url:
      typeof data.authorization_url === 'string' ? data.authorization_url : '',
    access_code: typeof data.access_code === 'string' ? data.access_code : null,
    reference: typeof data.reference === 'string' ? data.reference : params.reference,
  };
}

export interface VerifiedTransaction {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  customerEmail: string | null;
  paidAt: string | null;
  channel: string | null;
}

export async function verifyTransaction(reference: string): Promise<VerifiedTransaction> {
  const body = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);

  const data = body.data ?? {};
  const customer = data.customer as Record<string, unknown> | undefined;

  return {
    status: typeof data.status === 'string' ? data.status : '',
    reference: typeof data.reference === 'string' ? data.reference : reference,
    amount: typeof data.amount === 'number' ? data.amount : Number(data.amount) || 0,
    currency: String(data.currency ?? '').toUpperCase(),
    customerEmail: typeof customer?.email === 'string' ? customer.email : null,
    paidAt: typeof data.paid_at === 'string' ? data.paid_at : null,
    channel: typeof data.channel === 'string' ? data.channel : null,
  };
}

export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature || !isPaystackConfigured()) return false;

  const secret = env.PAYSTACK_SECRET_KEY as string;
  const expected = Buffer.from(
    createHmac('sha512', secret).update(rawBody, 'utf8').digest('hex'),
    'utf8'
  );
  const received = Buffer.from(signature, 'utf8');

  return expected.length === received.length && timingSafeEqual(expected, received);
}