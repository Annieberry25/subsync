import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  cameraErrorMessage,
  captureReceiptPhoto,
  isCameraSupported,
} from '@/lib/utils/receipt-camera';

/**
 * jsdom has no canvas backend, so the frame grab needs a stand-in: a 2d
 * context that records the draw, and a `toBlob` that hands back a JPEG.
 */
function stubCanvas() {
  const drawImage = vi.fn();

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillStyle: '',
    fillRect: vi.fn(),
    drawImage,
    translate: vi.fn(),
    rotate: vi.fn(),
  } as unknown as CanvasRenderingContext2D);

  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback: BlobCallback
  ) {
    callback(new Blob(['jpeg-bytes'], { type: 'image/jpeg' }));
  });

  return { drawImage };
}

function fakeVideo(width = 1280, height = 720) {
  return { videoWidth: width, videoHeight: height } as unknown as HTMLVideoElement;
}

function fakeStream() {
  return {
    getVideoTracks: () => [{ stop: vi.fn() }],
  } as unknown as MediaStream;
}

describe('isCameraSupported', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete (navigator as { mediaDevices?: unknown }).mediaDevices;
  });

  it('is false when the browser exposes no camera API', () => {
    expect(isCameraSupported()).toBe(false);
  });

  it('is false in an insecure context, where getUserMedia is hidden', () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: { getUserMedia: vi.fn() },
    });
    // jsdom does not define the property at all.
    Object.defineProperty(window, 'isSecureContext', {
      value: false,
      configurable: true,
    });

    expect(isCameraSupported()).toBe(false);
  });

  it('is true with a camera API in a secure context', () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: { getUserMedia: vi.fn() },
    });
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      configurable: true,
    });

    expect(isCameraSupported()).toBe(true);
  });
});

describe('cameraErrorMessage', () => {
  it('explains a blocked camera and points at the gallery', () => {
    const message = cameraErrorMessage(new DOMException('denied', 'NotAllowedError'));
    expect(message).toMatch(/blocked/i);
    expect(message).toMatch(/gallery/i);
  });

  it('explains a missing camera', () => {
    expect(cameraErrorMessage(new DOMException('none', 'NotFoundError'))).toMatch(
      /no camera/i
    );
  });

  it('falls back to a gallery hand-off for an unknown failure', () => {
    expect(cameraErrorMessage(new Error('boom'))).toMatch(/gallery/i);
  });
});

describe('captureReceiptPhoto', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the snapped frame as a JPEG file', async () => {
    stubCanvas();

    const file = await captureReceiptPhoto(fakeVideo(), fakeStream());

    expect(file.type).toBe('image/jpeg');
    expect(file.name).toMatch(/^receipt-.*\.jpg$/);
  });

  it('refuses when the camera has not produced a frame yet', async () => {
    stubCanvas();

    await expect(captureReceiptPhoto(fakeVideo(0, 0), fakeStream())).rejects.toThrow(
      /frame/i
    );
  });
});
