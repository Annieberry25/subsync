'use client';

import { useMemo, useState } from 'react';
import { Sparkles, Plus, Check, X } from 'lucide-react';
import type { BillPayment } from '@/lib/types/bills.types';
import ProviderLogo from '@/components/bills/provider-logo';
import { formatCurrencyAmount } from '@/lib/services/currency-service';
import { createSubscription, fetchSubscriptions } from '@/lib/services/subscription-service';
import { useToast } from '@/lib/hooks/use-toast';

interface SubscriptionDiscoveryBannerProps {
  bills: BillPayment[];
  onSubscriptionCreated?: () => void;
}

interface DiscoveredSubscriptionCandidate {
  providerName: string;
  category: string;
  amount: number;
  currency: string;
  count: number;
  lastPaymentDate: string;
}

export default function SubscriptionDiscoveryBanner({
  bills,
  onSubscriptionCreated,
}: SubscriptionDiscoveryBannerProps) {
  const { toast } = useToast();
  const [dismissedProviders, setDismissedProviders] = useState<string[]>([]);
  const [processingProvider, setProcessingProvider] = useState<string | null>(null);

  // Discover candidate recurring payments
  const candidates = useMemo(() => {
    const providerGroups: Record<string, BillPayment[]> = {};
    for (const b of bills) {
      const key = b.providerName.toLowerCase().trim();
      if (!providerGroups[key]) providerGroups[key] = [];
      providerGroups[key].push(b);
    }

    const list: DiscoveredSubscriptionCandidate[] = [];
    for (const [key, group] of Object.entries(providerGroups)) {
      if (dismissedProviders.includes(key)) continue;

      // Candidate criteria: >= 2 payments or marked isRecurring
      const hasMultiple = group.length >= 2;
      const isRecurringMarked = group.some((g) => g.isRecurring);

      if (hasMultiple || isRecurringMarked) {
        const sorted = [...group].sort(
          (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
        );
        const latest = sorted[0];
        list.push({
          providerName: latest.providerName,
          category: latest.category === 'TV' || latest.category === 'TV / Streaming' ? 'Streaming' : 'Utilities',
          amount: latest.amount,
          currency: latest.currency || 'NGN',
          count: group.length,
          lastPaymentDate: latest.paymentDate,
        });
      }
    }

    return list.slice(0, 2); // Show top 2 candidates max
  }, [bills, dismissedProviders]);

  if (candidates.length === 0) return null;

  const handleConfirmCandidate = async (candidate: DiscoveredSubscriptionCandidate) => {
    setProcessingProvider(candidate.providerName);

    // Calculate next expected billing date (30 days from last payment)
    const lastDate = new Date(candidate.lastPaymentDate);
    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + 30);
    const nextBillingDateStr = nextDate.toISOString().split('T')[0];

    const { error } = await createSubscription({
      name: candidate.providerName,
      price: candidate.amount,
      currency: candidate.currency,
      billing_cycle: 'monthly',
      category: (candidate.category as any) || 'Utilities',
      status: 'active',
      next_billing_date: nextBillingDateStr,
      notes: `Auto-discovered from ${candidate.count} payment history records in Bills & Payments.`,
    });

    setProcessingProvider(null);

    if (error) {
      toast.error(error.message, 'Failed to add subscription');
    } else {
      toast.success(
        `Added "${candidate.providerName}" to your tracked subscriptions.`,
        'Subscription Added'
      );
      setDismissedProviders((prev) => [...prev, candidate.providerName.toLowerCase().trim()]);
      onSubscriptionCreated?.();
    }
  };

  const handleDismiss = (providerName: string) => {
    setDismissedProviders((prev) => [...prev, providerName.toLowerCase().trim()]);
  };

  return (
    <div className="space-y-2">
      {candidates.map((cand) => {
        const formattedPrice = formatCurrencyAmount(cand.amount, cand.currency);
        return (
          <div
            key={cand.providerName}
            className="p-3 sm:p-4 rounded-2xl bg-[#0B0E0D] border border-[#14B8A6]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-in fade-in duration-200"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#14B8A6]/10 text-[#14B8A6] shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <ProviderLogo name={cand.providerName} size="sm" />
              <div>
                <span className="text-xs font-bold text-[#F5F7F6] block">
                  This looks like a recurring subscription: {cand.providerName}
                </span>
                <span className="text-[11px] text-[#94A3B8] block">
                  {formattedPrice} / month · Recorded {cand.count} times in payment history
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => handleDismiss(cand.providerName)}
                className="px-3 py-1.5 rounded-xl border border-[#161F1D] text-[#94A3B8] hover:text-[#F5F7F6] text-xs font-medium cursor-pointer"
              >
                Dismiss
              </button>

              <button
                type="button"
                onClick={() => handleConfirmCandidate(cand)}
                disabled={processingProvider === cand.providerName}
                className="px-4 py-1.5 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#051310] text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Confirm & Track Subscription</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
