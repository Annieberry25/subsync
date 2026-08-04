'use client';

import { getMostExpensiveSubscription, getNormalizedMonthlyPrice, calculateMonthlySpend, formatCurrency } from '@/lib/utils/metrics-utils';
import type { SubscriptionRow } from '@/lib/services/subscription-service';
import { ServiceIcon } from '@/components/ui/service-icon';
import { Crown, ExternalLink, CreditCard, Calendar, Settings2 } from 'lucide-react';

interface MostExpensivePlanCardProps {
  subscriptions: SubscriptionRow[];
  onEdit?: (subscription: SubscriptionRow) => void;
}

export function MostExpensivePlanCard({ subscriptions, onEdit }: MostExpensivePlanCardProps) {
  const topSubscription = getMostExpensiveSubscription(subscriptions);
  const totalMonthly = calculateMonthlySpend(subscriptions);

  if (!topSubscription) {
    return (
      <div className="glass-panel p-4 sm:p-4.5 rounded-3xl space-y-2 text-center relative overflow-hidden border border-indigo-500/20">
        <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/25 mx-auto shadow-sm">
          <Crown className="w-4 h-4" />
        </div>
        <div className="space-y-0.5">
          <h3 className="text-sm font-bold text-env-heading">Most Expensive Plan</h3>
          <p className="text-[11px] text-env-muted max-w-xs mx-auto">No active subscriptions found to determine your highest expense.</p>
        </div>
      </div>
    );
  }

  const monthlyPrice = getNormalizedMonthlyPrice(topSubscription);
  const percentage = totalMonthly > 0 ? (monthlyPrice / totalMonthly) * 100 : 0;
  const formattedPrice = formatCurrency(Number(topSubscription.price), topSubscription.currency);

  return (
    <div className="glass-panel p-4 sm:p-5 rounded-3xl shadow-xl border border-indigo-500/20 relative overflow-hidden bg-gradient-to-b from-indigo-500/5 via-purple-500/5 to-amber-500/5 transition-colors">
      {/* Soft ambient background glow blending orange with purple */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-amber-500/5 blur-2xl pointer-events-none" />

      {/* Top Header Badge */}
      <div className="flex items-center justify-between relative z-10 mb-2.5">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/25 shadow-sm">
            <Crown className="w-3 h-3" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400/90">Most Expensive Plan</span>
        </div>

        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-xs">
          {percentage.toFixed(0)}% of monthly spend
        </span>
      </div>

      {/* Centered Main Content Area */}
      <div className="flex flex-col items-center text-center space-y-2 relative z-10 py-0.5">
        {/* Service Logo Centered (Tuned ~12% smaller) */}
        <div className="relative group">
          <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-env-button-sec/90 border border-indigo-500/25 p-2.5 shadow-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
            <ServiceIcon name={topSubscription.name} category={topSubscription.category} className="w-full h-full object-contain" />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-md border border-black/20">
            <Crown className="w-2.5 h-2.5 fill-black" />
          </div>
        </div>

        {/* Plan Name & Provider Link */}
        <div className="space-y-0.5">
          <div className="flex items-center justify-center gap-1.5">
            <h4 className="text-lg sm:text-xl font-extrabold text-env-heading tracking-tight">{topSubscription.name}</h4>
            {topSubscription.provider_url && (
              <a
                href={topSubscription.provider_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-env-muted hover:text-amber-400 transition-colors p-0.5"
                title="Visit provider website"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {/* Badges / Metadata */}
          <div className="flex items-center justify-center gap-2 flex-wrap pt-0.5 text-xs">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold text-[10px]">
              {topSubscription.category}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-env-muted font-medium">
              <Calendar className="w-3 h-3 text-amber-400/80" />
              Renews {topSubscription.next_billing_date}
            </span>
            {topSubscription.payment_method && (
              <span className="flex items-center gap-1 text-[11px] text-env-muted font-medium">
                <CreditCard className="w-3 h-3 text-amber-400/80" />
                {topSubscription.payment_method}
              </span>
            )}
          </div>
        </div>

        {/* Monthly Cost Centered */}
        <div className="py-0.5 space-y-0">
          <span className="text-xl sm:text-2xl font-black text-env-heading tracking-tight block">
            {formattedPrice}
          </span>
          <span className="text-[11px] text-amber-400/90 font-semibold block">
            / {topSubscription.billing_cycle} ({formatCurrency(monthlyPrice)}/mo)
          </span>
        </div>

        {/* CTA Button Centered (Compact & comfortable touch target) */}
        {onEdit && (
          <button
            type="button"
            onClick={() => onEdit(topSubscription)}
            className="mt-0.5 px-4.5 py-1.5 rounded-xl bg-amber-500/90 hover:bg-amber-400 text-black text-xs font-bold shadow-md shadow-amber-500/15 transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 flex items-center gap-1.5"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Manage Plan
          </button>
        )}
      </div>
    </div>
  );
}

