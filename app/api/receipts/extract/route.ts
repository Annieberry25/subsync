import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser, getPlanTier } from '@/lib/auth/access';
import { logger } from '@/lib/logger';
import { getPlanLimits } from '@/lib/constants/plan-limits';
import { parseReceiptDocument, type ReceiptExtraction, type ReceiptKind } from '@/lib/services/receipt-parser';
import {
  MAX_RECEIPT_BYTES,
  ReceiptFileError,
  decodeUploadedTextFile,
  detectMimeTypeFromBytes,
  extractPdfText,
  isAcceptedMimeType,
  isImageMimeType,
} from '@/lib/services/receipt-document';
import {
  MAX_IMAGE_BYTES,
  VisionUnavailableError,
  isVisionConfigured,
  transcribeReceiptImage,
} from '@/lib/services/receipt-vision';
import {
  countReceiptScansThisMonth,
  recordReceiptScan,
  type ReceiptScanSource,
} from '@/lib/services/receipt-scan-usage';

/**
 * POST /api/receipts/extract
 *
 * Turns an uploaded receipt (PDF invoice, screenshot, photo) or pasted text
 * into structured, confidence-scored fields.
 *
 * This is the only place receipt text is produced. The client modals no longer
 * read binary files with `FileReader.readAsText`, which is what made image and
 * PDF import silently produce garbage.
 */
export const runtime = 'nodejs';
export const maxDuration = 45;
export const dynamic = 'force-dynamic';

const MAX_PASTED_CHARS = 20_000;

const kindSchema = z.enum(['subscription', 'bill']);

interface ExtractPayload {
  kind: ReceiptKind;
  /** Where the text came from, so the UI can be honest about it. */
  textSource: 'pdf-text-layer' | 'image-vision' | 'pasted-text' | 'text-file';
  pageCount: number;
  /** The decoded text, so the user can see exactly what was read. */
  text: string;
  extraction: ReceiptExtraction;
  fileName: string | null;
  /** True when the upload was truncated for size/safety. */
  truncated: boolean;
}

interface ExtractResponseBody extends ExtractPayload {
  ok: true;
}

function fail(status: number, error: string, detail?: string) {
  return NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });
}

