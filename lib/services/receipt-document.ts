/**
 * Receipt document decoding: turns an uploaded file into plain text.
 *
 * - PDFs are decoded with the embedded text layer via `pdfjs-dist`. A digital
 *   invoice (the overwhelming majority) yields accurate, machine-readable text
 *   with no model call and no data leaving the server.
 * - Images have no text layer, so they are routed to the vision transcriber in
 *   `receipt-vision.ts`.
 *
 * A scanned/image-only PDF has no text layer at all. Rather than silently
 * returning empty fields, `textLayerFound: false` is returned so the API can
 * tell the user to upload a screenshot instead.
 *
 * IMPORTANT: server-only. Imports Node/worker APIs and must never be pulled
 * into a client bundle.
 */
import { logger } from '@/lib/logger';
import type { PDFDocumentProxy } from 'pdfjs-dist';

export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
export const MAX_EXTRACTED_CHARS = 20_000;

export type ReceiptMimeType =
  | 'application/pdf'
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/heic'
  | 'image/heif'
  | 'text/plain'
  | 'text/csv'
  | 'text/markdown';

export const ACCEPTED_RECEIPT_MIME_TYPES: readonly ReceiptMimeType[] = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'text/plain',
  'text/csv',
  'text/markdown',
];

/** Magic-byte signatures used to verify the declared MIME type. */
const MAGIC_BYTES: Array<{ mime: ReceiptMimeType; bytes: number[]; offset?: number }> = [
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
];

export function isAcceptedMimeType(mime: string): mime is ReceiptMimeType {
  return (ACCEPTED_RECEIPT_MIME_TYPES as readonly string[]).includes(mime);
}

export function isImageMimeType(mime: string): boolean {
  return mime.startsWith('image/');
}

/** Sniffs the real content type so a renamed `.exe` cannot reach the parsers. */
export function detectMimeTypeFromBytes(bytes: Uint8Array): ReceiptMimeType | null {
  for (const sig of MAGIC_BYTES) {
    const start = sig.offset ?? 0;
    if (bytes.length < start + sig.bytes.length) continue;
    let matches = true;
    for (let i = 0; i < sig.bytes.length; i += 1) {
      if (bytes[start + i] !== sig.bytes[i]) {
        matches = false;
        break;
      }
    }
    if (matches) return sig.mime;
  }
  // RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  // ....ftypheic / ftypheix / ftypmif1
  if (bytes.length >= 12) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (brand.startsWith('ftyp')) {
      const subtype = brand.slice(4);
      if (subtype === 'mif1' || subtype === 'heic' || subtype === 'heix' || subtype === 'hevc') {
        return 'image/heic';
      }
    }
  }
  return null;
}

export class ReceiptFileError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'too_large'
      | 'unsupported_type'
      | 'corrupt'
      | 'no_text_layer'
      | 'empty'
  ) {
    super(message);
    this.name = 'ReceiptFileError';
  }
}

export interface DecodedDocument {
  text: string;
  /** How the text was obtained, for display and for debugging. */
  source: 'pdf-text-layer' | 'plain-text';
  pageCount: number;
  /** False when a PDF had no embedded text (a scan or a photo). */
  textLayerFound: boolean;
  /** Set when a PDF is password protected. */
  passwordProtected?: boolean;
  truncated?: boolean;
}

function truncate(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_EXTRACTED_CHARS) return { text, truncated: false };
  return { text: text.slice(0, MAX_EXTRACTED_CHARS), truncated: true };
}

const WS = new Set([0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20]);
const isWs = (b: number) => WS.has(b);
const isDigit = (b: number) => b >= 0x30 && b <= 0x39;

/**
 * Rebuilds a missing cross-reference table by scanning for `N G obj` headers.
 *
 * pdfjs throws `InvalidPDFException: Invalid PDF structure` when a file has no
 * usable `startxref`, and none of its `getDocument` options enable recovery —
 * `stopAtErrors: false` does not help because there is nothing to be lenient
 * about. That is not a hypothetical: receipts that have been passed through
 * mail clients, download managers, or PDF generators routinely come out
 * byte-valid but structurally broken, and every one of them was previously
 * reported to the user as "damaged or incomplete".
 *
 * This is the standard repair (the same idea as `mutool clean`): find every
 * indirect object, write a fresh classic xref plus trailer, and append them.
 * The original bytes are left completely untouched, so a file that pdfjs was
 * merely unhappy about still parses through the normal path first.
 *
 * Returns null when the scan finds no object headers, i.e. when the payload
 * genuinely is not a PDF and must not be silently reinterpreted.
 */
