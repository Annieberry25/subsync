'use client';

import { memo } from 'react';
import Link from 'next/link';
import {
  getMostExpensiveSubscriptions,
  getNormalizedMonthlyPrice,
  formatCurrency,
} from '@/lib/utils/metrics-utils';
import type { SubscriptionRow } from '@/lib/services/subscription-service';
import { ServiceIcon } from '@/components/ui/service-icon';

interface MostExpensivePlanCardProps {
  subscriptions: SubscriptionRow[];
  onEdit?: (subscription: SubscriptionRow) => void;
  /* Rendered inside the shared dashboard overview card, so it drops its own
     surface/padding and the parent owns the chrome. */
  isEmbedded?: boolean;
}

/* An inline highlight, not a filled button. The row already reads as a list of
   subscriptions, so a solid CTA on every line competed with the data. */
const manageLinkClass =
  'text-xs font-semibold text-[#14B8A6] hover:text-[#5EEAD4] hover:underline underline-offset-4 transition-colors shrink-0 whitespace-nowrap cursor-pointer';

export const MostExpensivePlanCard = memo(function MostExpensivePlanCard({ subscriptions, isEmbedded = false }: MostExpensivePlanCardProps) {
  const topSubscriptions = getMostExpensiveSubscriptions(subscriptions);

  if (topSubscriptions.length === 0) {
    return (
      <div
        className={
          isEmbedded
            ? 'h-full flex flex-col items-center justify-center gap-1 text-center min-w-0'
            : 'h-full p-5 sm:p-6 rounded-[20px] bg-[#0B0D0D] border border-[#1A1D1D] space-y-2 text-center flex flex-col items-center justify-center'
        }
      >
        {isEmbedded && (
          <h2 className="text-sm sm:text-lg font-semibold text-[#F5F7F6] tracking-tight">Most Expensive Plan</h2>
        )}
        <p className="text-xs sm:text-sm text-[#94A3B8] text-center">No active subscriptions found to determine your highest expense.</p>
      </div>
    );
  }

  const isMultiple = topSubscriptions.length > 1;
  const title = isMultiple ? 'Most Expensive Plans' : 'Most Expensive Plan';

  /* One line per plan: logo, name, amount, manage link. The category and
     renewal date were removed, along with the "N% of monthly spend" badge —
     this container is a pointer to the top expense, not a summary of it, and
     the detail it duplicated is one tap away on the Subscriptions page. */
  const renderRow = (sub: SubscriptionRow, key: string | number) => {
    const formattedPrice = formatCurrency(Number(sub.price), sub.currency);
    const monthlyPrice = getNormalizedMonthlyPrice(sub);
    const rawPrice = Number(sub.price);
    /* Only surface the normalized monthly figure when it actually differs,
       e.g. an annual plan, so the line stays short. */
    const showNormalized = Math.abs(monthlyPrice - rawPrice) > 0.005;

    return (
      <div key={key} className="flex items-center gap-3 min-w-0">
        <ServiceIcon
          name={sub.name}
          category={sub.category}
          providerUrl={sub.provider_url}
          className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl shrink-0"
        />
        <span className="text-sm sm:text-base font-semibold text-[#F5F7F6] truncate min-w-0 flex-1" title={sub.name}>
          {sub.name}
        </span>
        <span className="text-sm sm:text-base font-bold text-[#F5F7F6] whitespace-nowrap shrink-0">
          {formattedPrice}
          {showNormalized && (
            <span className="text-[11px] font-normal text-[#94A3B8]"> / {formatCurrency(monthlyPrice)} mo</span>
          )}
        </span>
        <Link
          href={`/subscriptions?highlight=${sub.id}`}
          className={manageLinkClass}
          title={`Locate ${sub.name} on Subscriptions page`}
        >
          Manage Plan
        </Link>
      </div>
    );
  };

  if (isMultiple) {
    return (
      <div
        className={
          isEmbedded
            ? 'h-full flex flex-col gap-4 min-w-0'
            : 'h-full p-4 sm:p-6 rounded-[20px] bg-[#0B0D0D] border border-[#1A1D1D] space-y-4'
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
          <h2 className="text-sm sm:text-lg font-semibold text-[#F5F7F6] tracking-tight">{title}</h2>
          <span className="text-xs font-medium text-[#94A3B8] shrink-0 whitespace-nowrap">
            {topSubscriptions.length} plans tied
          </span>
        </div>

        <div className="space-y-3 pt-1">
          {topSubscriptions.map((sub, i) => renderRow(sub, sub.id ?? i))}
        </div>
      </div>
    );
  }

  const topSubscription = topSubscriptions[0];

  return (
    <div
      className={
        isEmbedded
          ? 'h-full flex flex-col justify-center gap-4 min-w-0'
          : 'h-full p-4 sm:p-6 rounded-[20px] bg-[#0B0D0D] border border-[#1A1D1D] flex flex-col justify-center gap-4'
      }
    >
      <h2 className="text-sm sm:text-lg font-semibold text-[#F5F7F6] tracking-tight">{title}</h2>
      {renderRow(topSubscription, topSubscription.id)}
    </div>
  );
});