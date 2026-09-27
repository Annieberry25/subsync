/**
 * Inbound email webhook transport: payload extraction, provider signature
 * verification, and the end-to-end "forwarded receipt -> subscription" path.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  parseReceiptDocument,
  normalizeDocumentText,
} from '@/lib/services/receipt-parser';
import {
  buildReceiptDraft,
  deriveProviderFromSender,
  stripHtmlToText,
  mapBillingCycleToBillFrequency,
} from '@/lib/services/receipt-discovery';
import {
  getInboundEmailDomain,
  ingestReceiptDraft,
  parseRecipientUserId,
  type InboundReceiptInput,
  type IngestResult,
} from '@/lib/services/receipt-ingestion';

type FormPayload = Record<string, string>;

const SIGNATURE_TTL_MS = 15 * 60 * 1000;

function constantTimeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export function verifyMailgunSignature(payload: FormPayload): boolean {
  const { timestamp, token, signature } = payload;
  if (!timestamp || !token || !signature) return false;
  const t = parseInt(timestamp, 10);
  if (!Number.isFinite(t) || Date.now() - t * 1000 > SIGNATURE_TTL_MS) return false;
  const expected = createHmac('sha256', env.MAILGUN_SIGNING_KEY ?? '')
    .update(`${timestamp}${token}`)
    .digest('hex');
  return constantTimeEqual(expected.toLowerCase(), signature.toLowerCase());
}

export function verifyWebhookAuth(payload: FormPayload, headers: Headers): { authorized: boolean; error?: string } {
  if (env.MAILGUN_SIGNING_KEY) {
    if (verifyMailgunSignature(payload)) return { authorized: true };
    return { authorized: false, error: 'Mailgun signature verification failed.' };
  }
  if (env.INBOUND_WEBHOOK_SECRET) {
    const supplied =
      payload['secret'] ||
      headers.get('x-webhook-secret') ||
      headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (supplied && constantTimeEqual(supplied, env.INBOUND_WEBHOOK_SECRET)) {
      return { authorized: true };
    }
    return { authorized: false, error: 'Invalid webhook secret.' };
  }
  return { authorized: false, error: 'Inbound email is not configured on this server.' };
}

function pickField(payload: FormPayload, names: string[]): string | undefined {
  for (const name of names) {
    const hit = Object.keys(payload).find((key) => key.toLowerCase() === name.toLowerCase());
    if (hit && payload[hit]) return payload[hit];
  }
  return undefined;
}

export function extractPayload(payload: FormPayload): InboundReceiptInput {
  const recipient =
    pickField(payload, ['recipient', 'to', 'Resent-To']) ||
    pickField(payload, ['Delivered-To', 'X-Original-To', 'Envelope-To', 'rcpt_to', 'X-Envelope-To']) ||
    '';
  const from = pickField(payload, ['from', 'sender', 'From', 'X-Envelope-From']) || '';
  const subject = pickField(payload, ['subject']) || '';
  const text =
    pickField(payload, ['stripped-text', 'body-plain', 'plain', 'text']) ||
    pickField(payload, ['Stripped-Text']) ||
    '';
  const html = pickField(payload, ['stripped-html', 'body-html', 'html']);
  const date = pickField(payload, ['Date', 'when', 'date']);
  return { recipient, from, subject, text, html, date };
}

export function getReceiptText(input: InboundReceiptInput): string {
  if (input.text && input.text.trim()) return input.text.trim();
  if (input.html && input.html.trim()) return stripHtmlToText(input.html);
  return '';
}

export async function isWebhookEnabled(): Promise<boolean> {
  return Boolean(env.MAILGUN_SIGNING_KEY || env.INBOUND_WEBHOOK_SECRET) && (await getInboundEmailDomain()) !== null;
}

export async function processInboundReceipt(input: InboundReceiptInput): Promise<IngestResult> {
  if (!(await getInboundEmailDomain())) {
    return { status: 'not_configured', error: 'Inbound email domain is not configured.' };
  }
  const userId = parseRecipientUserId(input.recipient);
  if (!userId) {
    return { status: 'invalid', error: `Address "${input.recipient}" is not a valid forwarding address.` };
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { status: 'not_configured', error: 'Server is missing SUPABASE_SERVICE_ROLE_KEY.' };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('id').eq('id', userId).maybeSingle();
  if (!profile) {
    return { status: 'invalid', error: 'No account exists for the forwarding address used.' };
  }

  const bodyText = getReceiptText(input);
  if (!bodyText) {
    return { status: 'invalid', error: 'The forwarded email had no readable text body.' };
  }

  const normalized = normalizeDocumentText(bodyText);
  const parsed = parseReceiptDocument(normalized, { kind: 'bill' });
  const providerName =
    parsed.providerName.value || deriveProviderFromSender(input.from);
  const draft = buildReceiptDraft({
    providerName,
    // A missing amount is passed through as 0 on purpose: `ingestReceiptDraft`
    // rejects that with a "could not determine amount" result rather than
    // inventing a price for the user.
    amount: parsed.amount.value ?? 0,
    currency: parsed.currency.value ?? 'USD',
    category: parsed.category.value ?? 'Utilities',
    paymentFrequency: mapBillingCycleToBillFrequency(parsed.billingCycle.value),
    from: input.from,
    subject: input.subject,
    paymentDate:
      parsed.paymentDate.value ??
      input.date ??
      new Date().toISOString(),
  });

  return ingestReceiptDraft(admin, userId, draft, 'Email Forwarding');
}

export async function processInboundReceiptWithSelfTest(
  recipient: string,
  text: string
): Promise<IngestResult> {
  return processInboundReceipt({
    recipient,
    from: 'Netflix <info@info.netflix.com>',
    subject: 'Your Netflix receipt for November 2026',
    text,
  });
}