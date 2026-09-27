'use client';

import { useCallback, useState } from 'react';
import type { ReceiptExtraction, ReceiptKind } from '@/lib/services/receipt-parser';

/**
 * Client binding for `POST /api/receipts/extract`.
 *
 * Both receipt modals go through this so there is exactly one upload path. It
 * deliberately does *not* fall back to reading the file in the browser: that is
 * what previously made image and PDF import silently produce garbage.
 */

export type ReceiptTextSource = 'pdf-text-layer' | 'image-vision' | 'pasted-text' | 'text-file';

export interface ReceiptScanResult {
  kind: ReceiptKind;
  textSource: ReceiptTextSource;
  pageCount: number;
  /** The text the server actually read, so the user can verify it. */
  text: string;
  extraction: ReceiptExtraction;
  fileName: string | null;
  truncated: boolean;
}

export class ReceiptScanError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ReceiptScanError';
  }
}

/** Accepted by the file input and validated server-side by content sniffing. */
export const ACCEPT_ATTRIBUTE =
  '.pdf,.png,.jpg,.jpeg,.webp,.heic,.heif,.txt,.csv,application/pdf,image/png,image/jpeg,image/webp,image/heic,text/plain';

export async function scanReceipt(input: {
  kind: ReceiptKind;
  file?: File | null;
  text?: string;
  signal?: AbortSignal;
}): Promise<ReceiptScanResult> {
  const body = new FormData();
  body.set('kind', input.kind);
  if (input.file && input.file.size > 0) {
    body.set('file', input.file);
  } else if (input.text && input.text.trim()) {
    body.set('text', input.text.trim());
  } else {
    throw new ReceiptScanError('Upload a receipt file or paste the receipt text.', 400);
  }

  let res: Response;
  try {
    res = await fetch('/api/receipts/extract', {
      method: 'POST',
      body,
      signal: input.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ReceiptScanError(
      'We could not reach the scanner. Check your connection and try again, or enter the details manually.',
      0
    );
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    throw new ReceiptScanError('The scanner returned an unexpected response.', res.status);
  }

  if (!res.ok || (payload as { ok?: boolean })?.ok !== true) {
    const message =
      (payload as { error?: string })?.error ??
      'We could not read that receipt. Please try again or enter the details manually.';
    throw new ReceiptScanError(message, res.status);
  }

  return payload as ReceiptScanResult;
}

export interface UseReceiptScanResult {
  isScanning: boolean;
  error: string | null;
  result: ReceiptScanResult | null;
  run: (input: { kind: ReceiptKind; file?: File | null; text?: string }) => Promise<ReceiptScanResult | null>;
  reset: () => void;
  clearError: () => void;
}

export function useReceiptScan(): UseReceiptScanResult {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReceiptScanResult | null>(null);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const run = useCallback<UseReceiptScanResult['run']>(async (input) => {
    setIsScanning(true);
    setError(null);
    try {
      const scan = await scanReceipt(input);
      setResult(scan);
      return scan;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Receipt scanning failed.');
      return null;
    } finally {
      setIsScanning(false);
    }
  }, []);

  return { isScanning, error, result, run, reset, clearError };
}

/** Human-readable label for where the text came from. */
export const TEXT_SOURCE_LABEL: Record<ReceiptTextSource, string> = {
  'pdf-text-layer': 'PDF invoice text',
  'image-vision': 'Screenshot scanned',
  'pasted-text': 'Pasted text',
  'text-file': 'Text file',
};
