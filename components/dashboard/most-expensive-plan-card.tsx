'use client';

import { memo } from 'react';
import Link from 'next/link';
import {
  getMostExpensiveSubscriptions,
  getNormalizedMonthlyPrice,
  calculateMonthlySpend,
  formatCurrency,
} from '@/lib/utils/metrics-utils';
import type { SubscriptionRow } from '@/lib/services/subscription-service';
import { getProviderManagementUrl } from '@/lib/services/subscription-service';
import { ServiceIcon } from '@/components/ui/service-icon';
import { ExternalLink, Calendar } from 'lucide-react';

interface MostExpensivePlanCardProps {
  subscriptions: SubscriptionRow[];
  onEdit?: (subscription: SubscriptionRow) => void;
}

export const MostExpensivePlanCard = memo(function MostExpensivePlanCard({ subscriptions }: MostExpensivePlanCardProps) {
  const topSubscriptions = getMostExpensiveSubscriptions(subscriptions);
  const totalMonthly = calculateMonthlySpend(subscriptions);

  if (topSubscriptions.length === 0) {
    return (
      <div className="h-full p-5 sm:p-6 rounded-[20px] bg-[#0B0D0D] border border-[#1A1D1D] space-y-2 text-center flex flex-col items-center justify-center">
        <h3 className="text-base sm:text-lg font-semibold text-[#F5F7F6]">Most Expensive Plan</h3>
        <p className="text-sm text-[#94A3B8]">No active subscriptions found to determine your highest expense.</p>
      </div>
    );
  }

  const isMultiple = topSubscriptions.length > 1;
  const title = isMultiple ? 'Most Expensive Plans' : 'Most Expensive Plan';

  const firstSub = topSubscriptions[0];
  const maxMonthlyPrice = getNormalizedMonthlyPrice(firstSub);
  const totalTopMonthly = maxMonthlyPrice * topSubscriptions.length;
  const percentage = totalMonthly > 0 ? (totalTopMonthly / totalMonthly) * 100 : 0;

  if (isMultiple) {
    return (
      <div className="h-full p-4 sm:p-6 rounded-[20px] bg-[#0B0D0D] border border-[#1A1D1D] space-y-4">
        {/* Top Header Badge */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
          <h2 className="text-base sm:text-lg font-semibold text-[#F5F7F6] tracking-tight">{title}</h2>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium px-2.5 py-1 rounded-xl bg-[#0B0D0D] border border-[#1A1D1D] text-[#94A3B8]">
              {topSubscriptions.length} plans tied at {formatCurrency(maxMonthlyPrice)}/mo ({percentage.toFixed(0)}% of spend)
            </span>
            <Link
              href="/subscriptions?sort=price_desc"
              className="px-4 py-2 rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center min-h-[38px]"
            >
              <span>Manage Plans</span>
            </Link>
          </div>
        </div>

        {/* List of tied top subscriptions */}
        <div className="divide-y divide-[#1A1D1D]/60 pt-1">
          {topSubscriptions.map((sub) => {
            const monthlyPrice = getNormalizedMonthlyPrice(sub);
            const formattedPrice = formatCurrency(Number(sub.price), sub.currency);

            return (
              <div
                key={sub.id}
                className="py-3.5 space-y-3 min-w-0"
              >
                {/* Logo + Title + Category */}
                <div className="flex items-center gap-3 min-w-0">
                  <ServiceIcon name={sub.name} category={sub.category} providerUrl={sub.provider_url} className="w-9 h-9 rounded-xl shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[#F5F7F6] truncate">{sub.name}</span>
                      {getProviderManagementUrl(sub.name, sub.provider_url) && (
                        <a
                          href={getProviderManagementUrl(sub.name, sub.provider_url)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#94A3B8] hover:text-[#F5F7F6] transition-colors"
                          title="Open subscription management page"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                    <span className="text-xs text-[#94A3B8] block mt-0.5 truncate">
                      {sub.category} • Renews {sub.next_billing_date}
                    </span>
                  </div>
                </div>

                {/* Price + Link */}
                <div className="flex items-center justify-between gap-3 border-t border-[#1A1D1D]/60 pt-3">
                  <div className="min-w-0">
                    <span className="text-base font-bold text-[#F5F7F6] block">{formattedPrice}</span>
                    <span className="text-xs text-[#94A3B8] block truncate">
                      / {sub.billing_cycle} ({formatCurrency(monthlyPrice)}/mo)
                    </span>
                  </div>
                  <Link
                    href={`/subscriptions?highlight=${sub.id}`}
                    className="px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 flex items-center rounded-xl bg-[#0B0D0D] hover:bg-[#1A1D1D] text-[#94A3B8] hover:text-[#F5F7F6] border border-[#1A1D1D] text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                    title={`Locate ${sub.name} on Subscriptions page`}
                  >
                    View
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Single Top Subscription Layout
  const topSubscription = firstSub;
  const monthlyPrice = maxMonthlyPrice;
  const formattedPrice = formatCurrency(Number(topSubscription.price), topSubscription.currency);

  return (
    <div className="h-full p-4 sm:p-6 rounded-[20px] bg-[#0B0D0D] border border-[#1A1D1D] space-y-4 flex flex-col">
      {/* Top Header Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
        <h2 className="text-base sm:text-lg font-semibold text-[#F5F7F6] tracking-tight">{title}</h2>

        <span className="text-xs font-medium px-2.5 py-1 rounded-xl bg-[#0B0D0D] border border-[#1A1D1D] text-[#94A3B8] shrink-0 whitespace-nowrap">
          {percentage.toFixed(0)}% of monthly spend
        </span>
      </div>

      {/* Main Content Area */}
      <div className="flex items-start gap-3.5 sm:gap-4 min-w-0 flex-1">
        <ServiceIcon name={topSubscription.name} category={topSubscription.category} providerUrl={topSubscription.provider_url} className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl shrink-0" />

        <div className="space-y-1.5 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3
              className="text-base sm:text-[18px] font-semibold text-[#F5F7F6] leading-snug sm:leading-[24px] truncate"
              title={topSubscription.name}
            >
              {topSubscription.name}
            </h3>
            {getProviderManagementUrl(topSubscription.name, topSubscription.provider_url) && (
              <a
                href={getProviderManagementUrl(topSubscription.name, topSubscription.provider_url)!}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#94A3B8] hover:text-[#F5F7F6] transition-colors shrink-0"
                title="Open subscription management page"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-[15px] text-[#94A3B8]">
            <span>{topSubscription.category}</span>
            <span>•</span>
            <span className="flex items-center gap-1 min-w-0">
              <Calendar className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
              <span className="truncate">Renews {topSubscription.next_billing_date}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Price + Manage */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#1A1D1D] mt-auto">
        <div className="min-w-0">
          <span className="text-xl sm:text-2xl font-bold text-[#F5F7F6] tracking-tight block">
            {formattedPrice}
          </span>
          <span className="text-xs text-[#94A3B8] block">
            / {topSubscription.billing_cycle} ({formatCurrency(monthlyPrice)}/mo)
          </span>
        </div>

        <Link
          href={`/subscriptions?highlight=${topSubscription.id}`}
          className="px-4 py-2.5 rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center min-h-[44px] sm:min-h-[40px] shrink-0 whitespace-nowrap"
        >
          <span>Manage Plan</span>
        </Link>
      </div>
    </div>
  );
});