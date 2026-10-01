'use client';

import { memo, type ReactNode } from 'react';
import type { SubscriptionRow } from '@/lib/services/subscription-service';
import { UpcomingRenewalsSpotlight } from '@/components/subscriptions/upcoming-renewals-spotlight';
import { SavingsRecommendationsSection } from '@/components/ai/savings-recommendations';
import { MostExpensivePlanCard } from '@/components/dashboard/most-expensive-plan-card';
import { CategoryBreakdownCard } from '@/components/dashboard/category-breakdown-card';

interface DashboardOverviewCardProps {
  subscriptions: SubscriptionRow[];
  activeSubscriptions: SubscriptionRow[];
  onReviewSubscription: (sub: SubscriptionRow) => void;
  onSeeSavings: (sub: SubscriptionRow) => void;
  onAskSubHalt: (question: string) => void;
}

function OverviewSurface({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[20px] bg-[#0B0D0D] border border-[#1A1D1D] p-5 sm:p-6 ${className}`}>
      {children}
    </div>
  );
}

export const DashboardOverviewCard = memo(function DashboardOverviewCard({
  subscriptions,
  activeSubscriptions,
  onReviewSubscription,
  onSeeSavings,
  onAskSubHalt,
}: DashboardOverviewCardProps) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <UpcomingRenewalsSpotlight subscriptions={activeSubscriptions} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <OverviewSurface className="min-w-0 flex flex-col gap-5">
          <MostExpensivePlanCard subscriptions={activeSubscriptions} isEmbedded={true} />

          <div className="border-t border-[#1A1D1D] pt-5">
            <SavingsRecommendationsSection
              subscriptions={subscriptions}
              activeSubscriptions={activeSubscriptions}
              onReviewSubscription={onReviewSubscription}
              onSeeSavings={onSeeSavings}
              onAskSubHalt={onAskSubHalt}
            />
          </div>
        </OverviewSurface>

        <OverviewSurface className="min-w-0 flex flex-col justify-center">
          <CategoryBreakdownCard subscriptions={activeSubscriptions} isEmbedded={true} />
        </OverviewSurface>
      </div>
    </div>
  );
});
