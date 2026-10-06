'use client';

import { useToast } from '@/lib/hooks/use-toast';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

/**
 * Colour is carried by the icon and the text only.
 *
 * These previously included a `border-<colour>/40` and the container added a
 * `border`, so each toast drew attention as a coloured card. A notification that
 * competes with the page for attention stops reading as a confirmation, and the
 * status is already unambiguous from the icon. The surface stays the neutral
 * app token so it keeps the documented glass treatment.
 */
const styles = {
  success: 'text-[#14B8A6]',
  error: 'text-rose-400',
  info: 'text-[#14B8A6]',
  warning: 'text-amber-400',
};

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      data-toast-container=""
      // Sits above the floating dock (z-[70]) and clears both the dock and the
      // iOS home indicator. The offset collapses to a normal inset from lg up,
      // where there is no dock.
      className="fixed bottom-[calc(var(--spacing-dock)+var(--spacing-safe-b)+0.75rem)] lg:bottom-5 left-4 right-4 sm:left-auto sm:right-5 z-[80] flex flex-col gap-2.5 max-w-sm sm:w-full lg:mx-0 mx-auto pointer-events-none"
    >
      {toasts.map((toast) => {
        const IconComponent = icons[toast.type];

        return (
          <div
            key={toast.id}
            role="alert"
            className="pointer-events-auto transition-all duration-200"
          >
            <div
              key={toast.shakeKey || 'initial'}
              className={`flex items-start gap-3 p-3.5 sm:p-4 rounded-2xl bg-[#0D0F0F]/90 backdrop-blur-sm shadow-xl transition-all ${
                toast.shakeKey ? 'animate-subtle-shake' : 'animate-in slide-in-from-bottom-5 fade-in duration-200'
              } ${styles[toast.type]}`}
            >
              <IconComponent className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                {toast.title && (
                  <h4 className="text-xs font-bold subhalt-heading mb-0.5 leading-tight">{toast.title}</h4>
                )}
                <p className="text-xs subhalt-subtitle font-medium leading-relaxed break-words">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                aria-label="Close notification"
                className="text-current opacity-70 hover:opacity-100 transition-opacity min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-white/10 shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
