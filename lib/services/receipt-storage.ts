'use client';

import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import type { ReceiptExtraction } from '@/lib/services/receipt-parser';

const RECEIPT_BUCKET = 'receipts';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ReceiptParent =
  | { kind: 'bill'; billPaymentId: string }
  | { kind: 'subscription'; subscriptionId: string };

export interface StoredReceipt {
  id: string;
  storagePath: string;
  fileName: string;
  byteSize: number;
}

export type StoreReceiptResult = {
  data: StoredReceipt | null;
  error: Error | null;
};

function safeFileName(name: string): string {
  const cleaned = name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(-80);
  return cleaned || 'receipt';
}

/**
 * Uploads the actual bytes behind a scanned receipt and records the row.
 *
 * Returns an error rather than throwing so callers can keep the payment they
 * already saved and surface a non-blocking warning.
 */
export async function storeReceiptFile(input: {
  file: File;
  parent: ReceiptParent;
  extraction?: ReceiptExtraction | null;
}): Promise<StoreReceiptResult> {
  const { file, parent } = input;

  const parentId =
    parent.kind === 'bill' ? parent.billPaymentId : parent.subscriptionId;
  if (!UUID_RE.test(parentId)) {
    return {
      data: null,
      error: new Error('Receipt file could not be attached because the item is only saved locally.'),
    };
  }

  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('You need to be signed in to attach a receipt file.') };
    }

    const storagePath = `${user.id}/${parentId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;

    const { error: uploadError } = await supabase.storage
      .from(RECEIPT_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      logger.warn('[receipt-storage] upload failed', { message: uploadError.message });
      return { data: null, error: new Error(uploadError.message) };
    }

    const confidence = input.extraction
      ? {
          amount: input.extraction.amount.confidence,
          currency: input.extraction.currency.confidence,
          paymentDate: input.extraction.paymentDate.confidence,
          providerName: input.extraction.providerName.confidence,
        }
      : null;

    const { data: row, error: rowError } = await supabase
      .from('receipts')
      .insert({
        user_id: user.id,
        subscription_id: parent.kind === 'subscription' ? parent.subscriptionId : null,
        bill_payment_id: parent.kind === 'bill' ? parent.billPaymentId : null,
        storage_path: storagePath,
        file_name: file.name,
        mime_type: file.type || 'application/octet-stream',
        byte_size: file.size,
        amount: input.extraction?.amount.value ?? null,
        currency: input.extraction?.currency.value ?? null,
        provider: input.extraction?.providerName.value ?? null,
        payment_date: input.extraction?.paymentDate.value ?? null,
        extraction_confidence: confidence,
      })
      .select('id, storage_path, file_name, byte_size')
      .single();

    if (rowError) {
      // The object exists but is now unreachable through the app, so remove it
      // rather than leaving an orphan the user can never see or delete.
      await supabase.storage.from(RECEIPT_BUCKET).remove([storagePath]);
      logger.warn('[receipt-storage] row insert failed', { message: rowError.message });
      return { data: null, error: new Error(rowError.message) };
    }

    return {
      data: {
        id: row.id,
        storagePath: row.storage_path,
        fileName: row.file_name,
        byteSize: row.byte_size,
      },
      error: null,
    };
  } catch (err) {
    logger.error('[receipt-storage] unexpected failure', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Receipt upload failed.'),
    };
  }
}

/** Mints a short-lived read URL for a known storage path. */
export async function createReceiptViewUrl(storagePath: string): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from(RECEIPT_BUCKET)
      .createSignedUrl(storagePath, 60 * 10);
    if (error) {
      logger.warn('[receipt-storage] signed URL failed', { message: error.message });
      return null;
    }
    return data.signedUrl;
  } catch (err) {
    logger.error('[receipt-storage] signed URL threw', err);
    return null;
  }
}

/**
 * Resolves a `receipts` row id to a signed URL. Row-level security means the
 * lookup can only ever return a receipt the caller owns.
 */
export async function createReceiptViewUrlForRow(receiptId: string): Promise<string | null> {
  if (!UUID_RE.test(receiptId)) return null;
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('receipts')
      .select('storage_path')
      .eq('id', receiptId)
      .maybeSingle();

    if (error || !data?.storage_path) {
      if (error) logger.warn('[receipt-storage] path lookup failed', { message: error.message });
      return null;
    }
    return createReceiptViewUrl(data.storage_path);
  } catch (err) {
    logger.error('[receipt-storage] path lookup threw', err);
    return null;
  }
}

/**
 * Adds the stored receipt to the bill payment's `receipts` JSONB so the bill
 * detail view can resolve it. `id` is the `receipts` row id, which is what
 * `createReceiptViewUrlForRow` is looked up by.
 */
export async function attachReceiptMetadata(
  billPaymentId: string,
  stored: StoredReceipt,
  context: {
    amount: number;
    currency: string;
    provider: string;
  }
): Promise<Error | null> {
  if (!UUID_RE.test(billPaymentId)) return null;

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('bill_payments')
      .select('receipts')
      .eq('id', billPaymentId)
      .single();

    if (error) return new Error(error.message);

    const existing = Array.isArray(data.receipts) ? data.receipts : [];
    const next = [
      ...existing,
      {
        id: stored.id,
        fileName: stored.fileName,
        uploadDate: new Date().toISOString(),
        price: context.amount,
        currency: context.currency,
        provider: context.provider,
      },
    ];

    const { error: updateError } = await supabase
      .from('bill_payments')
      .update({ receipts: next })
      .eq('id', billPaymentId);

    return updateError ? new Error(updateError.message) : null;
  } catch (err) {
    logger.error('[receipt-storage] attach metadata failed', err);
    return err instanceof Error ? err : new Error('Could not attach receipt metadata.');
  }
}