export async function POST(request: Request) {
  let supabase;
  try {
    supabase = await createClient();
  } catch (err) {
    logger.error('[receipts/extract] could not create server client', err);
    return fail(500, 'Receipt scanning is temporarily unavailable.');
  }

  const user = await getAuthUser(supabase);
  if (!user) {
    return fail(401, 'Sign in to scan a receipt.');
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, 'Could not read the upload. Please try again.');
  }

  const kindResult = kindSchema.safeParse(form.get('kind') ?? 'subscription');
  if (!kindResult.success) {
    return fail(400, 'Unknown receipt kind.');
  }
  const kind: ReceiptKind = kindResult.data;

  // Quota: a vision call costs a provider request, so the plan limit is
  // enforced here rather than only described in the UI.
  const limits = getPlanLimits(getPlanTier(user));
  if (Number.isFinite(limits.maxReceiptScansPerMonth)) {
    const used = await countReceiptScansThisMonth(user.id);
    if (used >= limits.maxReceiptScansPerMonth) {
      return fail(
        429,
        `You have used all ${limits.maxReceiptScansPerMonth} receipt scans for this month. Upgrade for more, or paste the receipt text instead.`
      );
    }
  }

  const file = form.get('file');
  const pastedText = typeof form.get('text') === 'string' ? (form.get('text') as string) : '';

  const respond = (body: ExtractPayload, source: ReceiptScanSource) => {
    // Fire-and-forget: a failed counter write must not fail the extraction.
    void recordReceiptScan(user.id, source);
    return NextResponse.json<ExtractResponseBody>({ ok: true, ...body });
  };

  // ---- Path A: pasted text -------------------------------------------------
  if (!(file instanceof File) || file.size === 0) {
    const text = pastedText.trim();
    if (!text) {
      return fail(400, 'Upload a receipt file or paste the receipt text.');
    }
    const capped = text.slice(0, MAX_PASTED_CHARS);
    const extraction = parseReceiptDocument(capped, { kind });
    return respond(
      {
        kind,
        textSource: 'pasted-text',
        pageCount: 1,
        text: capped,
        extraction,
        fileName: null,
        truncated: capped.length < text.length,
      },
      'paste'
    );
  }

  // ---- Path B: uploaded file ----------------------------------------------
  if (file.size > MAX_RECEIPT_BYTES) {
    return fail(413, 'That file is larger than the 10MB limit.');
  }

  const declaredType = (file.type || '').toLowerCase().split(';')[0].trim();
  let mimeType = declaredType;
  if (!isAcceptedMimeType(mimeType)) {
    // Some browsers/phones send an empty or generic type; fall back to the
    // extension, then to magic bytes.
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const byExtension: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      heic: 'image/heic',
      heif: 'image/heif',
      txt: 'text/plain',
      csv: 'text/csv',
      md: 'text/markdown',
    };
    mimeType = byExtension[ext] ?? mimeType;
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  // Trust the content over the declared type.
  const sniffed = detectMimeTypeFromBytes(bytes);
  if (sniffed && sniffed !== mimeType) {
    const compatible =
      (isImageMimeType(sniffed) && isImageMimeType(mimeType)) ||
      (sniffed === 'application/pdf' && mimeType === 'application/pdf');
    if (!compatible) {
      return fail(
        415,
        'That file does not look like the type it claims to be. Please upload a PDF invoice or a screenshot.'
      );
    }
    mimeType = sniffed;
  }

  if (!isAcceptedMimeType(mimeType)) {
    return fail(415, 'Unsupported file type. Please upload a PDF invoice or a JPG, PNG, WebP, or HEIC image.');
  }

  let text = '';
  let textSource: ExtractResponseBody['textSource'];
  let pageCount = 1;
  let truncated = false;

  try {
    if (mimeType === 'application/pdf') {
      const decoded = await extractPdfText(bytes);
      pageCount = decoded.pageCount;
      truncated = Boolean(decoded.truncated);
      if (!decoded.textLayerFound) {
        // A scanned or photographed PDF has no text layer. Rendering it to an
        // image and re-uploading is the honest, reliable path.
        return fail(
          422,
          'This looks like a scanned or photographed PDF, so there is no text to read. Please upload a screenshot of the receipt, or paste the text, and we will extract the details for you.'
        );
      }
      text = decoded.text;
      textSource = 'pdf-text-layer';
    } else if (isImageMimeType(mimeType)) {
      if (bytes.length > MAX_IMAGE_BYTES) {
        return fail(413, 'That image is larger than the 8MB limit.');
      }
      if (!isVisionConfigured()) {
        return fail(
          503,
          'Image scanning is not configured on this server yet. Please paste the receipt text instead.'
        );
      }
      const transcript = await transcribeReceiptImage(bytes, mimeType);
      if (transcript.notAReceipt) {
        return fail(422, 'That image does not look like a receipt or invoice.');
      }
      text = transcript.text;
      textSource = 'image-vision';
    } else {
      const decoded = await decodeUploadedTextFile(bytes, file.name);
      text = decoded.text;
      truncated = Boolean(decoded.truncated);
      if (!decoded.textLayerFound) {
        return fail(422, 'That text file appears to be empty.');
      }
      textSource = 'text-file';
    }
  } catch (err) {
    if (err instanceof ReceiptFileError) {
      const status = err.code === 'too_large' ? 413 : err.code === 'empty' ? 400 : 422;
      return fail(status, err.message);
    }
    if (err instanceof VisionUnavailableError) {
      return fail(503, err.message);
    }
    logger.error('[receipts/extract] decode failed', err, { kind, mimeType });
    return fail(500, 'We could not read that receipt. Please try a clearer file or enter the details manually.');
  }

  if (!text.trim()) {
    return fail(422, 'No readable text was found in that file.');
  }

  const extraction = parseReceiptDocument(text, { kind, fileName: file.name });

  // An image that produced only noise is a failed scan, not a failed parse.
  if (textSource === 'image-vision' && extraction.amount.value === null && extraction.providerName.value === null) {
    return fail(
      422,
      'We could not find a merchant or an amount in that image. Try a clearer, closer screenshot, or paste the text instead.'
    );
  }

  return respond(
    {
      kind,
      textSource,
      pageCount,
      text,
      extraction,
      fileName: file.name,
      truncated,
    },
    'upload'
  );
}
