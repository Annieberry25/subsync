'use client';

import { calculateCategoryBreakdown } from '@/lib/utils/analytics-utils';
import { calculatePotentialSavings, formatCurrency } from '@/lib/utils/metrics-utils';
import type { SubscriptionRow } from '@/lib/services/subscription-service';
import { Lightbulb, AlertTriangle, ShieldCheck, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface SmartInsightCardProps {
  subscriptions: SubscriptionRow[];
}

export function SmartInsightCard({ subscriptions }: SmartInsightCardProps) {
  const categoryBreakdown = calculateCategoryBreakdown(subscriptions);
  const potentialSavings = calculatePotentialSavings(subscriptions);

  const trialSubscriptions = subscriptions.filter((sub) => sub.status === 'trial');
  const pausedSubscriptions = subscriptions.filter((sub) => sub.status === 'paused');
  const topCategory = categoryBreakdown.length > 0 ? categoryBreakdown[0] : null;

  // Natural, intelligent financial recommendation copy
  let recommendationText = 'Your subscription portfolio is well-balanced across categories with no upcoming trial conversions or redundant plan costs.';
  let icon = <ShieldCheck className="w-4 h-4 text-amber-400" />;

  if (trialSubscriptions.length > 0) {
    const trial = trialSubscriptions[0];
    const formattedTrialPrice = formatCurrency(Number(trial.price), trial.currency);
    recommendationText = `You have an active trial for ${trial.name} (${formattedTrialPrice}/mo). Review before billing starts to avoid automatic charges.`;
    icon = <AlertTriangle className="w-4 h-4 text-amber-400" />;
  } else if (topCategory && topCategory.percentage >= 45) {
    recommendationText = `You spend ${formatCurrency(topCategory.monthlySpend)}/month on ${topCategory.category} across ${topCategory.count} plans. Auditing for overlapping services could lower your bill.`;
    icon = <Lightbulb className="w-4 h-4 text-amber-400" />;
  } else if (potentialSavings > 0) {
    recommendationText = `You could save up to ${formatCurrency(potentialSavings)}/month by reviewing ${pausedSubscriptions.length > 0 ? `${pausedSubscriptions.length} paused or trial plan(s)` : 'inactive plans'} in your portfolio.`;
    icon = <Lightbulb className="w-4 h-4 text-amber-400" />;
  }

  return (
    <div className="glass-panel p-3.5 sm:px-5 sm:py-4 rounded-2xl shadow-md border border-env-subtle/80 relative overflow-hidden transition-all">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 sm:gap-4">
        {/* Left: Small Insight Icon + Title Above Recommendation Text */}
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 shadow-xs">
            {icon}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-env-heading tracking-tight block">
              Smart Insight
            </h3>
            <p className="text-xs text-env-muted leading-relaxed line-clamp-2 max-w-2xl block mt-0.5">
              {recommendationText}
            </p>
          </div>
        </div>

        {/* Right: Primary Purple CTA Button ("Review Savings") */}
        <Link
          href="/subscriptions"
          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm transition-all shrink-0 cursor-pointer w-full sm:w-auto"
        >
          <span>Review Savings</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}




