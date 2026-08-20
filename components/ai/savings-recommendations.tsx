'use client';

import React from 'react';
import { PiggyBank, Eye, HelpCircle, ArrowRight, ShieldAlert, Sparkles } from 'lucide-react';
import type { SubscriptionRow } from '@/lib/services/subscription-service';
import { useUserSettings } from '@/lib/contexts/user-settings-context';
import { formatCurrency, getNormalizedMonthlyPrice } from '@/lib/utils/metrics-utils';
import { CategoryBreakdownCard } from '@/components/dashboard/category-breakdown-card';
import { SubHaltAvatar } from '@/components/ui/subhalt-avatar';

interface SavingsRecommendationsProps {
  subscriptions: SubscriptionRow[];
  activeSubscriptions?: SubscriptionRow[];
  onReviewSubscription: (sub: SubscriptionRow) => void;
  onSeeSavings: (sub: SubscriptionRow) => void;
  onAskSubHalt: (question: string) => void;
}

export function SavingsRecommendations({
  subscriptions,
  activeSubscriptions,
  onReviewSubscription,
  onSeeSavings,
  onAskSubHalt,
}: SavingsRecommendationsProps) {
  const { defaultCurrency } = useUserSettings();

  const activeSubs = activeSubscriptions || subscriptions.filter(
    (s) => s.status === 'active' || s.status === 'trial'
  );

  // Generate recommendation items
  const recommendations: Array<{
    id: string;
    sub: SubscriptionRow;
    type: 'duplicate' | 'expensive' | 'renewal' | 'unused';
    title: string;
    description: string;
    potentialSaveText: string;
  }> = [];

  // 1. Expensive subscriptions (Over $20/mo)
  const expensive = activeSubs.find((s) => getNormalizedMonthlyPrice(s) >= 20);
  if (expensive) {
    const monthly = getNormalizedMonthlyPrice(expensive);
    recommendations.push({
      id: 'expensive-' + expensive.id,
      sub: expensive,
      type: 'expensive',
      title: `High-Cost Subscription: ${expensive.name}`,
      description: `Billed at ${formatCurrency(expensive.price, expensive.currency || defaultCurrency)}/${expensive.billing_cycle}. Reviewing unused features could save you up to ${formatCurrency(monthly * 12, defaultCurrency)}/year.`,
      potentialSaveText: `Save ${formatCurrency(monthly, defaultCurrency)}/mo`,
    });
  }

  // 2. Approaching renewal within 7 days
  const now = new Date();
  const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const renewalNear = activeSubs.find((s) => {
    const d = new Date(s.next_billing_date);
    return d >= now && d <= weekLater;
  });

  if (renewalNear) {
    recommendations.push({
      id: 'renewal-' + renewalNear.id,
      sub: renewalNear,
      type: 'renewal',
      title: `Upcoming Renewal: ${renewalNear.name}`,
      description: `Renews on ${renewalNear.next_billing_date}. Cancel or pause now if you're not planning to continue.`,
      potentialSaveText: `Save ${formatCurrency(renewalNear.price, renewalNear.currency || defaultCurrency)}`,
    });
  }

  // 3. Trial or paused subscription check
  const trialSub = subscriptions.find((s) => s.status === 'trial');
  if (trialSub) {
    recommendations.push({
      id: 'trial-' + trialSub.id,
      sub: trialSub,
      type: 'unused',
      title: `Active Trial: ${trialSub.name}`,
      description: `Currently on a free/discounted trial period. Decide before auto-renewal begins.`,
      potentialSaveText: `Save ${formatCurrency(trialSub.price, trialSub.currency || defaultCurrency)}/mo`,
    });
  }

  if (recommendations.length === 0 && activeSubs.length > 0) {
    // Fallback recommendation
    const firstSub = activeSubs[0];
    recommendations.push({
      id: 'fallback-' + firstSub.id,
      sub: firstSub,
      type: 'unused',
      title: `Portfolio Optimization: ${firstSub.name}`,
      description: `Check your tier and feature usage to ensure you're getting maximum value.`,
      potentialSaveText: `Save ${formatCurrency(firstSub.price, firstSub.currency || defaultCurrency)}/mo`,
    });
  }

  return (
    <div className="rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] p-5 sm:p-6 space-y-6">
      {/* SECTION 1: Savings Recommendations */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#1A1D1D] pb-3">
          <div className="flex items-center gap-3">
            <PiggyBank className="w-5 h-5 text-[#94A3B8] shrink-0" />
            <h3 className="text-base sm:text-lg font-semibold text-[#F5F7F6] tracking-tight">
              Savings Recommendations
            </h3>
          </div>

          <button
            type="button"
            onClick={() => onAskSubHalt('How much could I save on my subscriptions?')}
            className="px-3.5 py-1.5 rounded-lg bg-[#1A1D1D] hover:bg-[#262929] text-[#F5F7F6] text-xs font-medium border border-[#3F3F46]/40 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <SubHaltAvatar size="sm" className="w-4 h-4 rounded-md border-0 bg-transparent" />
            <span>Ask SubHalt</span>
          </button>
        </div>

        {recommendations.length > 0 ? (
          <div className="space-y-4">
            {recommendations.slice(0, 2).map((item) => (
              <div
                key={item.id}
                className="space-y-3 pb-1"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <span className="text-sm font-semibold text-[#F5F7F6] block truncate">
                      {item.title}
                    </span>
                    <p className="text-xs text-[#94A3B8] leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#F5F7F6] text-[#091512] text-[11px] font-bold shrink-0">
                    {item.potentialSaveText}
                  </span>
                </div>

                {/* Clean text-based action buttons: See savings (white primary) | Review subscription (subtle dark) */}
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => onSeeSavings(item.sub)}
                    className="px-3.5 py-1.5 rounded-lg bg-[#F5F7F6] hover:bg-white text-[#091512] text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    See savings
                  </button>

                  <button
                    type="button"
                    onClick={() => onReviewSubscription(item.sub)}
                    className="px-3.5 py-1.5 rounded-lg bg-[#1A1D1D] hover:bg-[#262929] text-[#F5F7F6] text-[11px] font-medium border border-[#3F3F46]/40 transition-colors cursor-pointer"
                  >
                    Review subscription
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-2 text-xs text-[#94A3B8]">
            No active savings recommendations at this time. Add more subscriptions to see optimization insights.
          </div>
        )}
      </div>

      {/* SECTION 2: Spending by Category (Subtle Internal Divider) */}
      <div className="border-t border-[#1A1D1D] pt-6">
        <CategoryBreakdownCard subscriptions={activeSubs} isEmbedded={true} />
      </div>
    </div>
  );
}
