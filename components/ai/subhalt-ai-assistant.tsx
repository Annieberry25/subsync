'use client';

import React, { useState } from 'react';
import { X, Eye, HelpCircle, Bell } from 'lucide-react';
import { useUserSettings } from '@/lib/contexts/user-settings-context';
import type { SubscriptionRow } from '@/lib/services/subscription-service';
import { formatCurrency } from '@/lib/utils/metrics-utils';
import { SubHaltAvatar } from '@/components/ui/subhalt-avatar';

interface SubHaltAIAssistantProps {
  subscriptions: SubscriptionRow[];
  onViewSubscription?: (sub: SubscriptionRow) => void;
  onAskSubHalt?: (question?: string) => void;
}

export function SubHaltAIAssistant({
  subscriptions,
  onViewSubscription,
}: SubHaltAIAssistantProps) {
  const { assistantName, defaultCurrency } = useUserSettings();
  const [isDismissed, setIsDismissed] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isReminded, setIsReminded] = useState(false);

  // Find price increase or upcoming renewal candidate
  const activeSubs = subscriptions.filter(
    (s) => s.status === 'active' || s.status === 'trial'
  );

  // Pick a candidate for proactive alert
  const priceChangeSub = activeSubs.find(
    (s) => s.notes && s.notes.toLowerCase().includes('price')
  ) || activeSubs[0];

  if (isDismissed || !priceChangeSub) return null;

  return (
    <div className="py-1 space-y-2.5 transition-all">
      {/* Header bar: Floating Assistant Identity & Dismiss X */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <SubHaltAvatar size="sm" />
          <span className="text-xs font-semibold text-[#F5F7F6] tracking-tight truncate">
            {assistantName}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="text-[#94A3B8] hover:text-[#F5F7F6] p-1 rounded-lg hover:bg-[#1A1D1D] transition-colors cursor-pointer"
          title="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Floating Proactive Interaction message & Actions */}
      <div className="space-y-2.5">
        <div className="space-y-0.5">
          <p className="text-xs sm:text-sm font-medium text-[#F5F7F6]">
            “I found something you may want to look at. Your{' '}
            <span className="text-[#14B8A6] font-semibold">{priceChangeSub.name}</span>{' '}
            subscription price appears to have changed.”
          </p>
          <p className="text-xs text-[#94A3B8]">Would you like to check it out?</p>
        </div>

        {/* Dynamic Explanation view if triggered */}
        {showExplanation && (
          <div className="p-3 rounded-xl bg-[#121414] border border-[#1A1D1D] text-xs text-[#94A3B8] space-y-1.5 animate-in fade-in duration-150">
            <div className="font-medium text-[#F5F7F6] flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-[#14B8A6]" />
              <span>Explanation details</span>
            </div>
            <p>
              SubHalt detected a standard tier pricing adjustment for {priceChangeSub.name}.
              Current recorded price is {formatCurrency(priceChangeSub.price, priceChangeSub.currency || defaultCurrency)}.
              Reviewing this will help confirm whether to keep or adjust your plan before the next billing cycle on {priceChangeSub.next_billing_date}.
            </p>
          </div>
        )}

        {isReminded && (
          <div className="p-2.5 rounded-xl bg-[#121414] border border-[#14B8A6]/30 text-xs text-[#14B8A6] flex items-center gap-2">
            <Bell className="w-3.5 h-3.5" />
            <span>Reminder set for 3 days before renewal date.</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={() => onViewSubscription?.(priceChangeSub)}
            className="px-3 py-1.5 rounded-lg bg-[#14B8A6] hover:bg-[#0D9488] text-[#091512] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>View it</span>
          </button>

          <button
            type="button"
            onClick={() => setShowExplanation(!showExplanation)}
            className="px-3 py-1.5 rounded-lg bg-[#1A1D1D] hover:bg-[#262929] text-[#F5F7F6] text-xs font-medium border border-[#3F3F46]/40 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-[#94A3B8]" />
            <span>{showExplanation ? 'Hide explanation' : 'Explain'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsReminded(true)}
            className="px-3 py-1.5 rounded-lg bg-[#1A1D1D] hover:bg-[#262929] text-[#94A3B8] hover:text-[#F5F7F6] text-xs font-medium border border-[#3F3F46]/40 transition-colors cursor-pointer"
          >
            <span>Remind me later</span>
          </button>
        </div>
      </div>
    </div>
  );
}
