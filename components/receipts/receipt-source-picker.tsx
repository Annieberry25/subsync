'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, FileText, Image as ImageIcon, Upload, X } from 'lucide-react';
import { ACCEPT_ATTRIBUTE } from '@/lib/hooks/use-receipt-scan';
import {
  IMAGE_ACCEPT_ATTRIBUTE,
  MAX_IMAGE_BYTES,
  MAX_RECEIPT_BYTES,
  isCameraSupported,
} from '@/lib/utils/receipt-camera';
import ReceiptCameraCapture from './receipt-camera-capture';

export interface ReceiptSourcePickerProps {
  file: File | null;
  /** Receives the chosen receipt, or `null` when the selection is cleared. */
  onFileChange: (file: File | null) => void;
  /**
   * Reports why a selection was refused, or `null` when one was accepted.
   *
   * The picker shows its own message; this is for the host screen, which
   * usually wants to clear whatever it was complaining about.
   */
  onError?: (message: string | null) => void;
  label?: string;
  hint?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Where a receipt comes from: the camera, the gallery, or a file.
 *
 * Both receipt modals share this so the two flows cannot drift apart. The
 * result is always a plain `File`, which is what the scanner already accepts.
 */
export default function ReceiptSourcePicker({
  file,
  onFileChange,
  onError,
  label,
  hint = 'PDF invoices, screenshots, photos, or text files (max 10MB)',
}: ReceiptSourcePickerProps) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const deviceCameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptFile = useCallback(
    (selected: File | null) => {
      if (!selected) return;

      const isImage = selected.type.startsWith('image/');
      const limit = isImage ? MAX_IMAGE_BYTES : MAX_RECEIPT_BYTES;
      if (selected.size > limit) {
        const message = isImage
          ? 'That image is larger than the 8MB limit. Try a smaller photo.'
          : 'File size exceeds maximum allowed limit of 10MB.';
        setError(message);
        onError?.(message);
        return;
      }

      setError(null);
      onError?.(null);
      onFileChange(selected);
      setSourcesOpen(false);
    },
    [onError, onFileChange]
  );

