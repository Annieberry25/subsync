'use client';

import { Loader2 } from 'lucide-react';
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
    btnBg: 'bg-[#D9363E] hover:bg-[#B91C1C] text-white',
  },
  warning: {
    btnBg: 'bg-[#F59E0B] hover:bg-[#D97706] text-white',
  },
  info: {
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

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      size="sm"
      /* The footer is a short row of pills, so the hairline above it only adds
         weight. The close X stays: the Cancel button is the deliberate answer,
         while the X is the reflex to back out of a prompt you opened by accident. */
      hideFooterDivider
      /* A prompt must be answered, so it stays centred on a phone too. The
         default placement degrades to a bottom sheet, which put a logout question
         at the bottom of the screen instead of in front of the reader. */
      placement="modal"
      /* A prompt carrying a Cancel button and a close control must not be
         answered by a stray tap beside it. Both of those remain deliberate ways
         out, as does Escape. */
      dismissOnBackdrop={false}
      /* The title is the question on its own. It used to lead a 40px icon tile,
         which read as a second, louder heading. */
      title={title}
      description={description}
      footer={
        /*
          One row at every width, with Cancel on the left and Confirm on the
          right, spread apart rather than sitting shoulder to shoulder. Stacking
          them full-width on a phone made the prompt twice the height it needed.
        */
        <div className="flex flex-row items-center justify-between gap-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2.5 min-h-[44px] rounded-full text-xs font-semibold text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] transition-colors cursor-pointer flex items-center justify-center border border-[#1A1D1D]"
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
            className={`px-5 py-2.5 min-h-[44px] rounded-full text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60 ${currentVariant.btnBg}`}
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
