'use client';

import { useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, RefreshCw, X, Loader2 } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
      setTimeout(() => confirmBtnRef.current?.focus(), 50);
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: Trash2,
      iconBg: 'bg-[#EF4444]/10 border-[#EF4444]/20 text-[#EF4444]',
      btnBg: 'bg-[#EF4444] hover:bg-[#DC2626] text-white',
    },
    warning: {
      icon: AlertTriangle,
      iconBg: 'bg-[#F59E0B]/10 border-[#F59E0B]/20 text-[#F59E0B]',
      btnBg: 'bg-[#F59E0B] hover:bg-[#D97706] text-white',
    },
    info: {
      icon: RefreshCw,
      iconBg: 'bg-[#4F46E5]/10 border-[#4F46E5]/20 text-[#4F46E5]',
      btnBg: 'bg-[#4F46E5] hover:bg-[#4338CA] text-white',
    },
  };

  const currentVariant = variantStyles[variant];
  const Icon = currentVariant.icon;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#171A21] border border-[#2B313D] rounded-[20px] p-6 sm:p-6.5 shadow-xl flex flex-col"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3.5 min-w-0 pr-2">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${currentVariant.iconBg}`}>
              <Icon className="w-5 h-5" />
            </div>
            <h3 id="confirm-dialog-title" className="text-[25px] font-bold text-white tracking-tight leading-[32px]">
              {title}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-9 h-9 min-h-[40px] min-w-[40px] rounded-xl bg-[#1D222B] hover:bg-[#2B313D] text-[#6F7787] hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-[#2B313D] shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p id="confirm-dialog-desc" className="text-[15px] text-[#A1AAB8] leading-[25px] mb-6">
          {description}
        </p>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-auto px-5 py-3 min-h-[44px] rounded-xl text-xs font-semibold text-[#A1AAB8] hover:text-white hover:bg-[#2B313D] transition-colors cursor-pointer flex items-center justify-center"
          >
            {cancelText}
          </button>

          <button
            ref={confirmBtnRef}
            type="button"
            onClick={async () => {
              await onConfirm();
              onClose();
            }}
            disabled={loading}
            className={`w-full sm:w-auto px-6 py-3 min-h-[44px] rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${currentVariant.btnBg}`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
