'use client';

import { AlertTriangle, Trash2, RefreshCw, Loader2 } from 'lucide-react';
import Sheet from '@/components/ui/sheet';

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
  children?: React.ReactNode;
}

const variantStyles = {
  danger: {
    Icon: Trash2,
    iconBg: 'bg-[#D9363E]/10 border-[#D9363E]/20 text-[#D9363E]',
    btnBg: 'bg-[#D9363E] hover:bg-[#B91C1C] text-white',
  },
  warning: {
    Icon: AlertTriangle,
    iconBg: 'bg-[#F59E0B]/10 border-[#F59E0B]/20 text-[#F59E0B]',
    btnBg: 'bg-[#F59E0B] hover:bg-[#D97706] text-white',
  },
  info: {
    Icon: RefreshCw,
    iconBg: 'bg-[#14B8A6]/15 border-[#14B8A6]/30 text-[#14B8A6]',
    btnBg: 'bg-[#14B8A6] hover:opacity-90 text-[#091512] font-semibold',
  },
} as const;

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
  children,
}: ConfirmDialogProps) {
  const currentVariant = variantStyles[variant];
  const Icon = currentVariant.Icon;

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      size="sm"
      /* The icon rides along with the title so it keeps its leading position
         in the header; Sheet owns the accessible name and description. */
      title={
        <span className="flex items-center gap-3.5 min-w-0 pr-2">
          <span
            className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${currentVariant.iconBg}`}
          >
            <Icon className="w-5 h-5" />
          </span>
          {title}
        </span>
      }
      description={description}
      footer={
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-auto px-5 py-3 min-h-[44px] rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] transition-colors cursor-pointer flex items-center justify-center border border-[#1A1D1D]"
          >
            {cancelText}
          </button>

          <button
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
      }
    >
      {children}
    </Sheet>
  );
}