  /*
   * The chosen file is previewed from an object URL, so the receipt can be
   * seen without re-reading it. The URL is revoked when it is replaced, so a
   * long session picking receipt after receipt does not leak a blob per pick.
   */
  const previewUrl = useMemo(() => {
    if (!file || !file.type.startsWith('image/')) return null;
    if (typeof URL.createObjectURL !== 'function') return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    if (!previewUrl) return;
    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>, source: 'file' | 'gallery' | 'camera') => {
    const selected = e.target.files?.[0];
    // Reset the input so re-picking the same file fires change again.
    e.target.value = '';
    if (!selected) return;
    if (source === 'gallery' && !selected.type.startsWith('image/')) {
      const message = 'Please choose an image file.';
      setError(message);
      onError?.(message);
      return;
    }
    acceptFile(selected);
  };

  const clearFile = () => {
    setError(null);
    onError?.(null);
    onFileChange(null);
  };

  /**
   * Opens the in-app camera where there is one, and the device's own camera
   * app where there is not — a phone on http, or a browser with no media
   * support at all.
   */
  const handleScanClick = () => {
    if (isCameraSupported()) {
      setCameraOpen(true);
      return;
    }
    deviceCameraInputRef.current?.click();
  };

  const handleCaptured = (captured: File) => {
    setCameraOpen(false);
    acceptFile(captured);
  };

  const openDeviceCamera = () => {
    setCameraOpen(false);
    deviceCameraInputRef.current?.click();
  };

  const openGallery = () => {
    setCameraOpen(false);
    galleryInputRef.current?.click();
  };

  return (
    <div className="space-y-3">
      {label && (
        <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider block">
          {label}
        </span>
      )}

      {/* Upload area. Tapping it brings out the three sources; a file dropped
          onto it still arrives directly. */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          acceptFile(e.dataTransfer.files?.[0] ?? null);
        }}
        className={`relative border-2 border-dashed rounded-2xl p-4 text-center transition-colors ${
          isDragging ? 'border-[#14B8A6] bg-[#14B8A6]/5' : 'border-[#1A1D1D] hover:border-[#14B8A6] bg-[#0D0F0F]/50'
        }`}
      >
        <button
          type="button"
          onClick={() => setSourcesOpen((open) => !open)}
          aria-expanded={sourcesOpen}
          aria-controls="receipt-source-options"
          aria-label="Show receipt source options"
          className="w-full flex flex-col items-center justify-center space-y-1.5 cursor-pointer"
        >
          <Upload className="w-6 h-6 text-[#14B8A6]" />
          <span className="text-xs font-semibold text-[#F5F7F6]">
            {file ? 'Choose a different file' : 'Click or drop a receipt file here'}
          </span>
          <span className="text-[11px] text-[#94A3B8]">{hint}</span>
        </button>
      </div>

      {/* The three sources, together, once the upload area is tapped. */}
      {sourcesOpen && (
        <div id="receipt-source-options" className="grid grid-cols-1 gap-2">
          <button
            type="button"
            onClick={() => {
              setSourcesOpen(false);
              handleScanClick();
            }}
            className="min-h-[44px] px-3 py-2.5 rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-bold flex items-center justify-center gap-2 transition-opacity cursor-pointer"
          >
            <Camera className="w-4 h-4 shrink-0" />
            <span>Scan with camera</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSourcesOpen(false);
              galleryInputRef.current?.click();
            }}
            className="min-h-[44px] px-3 py-2.5 rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] hover:border-[#14B8A6] text-[#F5F7F6] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <ImageIcon className="w-4 h-4 shrink-0 text-[#14B8A6]" />
            <span>Choose from gallery</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSourcesOpen(false);
              fileInputRef.current?.click();
            }}
            className="min-h-[44px] px-3 py-2.5 rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] hover:border-[#14B8A6] text-[#F5F7F6] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <FileText className="w-4 h-4 shrink-0 text-[#14B8A6]" />
            <span>Import file</span>
          </button>
        </div>
      )}

      {/* The chosen receipt */}
      {file && (
        <div className="flex items-center gap-3 rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] p-2.5">
          {previewUrl ? (
            /* A receipt is a picture of a document, so an <img> is the right
               element here. The blob URL is revoked when the file changes. */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Selected receipt"
              className="w-12 h-12 rounded-lg object-cover bg-[#1A1D1D] shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-[#1A1D1D] flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-[#94A3B8]" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[#F5F7F6] truncate">{file.name}</p>
            <p className="text-[11px] text-[#94A3B8]">{formatBytes(file.size)}</p>
          </div>
          <button
            type="button"
            onClick={clearFile}
            aria-label="Remove selected receipt"
            className="w-9 h-9 shrink-0 rounded-lg border border-[#1A1D1D] text-[#94A3B8] hover:text-[#F5F7F6] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && <p className="text-xs text-[#D9363E]">{error}</p>}

      {/* Hidden inputs for the gallery, the device camera, and files. */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        onChange={(e) => handleInput(e, 'file')}
        aria-label="Upload receipt file"
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept={IMAGE_ACCEPT_ATTRIBUTE}
        onChange={(e) => handleInput(e, 'gallery')}
        aria-label="Choose a receipt from your gallery"
        className="hidden"
      />
      <input
        ref={deviceCameraInputRef}
        type="file"
        accept={IMAGE_ACCEPT_ATTRIBUTE}
        capture="environment"
        onChange={(e) => handleInput(e, 'camera')}
        aria-label="Take a receipt photo"
        className="hidden"
      />

      <ReceiptCameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={handleCaptured}
        onUseDeviceCamera={openDeviceCamera}
        onUseGallery={openGallery}
      />
    </div>
  );
}