export function rebuildPdfXref(bytes: Uint8Array): Uint8Array | null {
  // Objects are found in ascending offset order, so the first hit for a given
  // number is the definition and any later one is a later revision to ignore.
  const offsets = new Map<number, number>();

  for (let i = 0; i + 2 < bytes.length; i += 1) {
    if (bytes[i] !== 0x6f || bytes[i + 1] !== 0x62 || bytes[i + 2] !== 0x6a) continue;

    // Walk backwards over the `obj` keyword to recover the two numbers.
    let k = i - 1;
    while (k >= 0 && isWs(bytes[k])) k -= 1;
    const genEnd = k + 1;
    while (k >= 0 && isDigit(bytes[k])) k -= 1;
    const genStart = k + 1;
    if (genStart === genEnd) continue;

    while (k >= 0 && isWs(bytes[k])) k -= 1;
    const numEnd = k + 1;
    while (k >= 0 && isDigit(bytes[k])) k -= 1;
    const numStart = k + 1;
    if (numStart === numEnd) continue;

    // Must not be the tail of a longer token, e.g. inside a content stream.
    if (numStart > 0 && !isWs(bytes[numStart - 1])) continue;

    let objNum = 0;
    for (let d = numStart; d < numEnd; d += 1) objNum = objNum * 10 + (bytes[d] - 0x30);
    if (!Number.isSafeInteger(objNum) || objNum > 1_000_000) continue;

    if (!offsets.has(objNum)) offsets.set(objNum, numStart);
  }

  if (offsets.size === 0) return null;

  // The trailer needs a /Root. Prefer an existing /Root reference; otherwise
  // fall back to whichever object declares itself the catalog.
  let rootNum = -1;
  const trailerStart = Math.max(0, bytes.length - 2048);
  const rootRef = /\/Root\s+(\d+)\s+(\d+)\s+R/.exec(
    latin1Slice(bytes, trailerStart, bytes.length)
  );
  if (rootRef) {
    rootNum = Number(rootRef[1]);
  } else {
    for (const [num, start] of offsets) {
      const window = latin1Slice(bytes, start, Math.min(bytes.length, start + 512));
      if (/\/Type\s*\/Catalog/.test(window)) {
        rootNum = num;
        break;
      }
    }
  }
  if (rootNum < 0 || !offsets.has(rootNum)) return null;

  const maxObj = Math.max(rootNum, ...offsets.keys());
  const parts: string[] = ['\n'];
  const xrefStart = bytes.length + 1;

  parts.push(`xref\n0 ${maxObj + 1}\n`);
  parts.push('0000000000 65535 f \n');
  for (let num = 1; num <= maxObj; num += 1) {
    const off = offsets.get(num);
    parts.push(
      off === undefined
        ? '0000000000 65535 f \n'
        : `${String(off).padStart(10, '0')} 00000 n \n`
    );
  }
  parts.push(`trailer\n<</Size ${maxObj + 1}/Root ${rootNum} 0 R>>\nstartxref\n${xrefStart}\n%%EOF\n`);

  const suffix = new TextEncoder().encode(parts.join(''));
  const out = new Uint8Array(bytes.length + suffix.length);
  out.set(bytes, 0);
  out.set(suffix, bytes.length);
  return out;
}

/** Latin-1 view of a byte range, so byte offsets and string indices line up. */
function latin1Slice(bytes: Uint8Array, start: number, end: number): string {
  let out = '';
  for (let i = start; i < end; i += 1) out += String.fromCharCode(bytes[i]);
  return out;
}

/**
 * Extracts the text layer from a PDF using pdfjs. Requires the Node runtime and
 * a `Uint8Array` (not a Node Buffer view that pdfjs may misread).
 */
export async function extractPdfText(bytes: Uint8Array): Promise<DecodedDocument> {
  if (bytes.length === 0) {
    throw new ReceiptFileError('The PDF is empty.', 'empty');
  }

  const PASSWORD_MESSAGE =
    'This PDF is password protected, so we cannot read it. Please upload an unlocked copy.';

  let opened = await openPdf(bytes);

  if (!opened.ok && opened.name === 'PasswordException') {
    throw new ReceiptFileError(PASSWORD_MESSAGE, 'corrupt');
  }

  if (!opened.ok) {
    // Structurally broken files are common enough in the wild that it is worth
    // rebuilding the xref table before telling anyone their receipt is damaged.
    const rebuilt = rebuildPdfXref(bytes);
    if (rebuilt) {
      logger.warn('[receipt] PDF xref rebuild required', {
        reason: opened.name,
        detail: opened.message,
        bytes: bytes.length,
      });
      const retry = await openPdf(rebuilt);
      if (retry.ok) {
        opened = retry;
      } else if (retry.name === 'PasswordException') {
        throw new ReceiptFileError(PASSWORD_MESSAGE, 'corrupt');
      } else {
        throw corruptError(opened, bytes);
      }
    } else {
      throw corruptError(opened, bytes);
    }
  }

  const { doc, loadingTask } = opened;
  const pageCount = doc.numPages;
  const chunks: string[] = [];
  let extractionError: unknown = null;

  try {
    // Invoices are short. Capping at 25 pages keeps a hostile or malformed file
    // from burning the request budget.
    const pageLimit = Math.min(pageCount, 25);
    for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();

      // Rebuild lines from item positions so "Total" and its amount stay on the
      // same line — the parser's label anchoring depends on line structure.
      let line = '';
      let lastY: number | null = null;
      for (const item of content.items) {
        if (!('str' in item)) continue;
        const y = typeof item.transform?.[5] === 'number' ? item.transform[5] : null;
        if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
          chunks.push(line.trim());
          line = '';
        }
        line += item.str;
        if (item.hasEOL) {
          chunks.push(line.trim());
          line = '';
        }
        lastY = y;
      }
      if (line.trim()) chunks.push(line.trim());
      page.cleanup();
    }
  } catch (err) {
    // A file can open but still have an unreadable page or content stream. Any
    // raw pdfjs error escaping here reaches the user as a raw 500, so it is
    // captured and reported below. Text recovered from the pages that did read
    // is still worth keeping.
    extractionError = err;
    logger.warn('[receipt] PDF page extraction failed', {
      name: err instanceof Error ? err.name : 'UnknownError',
      message: err instanceof Error ? err.message : String(err),
      pagesRead: chunks.length,
    });
  } finally {
    await loadingTask.destroy();
  }

  const text = chunks.filter((l) => l.length > 0).join('\n');

  if (extractionError && text.trim().length === 0) {
    throw new ReceiptFileError(
      'This PDF could not be read. Please upload a screenshot of the receipt, or paste the text, and we will extract the details for you.',
      'corrupt'
    );
  }
  const foundText = text.replace(/\s/g, '').length >= 20;

  const { text: capped, truncated } = truncate(text);

  return {
    text: capped,
    source: 'pdf-text-layer',
    pageCount,
    textLayerFound: foundText,
    truncated,
  };
}

