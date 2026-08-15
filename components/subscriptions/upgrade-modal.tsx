'use client';

import React from 'react';
import { X, Check } from 'lucide-react';
import { useUserSettings } from '@/lib/contexts/user-settings-context';
import { useToast } from '@/lib/hooks/use-toast';
import { useInbox } from '@/lib/contexts/inbox-context';
import { recordActivity } from '@/lib/services/activity-service';
import { createSubscription } from '@/lib/services/subscription-service';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
}

export default function UpgradeModal({
  isOpen,
  onClose,
  title = "You’ve reached your 2-subscription limit.",
  description = "Upgrade to Plus to track unlimited subscriptions.",
}: UpgradeModalProps) {
  const { updatePlanTier } = useUserSettings();
  const { toast } = useToast();
  const { addInboxItem } = useInbox();

  if (!isOpen) return null;

  const handleUpgrade = async () => {
    try {
      await createSubscription({
        name: 'SubHalt',
        price: 4.99,
        currency: 'USD',
        billing_cycle: 'monthly',
        category: 'Software',
        next_billing_date: '2026-09-15',
        start_date: new Date().toISOString().split('T')[0],
        status: 'active',
        payment_method: 'Mastercard •••• 6730',
        provider_url: 'https://subhalt.com',
        notes: 'SubHalt subscription auto-renews monthly at $4.99.',
      });

      await updatePlanTier('plus');

      recordActivity({
        subscriptionName: 'SubHalt',
        type: 'added',
        title: 'SubHalt Subscription Created',
        description: 'SubHalt — $4.99 — Paid',
        amount: 4.99,
        currency: 'USD',
      });

      addInboxItem({
        type: 'plan_update',
        title: 'SubHalt Subscription Active',
        description: 'You subscribed to SubHalt. Your SubHalt plan is now active and will renew according to your selected billing cycle.',
        actionType: 'view',
        actionLabel: 'View subscription',
        subscriptionName: 'SubHalt',
        subscriptionPrice: 4.99,
        currency: 'USD',
      });

      toast.success('Your workspace has been upgraded to SubHalt Plus!', 'Subscribed to Plus');
      onClose();
    } catch {
      toast.error('Failed to update plan. Please try again.', 'Upgrade Failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
        className="w-full max-w-2xl bg-[#0F1111] border border-[#1A1D1D] rounded-2xl p-6 sm:p-7 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden relative"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close upgrade modal"
          className="absolute top-5 right-5 w-8 h-8 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] flex items-center justify-center text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer border border-[#1A1D1D]"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Title & Description */}
        <div className="space-y-1.5 pr-8">
          <h2 id="upgrade-modal-title" className="text-xl font-bold text-[#F5F7F6] tracking-tight">
            {title}
          </h2>

          <p className="text-xs text-[#94A3B8] leading-relaxed">
            {description}
          </p>
        </div>

        {/* Plan Comparison Grid (Google One Layout - Buttons BEFORE Feature List) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Free Plan Card */}
          <div className="p-5 rounded-xl bg-[#0B0D0D] border border-[#1A1D1D] space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-baseline justify-between border-b border-[#1A1D1D] pb-3">
                <div>
                  <h3 className="text-base font-semibold text-[#F5F7F6]">Free</h3>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">Track up to 2 subscriptions</p>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold text-[#F5F7F6]">$0</span>
                  <span className="text-xs text-[#94A3B8] font-normal">/mo</span>
                </div>
              </div>

              {/* Action Button BEFORE Feature List */}
              <button
                type="button"
                disabled
                className="w-full py-2.5 rounded-xl bg-[#1A1D1D] text-[#94A3B8] text-xs font-medium cursor-default text-center"
              >
                Current plan
              </button>

              <div className="space-y-2 pt-1">
                <ul className="space-y-2 text-xs text-[#94A3B8]">
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-[#14B8A6] shrink-0 mt-0.5" />
                    <span>Track up to 2 active subscriptions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-[#14B8A6] shrink-0 mt-0.5" />
                    <span>Provider link, receipt import & manual entry</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-[#14B8A6] shrink-0 mt-0.5" />
                    <span>Renewal & trial date tracking</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-[#14B8A6] shrink-0 mt-0.5" />
                    <span>Basic payment reminders</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Plus Plan Card */}
          <div className="p-5 rounded-xl bg-[#0B0D0D] border border-[#1A1D1D] space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-baseline justify-between border-b border-[#1A1D1D] pb-3">
                <div>
                  <h3 className="text-base font-semibold text-[#F5F7F6]">Plus</h3>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">Unlimited management tools</p>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold text-[#F5F7F6]">$4.99</span>
                  <span className="text-xs text-[#94A3B8] font-normal">/mo</span>
                </div>
              </div>

              {/* Action Button BEFORE Feature List */}
              <button
                type="button"
                onClick={handleUpgrade}
                className="w-full py-2.5 rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-semibold transition-opacity cursor-pointer shadow-sm text-center"
              >
                Upgrade to Plus
              </button>

              <div className="space-y-2 pt-1">
                <p className="text-[11px] font-medium text-[#F5F7F6]">Everything in Free, plus:</p>
                <ul className="space-y-2 text-xs text-[#94A3B8]">
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-[#14B8A6] shrink-0 mt-0.5" />
                    <span className="text-[#F5F7F6] font-medium">Unlimited subscriptions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-[#14B8A6] shrink-0 mt-0.5" />
                    <span>Advanced reminder controls</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-[#14B8A6] shrink-0 mt-0.5" />
                    <span>Advanced Smart Insights</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-[#14B8A6] shrink-0 mt-0.5" />
                    <span>Export subscription data (CSV/JSON)</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#1A1D1D]">
          <a
            href="/plans?from=/settings?section=plan"
            onClick={onClose}
            className="text-xs text-[#94A3B8] hover:text-[#F5F7F6] underline transition-colors"
          >
            View Plans
          </a>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] text-[#94A3B8] hover:text-[#F5F7F6] border border-[#1A1D1D] text-xs font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
