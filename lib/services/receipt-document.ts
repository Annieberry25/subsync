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

/**
 * Extracts the text layer from a PDF using pdfjs. Requires the Node runtime and
 * a `Uint8Array` (not a Node Buffer view that pdfjs may misread).
 */
export async function extractPdfText(bytes: Uint8Array): Promise<DecodedDocument> {
  if (bytes.length === 0) {
    throw new ReceiptFileError('The PDF is empty.', 'empty');
  }

  // `pdfjs-dist/legacy/build/pdf.mjs` is the build that works without a DOM.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(bytes);

  const loadingTask = pdfjs.getDocument({
    data,
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0,
  });

  let doc;
  try {
    doc = await loadingTask.promise;
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    if (name === 'PasswordException') {
      throw new ReceiptFileError('This PDF is password protected and cannot be read.', 'corrupt');
    }
    throw new ReceiptFileError(
      'This PDF could not be opened. It may be damaged or incomplete.',
      'corrupt'
    );
  }

  const pageCount = doc.numPages;
  const chunks: string[] = [];
  let foundText = false;

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
  } finally {
    await loadingTask.destroy();
  }

  const text = chunks.filter((l) => l.length > 0).join('\n');
  foundText = text.replace(/\s/g, '').length >= 20;

  const { text: capped, truncated } = truncate(text);

  return {
    text: capped,
    source: 'pdf-text-layer',
    pageCount,
    textLayerFound: foundText,
    truncated,
  };
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
