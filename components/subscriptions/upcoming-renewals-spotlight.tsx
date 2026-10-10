'use client';

import { memo } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { SubscriptionRow } from '@/lib/services/subscription-service';
import { RenewalsTable } from '@/components/subscriptions/renewals-table';

interface UpcomingRenewalsSpotlightProps {
  subscriptions: SubscriptionRow[];
  onEdit?: (subscription: SubscriptionRow) => void;
}

export const UpcomingRenewalsSpotlight = memo(function UpcomingRenewalsSpotlight({ subscriptions, onEdit: _onEdit }: UpcomingRenewalsSpotlightProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingList = subscriptions
    .filter((sub) => sub.status === 'active' || sub.status === 'trial')
    .map((sub) => {
      const nextDate = new Date(sub.next_billing_date);
      nextDate.setHours(0, 0, 0, 0);
      const diffTime = nextDate.getTime() - today.getTime();
      const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
      return { sub, diffDays };
    })
    .filter(({ diffDays }) => diffDays >= 0 && diffDays <= 10)
    .sort((a, b) => a.diffDays - b.diffDays);

  const displayItems = upcomingList.slice(0, 3);
  const showViewAll = upcomingList.length > 0;

  return (
    <div className="h-full flex flex-col gap-4 p-4 sm:p-6 rounded-[20px] bg-[#0B0D0D] border border-[#1A1D1D]">
      {/* Header Row */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base sm:text-lg font-semibold text-[#F5F7F6] tracking-tight">
          Upcoming Renewals
        </h2>
        {showViewAll && (
          <Link
            href="/renewals"
            prefetch={true}
            className="text-xs font-semibold text-[#14B8A6] hover:opacity-90 flex items-center gap-1 cursor-pointer transition-colors pt-1 shrink-0"
          >
            <span>View all</span>
            <ChevronRight className="w-4 h-4 text-[#14B8A6]" />
          </Link>
        )}
      </div>

      {/* List Container / Empty State */}
      {displayItems.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-1 min-h-[72px]">
          <p className="text-sm sm:text-base font-medium text-[#F5F7F6]/80">
            No renewals in the next 10 days.
          </p>
          <p className="text-xs text-[#94A3B8]/60">
            You&apos;re all caught up.
          </p>
        </div>
      ) : (
        <RenewalsTable items={displayItems} />
      )}
    </div>
  );
});
