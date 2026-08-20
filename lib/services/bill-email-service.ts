import type { BillPayment } from '@/lib/types/bills.types';
import { createBillPayment } from '@/lib/services/bills-service';

export interface EmailDiscoveredReceiptPayload {
  emailSubject: string;
  senderAddress: string;
  providerName: string;
  amount: number;
  currency: string;
  paymentDate: string;
  category?: string;
  customCategory?: string;
  providerReference?: string;
  rawEmailSnippet?: string;
}

/**
 * Creates a bill record from an authorized email receipt source.
 * Sets source metadata explicitly to 'email_discovered'.
 */
export async function createBillFromEmailReceipt(
  payload: EmailDiscoveredReceiptPayload
): Promise<{ data: BillPayment | null; error: Error | null }> {
  return createBillPayment({
    category: payload.category || 'Utilities',
    custom_category: payload.customCategory || null,
    provider_name: payload.providerName,
    amount: payload.amount,
    currency: payload.currency || 'NGN',
    payment_date: payload.paymentDate || new Date().toISOString().split('T')[0],
    source: 'email_discovered',
    provider_reference: payload.providerReference || null,
    notes: `[Email Discovered] From: ${payload.senderAddress} | Subject: ${payload.emailSubject}`,
    status: 'paid',
  });
}
