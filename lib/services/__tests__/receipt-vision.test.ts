import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Regression cover for a feature that was dead and looked like a bad upload.
 *
 * The model was pinned to `llama-3.2-90b-vision-preview`, which Groq shut down on
 * 14 April 2025. Every screenshot then failed with "we could not read that image" —
 * advice about a clearer photo, for a fault that had nothing to do with the photo.
 *
 * Groq retires models on a rolling schedule and the recommended replacement is often
 * retired within a year, so a single pinned id is a recurring outage. These tests
 * hold the fallback list and the distinction between "our fault" and "theirs".
 */

const fetchMock = vi.fn();

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { transcribeReceiptImage, VisionUnavailableError } from '@/lib/services/receipt-vision';

function okResponse(content: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] }),
  };
}

function modelGoneResponse(model: string) {
  return {
    ok: false,
    status: 400,
    json: async () => ({
      error: { message: `The model \`${model}\` has been decommissioned and is no longer available.` },
    }),
  };
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  process.env.GROQ_API_KEY = 'test-key';
  delete process.env.GROQ_VISION_MODEL;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const BYTES = new Uint8Array([1, 2, 3]);

describe('transcribeReceiptImage', () => {
  it('falls through to the next model when one has been decommissioned', async () => {
    fetchMock
      .mockResolvedValueOnce(modelGoneResponse('meta-llama/llama-4-scout-17b-16e-instruct'))
      .mockResolvedValueOnce(okResponse('NETFLIX 15.49'));

    const result = await transcribeReceiptImage(BYTES, 'image/png');

    expect(result.notAReceipt).toBe(false);
    expect(result.text).toContain('NETFLIX');
    // The dead model was tried first, then the next one served it.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const bodies = fetchMock.mock.calls.map((c) => JSON.parse(c[1].body as string).model);
    expect(bodies[0]).not.toBe(bodies[1]);
  });

  it('says the model is gone rather than blaming the photo', async () => {
    fetchMock.mockResolvedValue(modelGoneResponse('whatever'));

    await expect(transcribeReceiptImage(BYTES, 'image/png')).rejects.toThrow(
      /no vision model on the configured provider/i
    );
    // The old wording told people to try a clearer screenshot, which is nonsense
    // when nothing is wrong with the screenshot.
    await expect(transcribeReceiptImage(BYTES, 'image/png')).rejects.not.toThrow(
      /clearer screenshot/i
    );
  });

  /**
   * The model that leads the list. Groq no longer hosts anything marketed as
   * vision-capable, and this is the current generation of the one model on their
   * list that accepts image input.
   */
  it('tries qwen/qwen3.8-27b first, the current image-capable model', async () => {
    fetchMock.mockResolvedValue(okResponse('AMAZON PRIME 14.99'));

    await transcribeReceiptImage(BYTES, 'image/png');

    const first = JSON.parse(fetchMock.mock.calls[0][1].body as string).model;
    expect(first).toBe('qwen/qwen3.8-27b');
  });

  it('walks past a model that exists but cannot read images', async () => {
    // A 400 complaining about the image payload, not about the model id.
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'This model does not support image input.' } }),
    }).mockResolvedValueOnce(okResponse('SPOTIFY 10.99'));

    const result = await transcribeReceiptImage(BYTES, 'image/png');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.text).toContain('SPOTIFY');
  });

  it('does not retry every model when the key itself is rejected', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid API Key' } }),
    });

    await expect(transcribeReceiptImage(BYTES, 'image/png')).rejects.toThrow(/not authorised/i);
    // One attempt: retrying a bad key on four models is four identical failures.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports a quota limit as a quota limit', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'Rate limit reached' } }),
    });

    await expect(transcribeReceiptImage(BYTES, 'image/png')).rejects.toThrow(/usage limit/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('tries a pinned model first, then still falls back if it is gone', async () => {
    process.env.GROQ_VISION_MODEL = 'pinned/model';
    fetchMock.mockResolvedValueOnce(modelGoneResponse('pinned/model')).mockResolvedValue(okResponse('X'));

    const result = await transcribeReceiptImage(BYTES, 'image/png');

    const bodies = fetchMock.mock.calls.map((c) => JSON.parse(c[1].body as string).model);
    expect(bodies[0]).toBe('pinned/model');
    expect(bodies[1]).not.toBe('pinned/model');
    expect(result.notAReceipt).toBe(false);
  });

  it('reports which model answered', async () => {
    fetchMock.mockResolvedValueOnce(modelGoneResponse('first')).mockResolvedValueOnce(okResponse('OK'));

    const result = await transcribeReceiptImage(BYTES, 'image/png');

    expect(result.model).toBeTruthy();
  });

  it('keeps a network failure distinct from an unreadable image', async () => {
    fetchMock.mockRejectedValue(new Error('fetch failed'));

    const err = await transcribeReceiptImage(BYTES, 'image/png').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(VisionUnavailableError);
    expect((err as Error).message).toMatch(/could not reach the provider/i);
  });
});