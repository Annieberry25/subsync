/**
 * Camera helpers for snapping a receipt.
 *
 * Browser-only: every export here touches `navigator`, a `<video>` element or a
 * canvas. The receipt pipeline itself never imports this file — a snapped
 * receipt is just another `File`, handed to `useReceiptScan` like any other
 * upload.
 */

/** Longest edge kept from a snapped photo. */
export const CAPTURE_MAX_DIMENSION = 1600;

/** JPEG quality used when re-encoding a snapped photo. */
export const CAPTURE_JPEG_QUALITY = 0.85;

/**
 * Client-side ceiling for images.
 *
 * Mirrors `MAX_IMAGE_BYTES` in `lib/services/receipt-vision.ts`, which is the
 * authority: this only saves a doomed round trip.
 */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * Client-side ceiling for every other upload.
 *
 * Mirrors `MAX_RECEIPT_BYTES` in `lib/services/receipt-document.ts`.
 */
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

/** Accepted by the gallery picker. The server sniffs the real type. */
export const IMAGE_ACCEPT_ATTRIBUTE = 'image/*';

/**
 * True when this browser can open a camera from the page.
 *
 * `getUserMedia` is only exposed in a secure context, so an http origin on a
 * LAN — which is how a phone reaches a dev server — has no camera at all.
 */
export function isCameraSupported(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof navigator === 'undefined') return false;
  if (!navigator.mediaDevices?.getUserMedia) return false;
  if (typeof window.isSecureContext === 'boolean') return window.isSecureContext;
  return true;
}

/**
 * Turns a `getUserMedia` failure into something the reader can act on.
 *
 * The raw error names (`NotAllowedError`) mean nothing to someone who just
 * wanted to photograph a receipt, and every branch has to end with a way
 * forward: the gallery picker.
 */
export function cameraErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : '';

  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'Camera access was blocked. Allow it in your browser settings, or upload a photo from your gallery.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera was found on this device. Upload a photo from your gallery instead.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'The camera is busy in another app. Close it and try again, or upload a photo from your gallery.';
    case 'OverconstrainedError':
      return 'This camera cannot be used for scanning. Upload a photo from your gallery instead.';
    default:
      return 'We could not start the camera. Upload a photo from your gallery instead.';
  }
}

/**
 * Takes a photo of the receipt and returns it as a JPEG `File`.
 *
 * The file is handed to the same upload path as a picked one, so nothing
 * downstream — the scanner, the parser, the storage bucket — needs to know it
 * came from a camera.
 */
export async function captureReceiptPhoto(
  video: HTMLVideoElement,
  stream: MediaStream
): Promise<File> {
  const raw = await grabFrame(video, stream);
  const jpeg = await toJpeg(raw);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return new File([jpeg], `receipt-${stamp}.jpg`, { type: 'image/jpeg' });
}

/**
 * Grabs the current frame.
 *
 * `ImageCapture` takes a real photo, and the browser applies the sensor's
 * orientation to the file it returns. A canvas grab cannot do that, which is
 * why it is only the fallback for engines without `ImageCapture` — Safari
 * among them.
 */
async function grabFrame(video: HTMLVideoElement, stream: MediaStream): Promise<Blob> {
  const track = stream.getVideoTracks()[0];
  if (track && typeof ImageCapture !== 'undefined') {
    try {
      return await new ImageCapture(track).takePhoto();
    } catch {
      // Fall through to the canvas grab.
    }
  }
  return drawFrame(video);
}

/**
 * Draws the live frame onto a canvas and reads it back as a JPEG.
 */
function drawFrame(video: HTMLVideoElement): Promise<Blob> {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) {
    return Promise.reject(new Error('The camera has not produced a frame yet. Try again.'));
  }

  const quarterTurn = needsQuarterTurn(video);
  const canvas = document.createElement('canvas');
  canvas.width = quarterTurn ? height : width;
  canvas.height = quarterTurn ? width : height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return Promise.reject(new Error('This browser cannot read the camera frame.'));
  }

  if (quarterTurn) {
    // Rotating the destination rather than the source keeps the whole frame
    // inside the canvas: the source rect maps onto the swapped dimensions.
    ctx.translate(canvas.width, 0);
    ctx.rotate(Math.PI / 2);
  }
  ctx.drawImage(video, 0, 0, width, height);

  return canvasToBlob(canvas);
}

/**
 * True when the stream arrives on its side.
 *
 * Some mobile engines hand the camera over in the sensor's landscape
 * orientation while the preview is shown upright, so a canvas grab lands
 * rotated. A portrait viewport in front of a landscape stream is that case.
 */
function needsQuarterTurn(video: HTMLVideoElement): boolean {
  if (typeof window === 'undefined') return false;
  return video.videoWidth > video.videoHeight && window.innerHeight > window.innerWidth;
}

/**
 * Re-encodes a photo as a JPEG no larger than {@link CAPTURE_MAX_DIMENSION}.
 *
 * A full-resolution camera frame is several megabytes, which the scanner
 * rejects, and a receipt is text on paper that survives downscaling intact.
 */
async function toJpeg(blob: Blob): Promise<Blob> {
  if (typeof createImageBitmap !== 'function') return blob;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return blob;
  }

  try {
    const scale = Math.min(
      1,
      CAPTURE_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height)
    );
    if (scale === 1 && blob.type === 'image/jpeg') return blob;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const ctx = canvas.getContext('2d');
    if (!ctx) return blob;

    // A white matte: the page behind the photo would otherwise bleed into the
    // edges of the scan.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    return await canvasToBlob(canvas);
  } finally {
    bitmap.close();
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('We could not process that photo. Please try again.'));
        }
      },
      'image/jpeg',
      CAPTURE_JPEG_QUALITY
    );
  });
}
