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

/**
 * Vision models to try, in order.
 *
 * This used to be a single hardcoded id — `llama-3.2-90b-vision-preview` — which
 * Groq shut down on 14 April 2025. Every screenshot then failed with "we could not
 * read that image" and no other symptom, because the real provider error was
 * logged and the user was told to try a clearer photo. The feature was simply dead
 * and looked like a bad upload.
 *
 * A list is the fix that generalises. Groq retires models on a rolling schedule and
 * the recommended replacement is often retired within a year — the successor named
 * for the 3.2 vision model, llama-4-scout, was itself retired in July 2026 — so
 * pinning one id is a recurring outage rather than a one-off.
 *
 * `GROQ_VISION_MODEL` is tried first, ahead of this list.
 */
const FALLBACK_VISION_MODELS = [
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'llama-3.2-90b-vision-preview',
  'llama-3.2-11b-vision-preview',
] as const;

/**
 * `GROQ_VISION_MODEL` is tried first. The fallback list still follows it, because a
 * pinned id that gets retired would otherwise take the feature down with no way to
 * recover without a deploy — which is precisely how the last one failed.
 */
function visionModelCandidates(): string[] {
  const pinned = process.env.GROQ_VISION_MODEL?.trim();
  return pinned ? [pinned, ...FALLBACK_VISION_MODELS] : [...FALLBACK_VISION_MODELS];
}

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
  const candidates = visionModelCandidates();
  const failures: { model: string; status: number; message: string }[] = [];

  for (const model of candidates) {
    const body = {
      model,
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

    let res: Response;
    try {
      res = await fetch(GROQ_CHAT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      // Network or timeout. Trying the next model cannot help, so stop here.
      const detail = err instanceof Error ? err.message : String(err);
      logger.error('[receipt] vision request failed', { model, detail });
      throw new VisionUnavailableError(
        'Image scanning could not reach the provider. Please try again shortly, or paste the receipt text.'
      );
    }

    if (!res.ok) {
      let message = `Vision provider error ${res.status}`;
      try {
        const errBody = (await res.json()) as { error?: { message?: string } };
        if (errBody?.error?.message) message = errBody.error.message;
      } catch {
        // keep the status-based message
      }
      failures.push({ model, status: res.status, message });

      /*
       * Only a complaint about the model is worth retrying with a different one.
       * A 401 is a bad key and a 429 is a quota, and both would fail identically on
       * every candidate, turning one honest error into four.
       */
      const aboutTheModel = /model|deprecat|decommission|not found|no longer|not available/i.test(message);
      if (!aboutTheModel || res.status === 401 || res.status === 429) {
        logger.error('[receipt] vision transcription failed', {
          model,
          status: res.status,
          message,
        });
        throw new VisionUnavailableError(unavailableMessage(failures));
      }
      continue;
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = (data.choices?.[0]?.message?.content ?? '').trim();

    if (!raw) {
      throw new VisionUnavailableError('The image did not contain any readable text.');
    }

    if (raw.replace(/[^A-Za-z]/g, '').toUpperCase().includes(NOT_A_RECEIPT.replace(/_/g, ''))) {
      return { text: '', model, notAReceipt: true };
    }

    // Models sometimes wrap output in a fenced block despite the instructions.
    const text = raw
      .replace(/^```[a-z]*\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()
      .slice(0, MAX_TRANSCRIPT_CHARS);

    return { text, model, notAReceipt: false };
  }

  logger.error('[receipt] every vision model was unavailable', { failures });
  throw new VisionUnavailableError(unavailableMessage(failures));
}

/**
 * Says what actually went wrong, without telling the reader to try a clearer photo
 * when the service is the problem.
 *
 * The previous message always blamed the image, which is why a dead model read as a
 * bad screenshot for as long as it went unnoticed.
 */
function unavailableMessage(failures: { status: number; message: string }[]): string {
  const last = failures[failures.length - 1];
  if (!last) {
    return 'Image scanning is unavailable right now. Please paste the receipt text instead.';
  }

  if (last.status === 401 || last.status === 403) {
    return 'Image scanning is not authorised on this server. Please paste the receipt text instead.';
  }
  if (last.status === 429) {
    return 'Image scanning has hit its usage limit right now. Please try again later, or paste the receipt text.';
  }
  if (/model|deprecat|decommission|not found|no longer|not available/i.test(last.message)) {
    return 'Image scanning is unavailable: the configured vision model is no longer offered. Please paste the receipt text instead.';
  }
  return 'We could not read that image. Try a clearer screenshot, or paste the receipt text instead.';
}
