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
      iconBg: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
      btnBg: 'bg-rose-600 hover:bg-rose-500 focus:ring-rose-500/50',
    },
    warning: {
      icon: AlertTriangle,
      iconBg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
      btnBg: 'bg-amber-600 hover:bg-amber-500 focus:ring-amber-500/50',
    },
    info: {
      icon: RefreshCw,
      iconBg: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
      btnBg: 'bg-indigo-600 hover:bg-indigo-500 focus:ring-indigo-500/50',
    },
  };

  const currentVariant = variantStyles[variant];
  const Icon = currentVariant.icon;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md glass-panel rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center ${currentVariant.iconBg}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 id="confirm-dialog-title" className="text-base font-bold subsync-heading tracking-tight">
                {title}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 rounded-xl text-env-muted hover:text-env-heading hover:bg-env-button-sec transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p id="confirm-dialog-desc" className="text-xs subsync-subtitle leading-relaxed">
          {description}
        </p>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-env-body hover:text-env-heading hover:bg-env-button-sec transition-colors cursor-pointer"
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
            className={`px-5 py-2.5 rounded-2xl text-white text-xs font-bold flex items-center gap-2 shadow-lg transition-all focus:outline-none focus:ring-2 cursor-pointer ${currentVariant.btnBg}`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
