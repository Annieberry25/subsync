'use client';

import Link from 'next/link';
import {
  getMostExpensiveSubscriptions,
  getNormalizedMonthlyPrice,
  calculateMonthlySpend,
  formatCurrency,
} from '@/lib/utils/metrics-utils';
import type { SubscriptionRow } from '@/lib/services/subscription-service';
import { ServiceIcon } from '@/components/ui/service-icon';
import { Crown, ExternalLink, CreditCard, Calendar, Settings2 } from 'lucide-react';

interface MostExpensivePlanCardProps {
  subscriptions: SubscriptionRow[];
  onEdit?: (subscription: SubscriptionRow) => void;
}

export function MostExpensivePlanCard({ subscriptions }: MostExpensivePlanCardProps) {
  const topSubscriptions = getMostExpensiveSubscriptions(subscriptions);
  const totalMonthly = calculateMonthlySpend(subscriptions);

  if (topSubscriptions.length === 0) {
    return (
      <div className="p-6 rounded-[20px] bg-[#171A21] border border-[#2B313D] space-y-2 text-center">
        <Crown className="w-5 h-5 text-[#6F7787] mx-auto" />
        <h3 className="text-[18px] font-semibold text-white">Most Expensive Plan</h3>
        <p className="text-[15px] text-[#A1AAB8]">No active subscriptions found to determine your highest expense.</p>
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
      <div className="p-4 sm:p-6 rounded-[20px] bg-[#171A21] border border-[#2B313D] space-y-4">
        {/* Top Header Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-[#6F7787] shrink-0" />
            <h2 className="text-xl sm:text-[28px] font-bold text-white tracking-tight leading-tight sm:leading-[36px]">{title}</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium px-2.5 py-1 rounded-xl bg-[#1D222B] border border-[#2B313D] text-[#A1AAB8]">
              {topSubscriptions.length} plans tied at {formatCurrency(maxMonthlyPrice)}/mo ({percentage.toFixed(0)}% of spend)
            </span>
            <Link
              href="/subscriptions?sort=price_desc"
              className="px-4 py-2 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 min-h-[38px]"
            >
              <Settings2 className="w-4 h-4" />
              <span>Manage Plans</span>
            </Link>
          </div>
        </div>

        {/* List of tied top subscriptions */}
        <div className="space-y-2.5 pt-1">
          {topSubscriptions.map((sub) => {
            const monthlyPrice = getNormalizedMonthlyPrice(sub);
            const formattedPrice = formatCurrency(Number(sub.price), sub.currency);

            return (
              <div
                key={sub.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-5 py-3.5 bg-[#1D222B] border border-white/[0.04] rounded-2xl gap-3 sm:gap-4"
              >
                {/* Logo + Title + Category */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-[#171A21] border border-[#2B313D] p-2 flex items-center justify-center shrink-0">
                    <ServiceIcon name={sub.name} category={sub.category} className="w-full h-full object-contain" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm sm:text-base font-semibold text-white">{sub.name}</span>
                      {sub.provider_url && (
                        <a
                          href={sub.provider_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#6F7787] hover:text-white transition-colors"
                          title="Visit provider website"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                    <span className="text-xs sm:text-[14px] text-[#A1AAB8] block mt-0.5">
                      {sub.category} • Renews {sub.next_billing_date}
                    </span>
                  </div>
                </div>

                {/* Price + Link */}
                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-white/[0.04]">
                  <div className="text-left sm:text-right">
                    <span className="text-base sm:text-lg font-bold text-white block">{formattedPrice}</span>
                    <span className="text-xs text-[#A1AAB8] block">
                      / {sub.billing_cycle} ({formatCurrency(monthlyPrice)}/mo)
                    </span>
                  </div>
                  <Link
                    href={`/subscriptions?highlight=${sub.id}`}
                    className="p-2 rounded-xl bg-[#171A21] hover:bg-[#2B313D] text-[#A1AAB8] hover:text-white border border-[#2B313D] transition-colors"
                    title={`Locate ${sub.name} on Subscriptions page`}
                  >
                    <Settings2 className="w-4 h-4" />
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
    <div className="p-4 sm:p-6 rounded-[20px] bg-[#171A21] border border-[#2B313D] space-y-4">
      {/* Top Header Badge */}
      <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2.5 sm:gap-4">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-[#6F7787] shrink-0" />
          <h2 className="text-xl sm:text-[28px] font-bold text-white tracking-tight leading-tight sm:leading-[36px]">{title}</h2>
        </div>

        <span className="self-start xs:self-auto text-xs font-medium px-2.5 py-1 rounded-xl bg-[#1D222B] border border-[#2B313D] text-[#A1AAB8] shrink-0">
          {percentage.toFixed(0)}% of monthly spend
        </span>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 pt-2">
        <div className="flex items-start sm:items-center gap-3.5 sm:gap-4 min-w-0 w-full md:w-auto">
          <div className="w-12 h-12 rounded-xl bg-[#1D222B] border border-[#2B313D] p-2.5 flex items-center justify-center shrink-0">
            <ServiceIcon name={topSubscription.name} category={topSubscription.category} className="w-full h-full object-contain" />
          </div>

          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-[18px] font-semibold text-white leading-snug sm:leading-[24px]">{topSubscription.name}</h3>
              {topSubscription.provider_url && (
                <a
                  href={topSubscription.provider_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#6F7787] hover:text-white transition-colors shrink-0"
                  title="Visit provider website"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-[15px] text-[#A1AAB8]">
              <span>{topSubscription.category}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#6F7787] shrink-0" />
                Renews {topSubscription.next_billing_date}
              </span>
              {topSubscription.payment_method && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5 text-[#6F7787] shrink-0" />
                    {topSubscription.payment_method}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-[#2B313D]/60 shrink-0">
          <div className="text-left md:text-right">
            <span className="text-xl sm:text-2xl font-bold text-white tracking-tight block">
              {formattedPrice}
            </span>
            <span className="text-xs sm:text-[15px] text-[#A1AAB8] block">
              / {topSubscription.billing_cycle} ({formatCurrency(monthlyPrice)}/mo)
            </span>
          </div>

          <Link
            href={`/subscriptions?highlight=${topSubscription.id}`}
            className="px-4 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-medium transition-colors cursor-pointer flex items-center gap-2 min-h-[44px] shrink-0"
          >
            <Settings2 className="w-4 h-4" />
            <span>Manage Plan</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
