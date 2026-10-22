'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Image as ImageIcon, Loader2, RefreshCw, SwitchCamera, X } from 'lucide-react';
import {
  cameraErrorMessage,
  captureReceiptPhoto,
  isCameraSupported,
} from '@/lib/utils/receipt-camera';

export interface ReceiptCameraCaptureProps {
  open: boolean;
  onClose: () => void;
  /** Receives the snapped photo, already resized and encoded as a JPEG. */
  onCapture: (file: File) => void;
  /** Opens the device's own camera app, for browsers without an in-app one. */
  onUseDeviceCamera?: () => void;
  /** Opens the gallery picker. */
  onUseGallery?: () => void;
}

type CameraStatus = 'starting' | 'live' | 'unavailable';

const UNSUPPORTED_MESSAGE =
  'This browser cannot open the camera here. Upload a photo from your gallery instead.';

/**
 * The portal can only be created in the browser.
 *
 * `useSyncExternalStore` rather than a `mounted` flag set from an effect: the
 * flag would be a second render pass for no reason, and the store is the
 * pattern the rest of the app already uses for this.
 */
const emptySubscribe = () => () => {};
const useIsMounted = () => useSyncExternalStore(emptySubscribe, () => true, () => false);

/**
 * Full-screen camera view for snapping a receipt.
 *
 * The photo it produces is an ordinary `File`, so the scanner, the parser and
 * the storage bucket cannot tell it apart from a picked image.
 *
 * The overlay is portalled to the body: it sits above the sheet that opened it,
 * and a `fixed` panel inside a sheet would be trapped by the sheet's own
 * transform.
 */
export default function ReceiptCameraCapture({
  open,
  onClose,
  onCapture,
  onUseDeviceCamera,
  onUseGallery,
}: ReceiptCameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const facingRef = useRef<'environment' | 'user'>('environment');

  const [status, setStatus] = useState<CameraStatus>(() =>
    isCameraSupported() ? 'starting' : 'unavailable'
  );
  const [error, setError] = useState<string | null>(() =>
    isCameraSupported() ? null : UNSUPPORTED_MESSAGE
  );
  const [isCapturing, setIsCapturing] = useState(false);
  const [canFlip, setCanFlip] = useState(false);

  const mounted = useIsMounted();

  const stopStream = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
    }
  }, []);

  const startStream = useCallback(
    async (facing: 'environment' | 'user') => {
      stopStream();
      setStatus('starting');
      setError(null);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        streamRef.current = stream;

        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          try {
            await video.play();
          } catch {
            // Autoplay can be refused even for a muted stream the user asked
            // for. The frame is still there to grab.
          }
        }

        setStatus('live');

        /*
         * Labels only become readable once a camera has been granted, so this
         * runs after the stream is live. A browser that refuses to enumerate
         * its devices loses the flip button, not the camera.
         */
        try {
          const devices = await navigator.mediaDevices.enumerateDevices?.();
          setCanFlip(
            (devices ?? []).filter((device) => device.kind === 'videoinput').length > 1
          );
        } catch {
          setCanFlip(false);
        }
      } catch (err) {
        setStatus('unavailable');
        setError(cameraErrorMessage(err));
      }
    },
    [stopStream]
  );

  useEffect(() => {
    if (!open) {
      stopStream();
      return;
    }

    // The unsupported case is settled by the initial state, so there is
    // nothing to ask the browser for.
    if (!isCameraSupported()) return;

    void startStream(facingRef.current);

    return () => {
      stopStream();
    };
  }, [open, startStream, stopStream]);

  /*
   * Escape closes the camera, not the sheet underneath it. The sheet listens
   * for Escape on the window, so this has to stop the event in the capture
   * phase before it reaches that listener.
   */
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [open, onClose]);

  const handleCapture = useCallback(async () => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream || isCapturing) return;

    setIsCapturing(true);
    try {
      const file = await captureReceiptPhoto(video, stream);
      onCapture(file);
      onClose();
    } catch (err) {
      // The camera is still running, so this is a recoverable message rather
      // than a reason to tear the view down.
      setError(err instanceof Error ? err.message : 'We could not take that photo. Try again.');
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, onCapture, onClose]);

  const handleFlip = useCallback(() => {
    const next = facingRef.current === 'environment' ? 'user' : 'environment';
    facingRef.current = next;
    void startStream(next);
  }, [startStream]);

  if (!open || !mounted) return null;

  const isUnavailable = status === 'unavailable';

  const overlay = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scan receipt"
      className="fixed inset-0 z-[90] flex flex-col bg-black"
    >
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          aria-label="Camera preview"
          className="w-full h-full object-cover bg-black"
        />

        {/* Framing guide: the receipt is a tall document, so the guide is too. */}
        {!isUnavailable && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-8">
            <div className="w-full max-w-xs aspect-[3/4] rounded-3xl border-2 border-white/25" />
          </div>
        )}

        {status === 'starting' && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/70 text-xs text-[#F5F7F6]">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Starting camera…</span>
          </div>
        )}

        {isUnavailable && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/85 px-6">
            <div className="w-full max-w-sm space-y-4 text-center">
              <Camera className="w-7 h-7 text-[#94A3B8] mx-auto" />
              <p className="text-xs text-[#F5F7F6]">{error}</p>
              <div className="flex flex-col gap-2">
                {onUseDeviceCamera && (
                  <button
                    type="button"
                    onClick={onUseDeviceCamera}
                    className="w-full min-h-[44px] rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-bold transition-opacity cursor-pointer"
                  >
                    Open device camera
                  </button>
                )}
                {onUseGallery && (
                  <button
                    type="button"
                    onClick={onUseGallery}
                    className="w-full min-h-[44px] rounded-xl border border-[#1A1D1D] text-xs font-medium text-[#F5F7F6] hover:bg-[#0D0F0F] transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>Choose from gallery</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void startStream(facingRef.current)}
                  className="w-full min-h-[44px] rounded-xl text-xs font-medium text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Try again</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="shrink-0 bg-black px-4 pt-3 pb-[max(1rem,var(--spacing-safe-b))]">
        {error && !isUnavailable && (
          <p className="mb-3 text-center text-[11px] text-[#F59E0B]">{error}</p>
        )}

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close camera"
            className="w-11 h-11 rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#94A3B8] hover:text-[#F5F7F6] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleCapture}
            disabled={isCapturing || status !== 'live'}
            aria-label="Take photo"
            className="w-16 h-16 rounded-full border-4 border-[#14B8A6] bg-[#14B8A6]/25 flex items-center justify-center transition-opacity cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isCapturing ? (
              <Loader2 className="w-6 h-6 text-[#14B8A6] animate-spin" />
            ) : (
              <span className="w-11 h-11 rounded-full bg-[#14B8A6]" />
            )}
          </button>

          <button
            type="button"
            onClick={handleFlip}
            disabled={!canFlip}
            aria-label="Switch camera"
            className="w-11 h-11 rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#94A3B8] hover:text-[#F5F7F6] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <SwitchCamera className="w-4 h-4" />
          </button>
        </div>

        <p className="mt-3 text-center text-[11px] text-[#94A3B8]">
          Fit the whole receipt inside the frame
        </p>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
