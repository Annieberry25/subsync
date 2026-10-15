'use client';

import { useToast } from '@/lib/hooks/use-toast';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X, ChevronRight } from 'lucide-react';

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

/**
 * A neutral grey chip carrying the status, next to the copy.
 *
 * The chip is the only element that changes colour for a successful or
 * informational toast: a light square holding a near-black glyph. That keeps the
 * check legible on a grey surface, where a bare coloured check would not be, and
 * stops the status colour from bleeding into the text.
 *
 * Errors keep red on both the chip and the copy, because the text is what a
 * reader acts on and it has to be unmistakably the error. Warning keeps its amber
 * chip so the severity signal survives now that the text is white.
 */
const chips = {
  success: 'bg-[#F5F7F6] text-[#0B0D0D]',
  info: 'bg-[#F5F7F6] text-[#0B0D0D]',
  warning: 'bg-[#F59E0B] text-[#0B0D0D]',
  error: 'bg-[#D9363E] text-[#FFFFFF]',
};

/**
 * Copy colour. Success and info are white, because the reader can proceed and the
 * chip already says what happened. Warning and error carry their status colour in
 * the text itself, since the text is what gets acted on and a warning that reads
 * white reads like a confirmation.
 */
const copy = {
  success: 'text-[#F5F7F6]',
  info: 'text-[#F5F7F6]',
  warning: 'text-[#F59E0B]',
  error: 'text-[#D9363E]',
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
            {/*
              Slim. Padding is 4/6px vertical and the close control 24px, so a
              single-line toast is about 28px tall. The copy is clamped to two
              lines because wrapping is what actually drives the height on a
              phone: the same sentence that sits on one line at 400px wraps to
              four at 360px, and the toast grows with it.

              Alignment is centred at every width. Top-aligning on mobile looked
              right for a two-line toast but left the text hanging at the top when
              the copy was short, which is the common case.
            */}
            <div
              key={toast.shakeKey || 'initial'}
              className={`flex items-center gap-1.5 py-1 pl-1.5 pr-0.5 sm:gap-2 sm:py-1.5 sm:pl-2 sm:pr-1 rounded-[18px] bg-[#1C2020] border border-[#2A2F2F] shadow-xl transition-all ${
                toast.shakeKey ? 'animate-subtle-shake' : 'animate-in slide-in-from-bottom-5 fade-in duration-200'
              }`}
            >
              <span
                aria-hidden="true"
                className={`shrink-0 grid place-items-center w-[18px] h-[18px] rounded-full ${chips[toast.type]}`}
              >
                <IconComponent className="w-2.5 h-2.5" />
              </span>

              <div className={`flex-1 min-w-0 ${copy[toast.type]}`}>
                {toast.title && (
                  <h4 className="text-xs font-bold subhalt-heading leading-[1.35]">{toast.title}</h4>
                )}
                <p className="text-xs font-medium leading-[1.35] break-words line-clamp-2">
                  {toast.message}
                </p>
              </div>

              {toast.action && (
                <button
                  type="button"
                  onClick={() => {
                    toast.action?.onClick();
                    removeToast(toast.id);
                  }}
                  aria-label={toast.action.ariaLabel ?? toast.action.label}
                  className="relative shrink-0 grid grid-flow-col items-center gap-0.5 h-6 pl-2 pr-1 rounded-full text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-white/10 transition-colors cursor-pointer before:absolute before:-inset-1 before:content-['']"
                >
                  <span className="text-[11px] font-semibold leading-none">
                    {toast.action.label}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}

              {/*
                The close X is dropped once the toast has an action. The chevron
                dismisses on click as well as navigating, so the X becomes a
                second identical affordance and the row is carrying a control the
                reader does not need. Toasts without an action keep it, since
                nothing else closes them early.
              */}
              {!toast.action && (
                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  aria-label="Close notification"
                  className="relative shrink-0 grid place-items-center w-6 h-6 rounded-full text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-white/10 transition-colors cursor-pointer before:absolute before:-inset-1 before:content-['']"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
