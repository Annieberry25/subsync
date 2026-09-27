/**
 * Image receipt transcription via a vision model.
 *
 * Screenshot and photo receipt import is the one path that genuinely needs a
 * model: an image has no text layer, so there is nothing to decode. The model
 * is asked to *transcribe* only — never to return structured fields.
 *
 * That split is deliberate. Transcription is a task vision models are reliable
 * at, and it keeps every extracted number flowing through the deterministic
 * parser in `receipt-parser.ts`, which is unit-tested. Asking a model for
 * `{"amount": 120.5}` directly makes hallucinated figures indistinguishable
 * from real ones and untestable.
 *
 * IMPORTANT: server-only. Reads the server API key. Never import from a client
 * component.
 */
import { logger } from '@/lib/logger';

const GROQ_CHAT_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

/** Groq vision-capable model used for transcription. */
const VISION_MODEL = process.env.GROQ_VISION_MODEL?.trim() || 'llama-3.2-90b-vision-preview';

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_TRANSCRIPT_CHARS = 6_000;

/** Guard against absurd uploads reaching the model as base64. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Sentinel the model is told to emit for non-receipt images. */
export const NOT_A_RECEIPT = 'NOT_A_RECEIPT';

const TRANSCRIPTION_PROMPT = `You transcribe receipts and invoices for a bookkeeping app.

Return ONLY the text that is printed on the document, as plain text.

Rules:
- Reproduce every line of text you can read, in reading order (top to bottom, left to right).
- Keep money amounts, dates, invoice numbers, tax IDs and reference numbers EXACTLY as printed, including currency symbols and thousands separators.
- Do not translate, summarise, reformat, correct, or invent anything.
- If a field is unreadable, write [unreadable] in its place.
- Do not add commentary, headings, markdown, or explanations.
- If the image is not a receipt or invoice, output exactly: ${NOT_A_RECEIPT}`;

export interface TranscriptionResult {
  text: string;
  model: string;
  /** True when the model judged the image not to be a receipt. */
  notAReceipt: boolean;
}

export function isVisionConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

export class VisionUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VisionUnavailableError';
  }
}

/**
 * Transcribes an uploaded image into plain text.
 * Throws {@link VisionUnavailableError} when no API key is configured or the
 * provider rejects the request, so the caller can fall back to manual entry.
 */
export async function transcribeReceiptImage(
  bytes: Uint8Array,
  mimeType: string
): Promise<TranscriptionResult> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new VisionUnavailableError(
      'Image scanning is not configured on this server. Paste the receipt text instead.'
    );
  }
  if (bytes.length === 0) {
    throw new VisionUnavailableError('The uploaded image is empty.');
  }
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new VisionUnavailableError('The image is too large to scan.');
  }

  const dataUrl = `data:${mimeType};base64,${toBase64(bytes)}`;

  const body = {
    model: VISION_MODEL,
    temperature: 0,
    max_tokens: 1400,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: TRANSCRIPTION_PROMPT },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
  };

  const res = await fetch(GROQ_CHAT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    let message = `Vision provider error ${res.status}`;
    try {
      const errBody = (await res.json()) as { error?: { message?: string } };
      if (errBody?.error?.message) message = errBody.error.message;
    } catch {
      // keep the status-based message
    }
    logger.warn('[receipt] vision transcription failed', { status: res.status, message });
    throw new VisionUnavailableError(
      'We could not read that image. Try a clearer screenshot, or paste the receipt text instead.'
    );
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = (data.choices?.[0]?.message?.content ?? '').trim();

  if (!raw) {
    throw new VisionUnavailableError('The image did not contain any readable text.');
  }

  if (raw.replace(/[^A-Za-z]/g, '').toUpperCase().includes(NOT_A_RECEIPT.replace(/_/g, ''))) {
    return { text: '', model: VISION_MODEL, notAReceipt: true };
  }

  // Models sometimes wrap output in a fenced block despite the instructions.
  const text = raw
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
    .slice(0, MAX_TRANSCRIPT_CHARS);

  return { text, model: VISION_MODEL, notAReceipt: false };
}
