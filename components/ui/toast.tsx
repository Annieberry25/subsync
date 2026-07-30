'use client';

import { useToast } from '@/lib/hooks/use-toast';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const styles = {
  success: 'border-emerald-500/30 text-emerald-400',
  error: 'border-rose-500/30 text-rose-400',
  info: 'border-indigo-500/30 text-indigo-400',
  warning: 'border-amber-500/30 text-amber-400',
};

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div 
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-4 sm:bottom-5 left-4 right-4 sm:left-auto sm:right-5 z-50 flex flex-col gap-2.5 max-w-sm sm:w-full mx-auto sm:mx-0 pointer-events-none"
    >
      {toasts.map((toast) => {
        const IconComponent = icons[toast.type];

        return (
          <div
            key={toast.id}
            role="alert"
            className={`pointer-events-auto glass-panel flex items-start gap-3 p-3.5 sm:p-4 rounded-2xl border shadow-2xl transition-all animate-in slide-in-from-bottom-5 fade-in duration-200 ${styles[toast.type]}`}
          >
            <IconComponent className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              {toast.title && (
                <h4 className="text-xs font-bold subsync-heading mb-0.5 leading-tight">{toast.title}</h4>
              )}
              <p className="text-xs subsync-subtitle font-medium leading-relaxed break-words">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              aria-label="Close notification"
              className="text-env-muted hover:text-env-heading transition-colors p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl hover:bg-env-button-sec shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