/** pdfjs's own proxy types, so the structural view stays honest. */
type PdfOpenResult =
  | { ok: true; doc: PDFDocumentProxy; loadingTask: { destroy: () => Promise<void> } }
  | { ok: false; name: string; message: string };

/**
 * One pdfjs open attempt. Failures are returned rather than thrown so the
 * caller can decide whether a structural repair is worth attempting, and so the
 * underlying reason is not lost.
 */
async function openPdf(bytes: Uint8Array): Promise<PdfOpenResult> {
  // `pdfjs-dist/legacy/build/pdf.mjs` is the build that works without a DOM.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  // pdfjs takes ownership of the buffer it is given and may detach it, so hand
  // it a copy. Without this, a retry on the same array sees an empty document.
  const data = new Uint8Array(bytes);

  const loadingTask = pdfjs.getDocument({
    data,
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0,
  });

  try {
    const doc = await loadingTask.promise;
    return { ok: true, doc, loadingTask };
  } catch (err) {
    // The failed task still owns worker resources and must be torn down.
    await loadingTask.destroy().catch(() => {});
    const name = err instanceof Error ? err.name : 'UnknownError';
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('[receipt] pdfjs failed to open document', { name, message });
    return { ok: false, name, message };
  }
}

/**
 * Turns a pdfjs failure into a message that is actually true. Saying "damaged
 * or broken" about a file that is not a PDF at all is what made this so hard to
 * diagnose, so the two cases are separated.
 */
function corruptError(failure: { name: string; message: string }, bytes: Uint8Array): ReceiptFileError {
  const looksLikePdf =
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46;

  if (!looksLikePdf) {
    return new ReceiptFileError(
      'That file is not a readable PDF. Please upload the original invoice PDF, a screenshot, or paste the receipt text.',
      'unsupported_type'
    );
  }

  if (failure.name === 'InvalidPDFException') {
    return new ReceiptFileError(
      'This PDF is missing the internal structure needed to read it, so we could not repair it automatically. Please re-download it from the provider, or upload a screenshot instead.',
      'corrupt'
    );
  }

  return new ReceiptFileError(
    'This PDF could not be opened. Please try re-downloading it from the provider, or upload a screenshot instead.',
    'corrupt'
  );
}

export function decodePlainText(text: string): DecodedDocument {
  const { text: capped, truncated } = truncate(text);
  return {
    text: capped,
    source: 'plain-text',
    pageCount: 1,
    textLayerFound: capped.replace(/\s/g, '').length > 0,
    truncated,
  };
}

/**
 * Sniffs a text payload and decodes it, so a `.txt` that is secretly a PDF is
 * handled by the PDF path instead of producing binary noise.
 */
export async function decodeUploadedTextFile(
  bytes: Uint8Array,
  fileName: string
): Promise<DecodedDocument> {
  const sniffed = detectMimeTypeFromBytes(bytes);
  if (sniffed === 'application/pdf') {
    return extractPdfText(bytes);
  }

  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  // Some text files are Latin-1 encoded; detect the classic double-encoding and
  // re-decode rather than feeding mojibake to the parser.
  const repaired = /Ã[-¿]/.test(text)
    ? new TextDecoder('latin1').decode(bytes)
    : text;

  logger.info('[receipt] decoded text attachment', { fileName, bytes: bytes.length });
  return decodePlainText(repaired);
}
