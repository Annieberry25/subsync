'use client';

import { useState } from 'react';
import { X, ExternalLink, CheckCircle2, AlertTriangle, ShieldCheck, ArrowRight } from 'lucide-react';
import type { SubscriptionRow } from '@/lib/services/subscription-service';
import { getCatalogProviderByName } from '@/lib/constants/provider-catalog';
import ProviderLogo from '@/components/bills/provider-logo';
import { formatCurrency } from '@/lib/utils/metrics-utils';

interface SubHaltAssistanceModalProps {
  subscription: SubscriptionRow | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmCancellation: (subscription: SubscriptionRow, method: 'automatic' | 'user_assisted') => Promise<void>;
}

export default function SubHaltAssistanceModal({
  subscription,
  isOpen,
  onClose,
  onConfirmCancellation,
}: SubHaltAssistanceModalProps) {
  const [step, setStep] = useState<'confirm' | 'assistance' | 'completed'>('confirm');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !subscription) return null;

  const catalogEntry = getCatalogProviderByName(subscription.name);
  const cancellationCapability = catalogEntry?.cancellationCapability || 'assisted';
  const isAutomatic = cancellationCapability === 'automatic';

  const cancellationUrl =
    catalogEntry?.cancellationUrl ||
    subscription.provider_url ||
    catalogEntry?.officialWebsite ||
    'https://google.com';

  const customSteps = catalogEntry?.cancellationSteps || [
    `Open ${subscription.name}'s account or billing portal.`,
    'Sign in with your registered account credentials.',
    'Navigate to Account Settings -> Subscriptions & Billing.',
    'Select Cancel Subscription or Disable Auto-Renewal.',
    'Confirm cancellation on the provider page.',
  ];

  const priceFormatted = formatCurrency(Number(subscription.price), subscription.currency);

  const handleStartCancel = async () => {
    if (isAutomatic) {
      setLoading(true);
      await onConfirmCancellation(subscription, 'automatic');
      setLoading(false);
      setStep('completed');
    } else {
      setStep('assistance');
    }
  };

  const handleUserConfirmedManual = async () => {
    setLoading(true);
    await onConfirmCancellation(subscription, 'user_assisted');
    setLoading(false);
    setStep('completed');
  };

  const handleOpenProvider = () => {
    let targetUrl = cancellationUrl.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `https://${targetUrl}`;
    }
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#090C0B] border border-[#161F1D] rounded-2xl p-5 sm:p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-200 text-[#F5F7F6]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#161F1D] pb-3.5">
          <div className="flex items-center gap-3">
            <ProviderLogo name={subscription.name} officialUrl={cancellationUrl} size="md" />
            <div>
              <h3 className="text-base font-bold text-[#F5F7F6]">
                {step === 'confirm'
                  ? `Cancel ${subscription.name}?`
                  : step === 'assistance'
                  ? 'SubHalt Assistance'
                  : 'Cancellation Confirmed'}
              </h3>
              <p className="text-xs text-[#94A3B8]">
                {priceFormatted} / {subscription.billing_cycle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-xl bg-[#121615] border border-[#161F1D] text-[#94A3B8] hover:text-[#F5F7F6] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* STEP 1: INITIAL CONFIRMATION */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#0F1412] border border-[#161F1D] space-y-2">
              <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                <span>Subscription Name:</span>
                <strong className="text-[#F5F7F6] font-semibold">{subscription.name}</strong>
              </div>
              <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                <span>Recurring Amount:</span>
                <strong className="text-[#F5F7F6] font-semibold">{priceFormatted}</strong>
              </div>
              <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                <span>Billing Frequency:</span>
                <strong className="text-[#F5F7F6] font-semibold capitalize">{subscription.billing_cycle}</strong>
              </div>
              <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                <span>Next Billing Date:</span>
                <strong className="text-[#F5F7F6] font-semibold">{subscription.next_billing_date}</strong>
              </div>
            </div>

            <p className="text-xs text-[#94A3B8] leading-relaxed">
              {isAutomatic
                ? `SubHalt will execute automated cancellation for ${subscription.name}.`
                : `SubHalt will guide you through ${subscription.name}'s official cancellation process.`}
            </p>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-[#161F1D] text-xs font-semibold text-[#94A3B8] hover:text-[#F5F7F6]"
              >
                Keep Subscription
              </button>
              <button
                type="button"
                onClick={handleStartCancel}
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-[#D9363E] hover:bg-[#C02B33] text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>{isAutomatic ? 'Proceed with Cancellation' : 'Cancel Subscription'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: SUBHALT ASSISTANCE (HONEST MANUAL / ASSISTED GUIDANCE) */}
        {step === 'assistance' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-[#121816] border border-[#1A2522] flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-[#14B8A6] shrink-0 mt-0.5" />
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                SubHalt can’t cancel this subscription automatically, but we can guide you through the cancellation steps directly on {subscription.name}&apos;s portal.
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-[#F5F7F6] tracking-tight block">
                Here&apos;s how to cancel it:
              </span>
              <ol className="space-y-2 text-xs text-[#94A3B8]">
                {customSteps.map((stepText, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[#0F1412] border border-[#161F1D]">
                    <span className="w-5 h-5 rounded-full bg-[#14B8A6]/20 text-[#14B8A6] font-bold text-[11px] flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-[#F5F7F6] leading-relaxed">{stepText}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="pt-3 border-t border-[#161F1D] flex flex-col sm:flex-row items-center gap-2.5 justify-between">
              <button
                type="button"
                onClick={handleOpenProvider}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#051310] text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Open Provider Page</span>
                <ExternalLink className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleUserConfirmedManual}
                disabled={loading}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#121615] hover:bg-[#1A201E] border border-[#161F1D] text-[#F5F7F6] text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                <span>I&apos;ve cancelled it</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: COMPLETED CONFIRMATION */}
        {step === 'completed' && (
          <div className="space-y-4 text-center py-4">
            <div className="w-12 h-12 rounded-full bg-[#10B981]/20 border border-[#10B981]/40 flex items-center justify-center text-[#10B981] mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div>
              <h4 className="text-base font-bold text-[#F5F7F6]">Cancellation Confirmed</h4>
              <p className="text-xs text-[#94A3B8] mt-1">
                {isAutomatic
                  ? `Cancelled by SubHalt on ${new Date().toLocaleDateString()}`
                  : `User assisted cancellation confirmed on ${new Date().toLocaleDateString()}`}
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#051310] text-xs font-bold transition-all"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
