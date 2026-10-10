'use client';

import React, { memo, useMemo, useState } from 'react';
import { PiggyBank, Eye, ChevronDown } from 'lucide-react';
import type { SubscriptionRow } from '@/lib/services/subscription-service';
import { useCurrency } from '@/lib/contexts/user-settings-context';
import { formatCurrency, getNormalizedMonthlyPrice } from '@/lib/utils/metrics-utils';
import { ServiceIcon } from '@/components/ui/service-icon';

interface SavingsRecommendationsProps {
  subscriptions: SubscriptionRow[];
  activeSubscriptions?: SubscriptionRow[];
  onReviewSubscription: (sub: SubscriptionRow) => void;
  onSeeSavings: (sub: SubscriptionRow) => void;
  onAskSubHalt: (question: string) => void;
}

/* Section only — the surrounding card, and the spending-by-category column it
   used to sit next to, are now owned by the shared dashboard overview card. */
export const SavingsRecommendationsSection = memo(function SavingsRecommendationsSection({
  subscriptions,
  activeSubscriptions,
  onReviewSubscription: _onReviewSubscription,
  onSeeSavings,
  onAskSubHalt,
}: SavingsRecommendationsProps) {
  const { defaultCurrency } = useCurrency();
  const [isExpanded, setIsExpanded] = useState(false);

  const activeSubs = activeSubscriptions || subscriptions.filter(
    (s) => s.status === 'active' || s.status === 'trial'
  );

  // Generate recommendation items
  const recommendations: Array<{
    id: string;
    sub: SubscriptionRow;
    type: 'duplicate' | 'expensive' | 'renewal' | 'unused';
    description: string;
    monthlySavings: number;
  }> = [];

  // 1. Expensive subscriptions (Over $20/mo)
  const expensive = activeSubs.find((s) => getNormalizedMonthlyPrice(s) >= 20);
  if (expensive) {
    const monthly = getNormalizedMonthlyPrice(expensive);
    recommendations.push({
      id: 'expensive-' + expensive.id,
      sub: expensive,
      type: 'expensive',
      description: `Billed at ${formatCurrency(expensive.price, expensive.currency || defaultCurrency)}/${expensive.billing_cycle}. Reviewing unused features could save you up to ${formatCurrency(monthly * 12, defaultCurrency)}/year.`,
      monthlySavings: monthly,
    });
  }

  // 2. Approaching renewal within 7 days
  const now = useMemo(() => new Date(), []);
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
      description: `Renews on ${renewalNear.next_billing_date}. Cancel or pause now if you're not planning to continue.`,
      monthlySavings: getNormalizedMonthlyPrice(renewalNear),
    });
  }

  // 3. Trial or paused subscription check
  const trialSub = subscriptions.find((s) => s.status === 'trial');
  if (trialSub) {
    recommendations.push({
      id: 'trial-' + trialSub.id,
      sub: trialSub,
      type: 'unused',
      description: `Currently on a free/discounted trial period. Decide before auto-renewal begins.`,
      monthlySavings: getNormalizedMonthlyPrice(trialSub),
    });
  }

  if (recommendations.length === 0 && activeSubs.length > 0) {
    // Fallback recommendation
    const firstSub = activeSubs[0];
    recommendations.push({
      id: 'fallback-' + firstSub.id,
      sub: firstSub,
      type: 'unused',
      description: `Check your tier and feature usage to ensure you're getting maximum value.`,
      monthlySavings: getNormalizedMonthlyPrice(firstSub),
    });
  }

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <PiggyBank className="w-4 h-4 sm:w-5 sm:h-5 text-[#94A3B8] shrink-0" />
          <h2 className="text-base sm:text-lg font-semibold text-[#F5F7F6] tracking-tight">
            Savings Recommendations
          </h2>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          aria-controls="savings-recommendations-list"
          data-touch="compact"
          className="w-9 h-9 flex items-center justify-center text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer shrink-0"
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          />
          <span className="sr-only">
            {isExpanded ? 'Hide' : 'Show'} savings recommendations
          </span>
        </button>
      </div>

      {isExpanded && (
      <div id="savings-recommendations-list" className="mt-4 space-y-4">
        {recommendations.length > 0 ? (
          <div className="space-y-4">
            {recommendations.slice(0, 2).map((item) => (
              <div
                key={item.id}
                /* `group` + the hover/focus classes below drive the reveal: the
                   service label and the eye button stay out of the resting state
                   so the headline and the copy are what you actually read. */
                className="group/item space-y-3 pb-1"
              >
                <div className="space-y-2 min-w-0">
                  <div className="flex items-center gap-2.5 min-w-0 opacity-0 transition-opacity duration-150 group-hover/item:opacity-100 group-focus-within/item:opacity-100">
                    <ServiceIcon
                      name={item.sub.name}
                      category={item.sub.category}
                      providerUrl={item.sub.provider_url}
                      className="w-7 h-7 rounded-lg shrink-0"
                    />
                    <span className="text-xs text-[#94A3B8] truncate">
                      {item.sub.name}
                    </span>
                  </div>

                  <span className="block text-xl sm:text-3xl font-bold text-[#F5F7F6] tracking-tight leading-tight">
                    Save up to {formatCurrency(item.monthlySavings, defaultCurrency)}/mo
                  </span>

                  <p className="text-xs text-[#94A3B8] leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  {/* The eye icon is a resting affordance; only the "See savings"
                      label is hover/focus-revealed. `invisible` alongside
                      `opacity-0` so the label is genuinely removed from the
                      render rather than left as a transparent layer that can
                      still paint over the headline. */}
                  <div
                    className="group relative"
                  >
                    <button
                      type="button"
                      onClick={() => onSeeSavings(item.sub)}
                      aria-label="See savings"
                      className="w-11 h-11 rounded-lg bg-[#1A1D1D] hover:bg-[#262929] text-[#F5F7F6] border border-[#3F3F46]/40 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-md bg-[#F5F7F6] text-[#091512] text-[11px] font-semibold whitespace-nowrap opacity-0 invisible transition-opacity group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible"
                    >
                      See savings
                    </span>
                  </div>

                  {/* Ask SubHalt takes the white primary slot. Review moved to
                      the Savings Intelligence sheet as a plain link. */}
                  <button
                    type="button"
                    onClick={() => onAskSubHalt('How much could I save on my subscriptions?')}
                    className="px-3.5 py-1.5 rounded-lg bg-[#F5F7F6] hover:bg-white text-[#091512] text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    Ask SubHalt
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
      )}
    </div>
  );
});
