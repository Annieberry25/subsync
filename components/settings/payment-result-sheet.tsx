'use client';

import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import Sheet from '@/components/ui/sheet';
import { PLUS_PLAN } from '@/lib/constants/plus-plan';

export type PaymentResultState = 'checking' | 'success' | 'pending' | 'failed';

interface PaymentResultSheetProps {
  state: PaymentResultState | null;
  planExpiresAt?: string | null;
  subscriptionListed?: boolean;
  onClose: () => void;
  onRecheck: () => void;
}

function formatExpiry(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

const COPY: Record<
  PaymentResultState,
  { title: string; description: string }
> = {
  checking: {
    title: 'Confirming your payment',
    description: 'Verifying your transaction with Paystack…',
  },
  success: {
    title: 'Payment confirmed',
    description: `Your ${PLUS_PLAN.name} plan is now active.`,
  },
  pending: {
    title: 'Activating your plan',
    description: "We're confirming your payment. This usually takes a few seconds. Your plan activates automatically.",
  },
  failed: {
    title: 'Payment not completed',
    description: 'This checkout was not completed, so you have not been billed.',
  },
};

export function PaymentResultSheet({
  state,
  planExpiresAt,
  subscriptionListed = false,
  onClose,
  onRecheck,
}: PaymentResultSheetProps) {
  if (!state) return null;

  const copy = COPY[state];
  const expiryText = state === 'success' && planExpiresAt ? formatExpiry(planExpiresAt) : '';

  // The activating state deliberately carries no icon: the clock it used to
  // show read as a "refresh" cue next to a message about waiting, which is the
  // opposite of what the copy says to do.
  const icon =
    state === 'checking' ? (
      <Loader2 className="w-9 h-9 text-[#14B8A6] animate-spin" aria-hidden="true" />
    ) : state === 'success' ? (
      <CheckCircle2 className="w-9 h-9 text-[#14B8A6]" aria-hidden="true" />
    ) : state === 'failed' ? (
      <AlertTriangle className="w-9 h-9 text-[#D9363E]" aria-hidden="true" />
    ) : null;

  const footer =
    state === 'checking' ? null : state === 'success' ? (
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Link
          href="/subscriptions"
          onClick={onClose}
          className="w-full sm:w-auto px-4 py-3 min-h-[44px] rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-semibold transition-opacity text-center flex items-center justify-center"
        >
          View subscriptions
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="w-full sm:w-auto px-4 py-3 min-h-[44px] rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] text-[#94A3B8] hover:text-[#F5F7F6] border border-[#1A1D1D] text-xs font-medium transition-colors cursor-pointer"
        >
          Done
        </button>
      </div>
    ) : state === 'pending' ? (
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <button
          type="button"
          onClick={onRecheck}
          className="w-full sm:w-auto px-4 py-3 min-h-[44px] rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-semibold transition-opacity cursor-pointer"
        >
          Check again
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-full sm:w-auto px-4 py-3 min-h-[44px] rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] text-[#94A3B8] hover:text-[#F5F7F6] border border-[#1A1D1D] text-xs font-medium transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>
    ) : (
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Link
          href="/plans"
          onClick={onClose}
          className="w-full sm:w-auto px-4 py-3 min-h-[44px] rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-semibold transition-opacity text-center flex items-center justify-center"
        >
          Back to plans
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="w-full sm:w-auto px-4 py-3 min-h-[44px] rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] text-[#94A3B8] hover:text-[#F5F7F6] border border-[#1A1D1D] text-xs font-medium transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>
    );

  const bullets =
    state === 'success'
      ? [
          subscriptionListed ? 'Added to your subscription list' : null,
          'Unlimited subscriptions & full insights',
        ].filter((text): text is string => Boolean(text))
      : null;

  return (
    <Sheet
      open
      onClose={onClose}
      size="sm"
      title={copy.title}
      description={
        state === 'success' && expiryText
          ? `Your ${PLUS_PLAN.name} plan is active until ${expiryText}.`
          : copy.description
      }
      showClose
      dismissible
      footer={footer}
    >
      {(icon || bullets) && (
        <div className="flex flex-col items-center text-center gap-3 pb-3 pt-1">
          {icon}
          {bullets && (
            <ul className="space-y-1.5 text-xs text-[#94A3B8]">
              {bullets.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Sheet>
  );
}

export default PaymentResultSheet;
