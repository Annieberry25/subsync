'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { SubscriptionRow } from '@/lib/services/subscription-service';
import { formatCurrency } from '@/lib/utils/metrics-utils';
import { ServiceIcon } from '@/components/ui/service-icon';

interface UpcomingRenewalsSpotlightProps {
  subscriptions: SubscriptionRow[];
  onEdit?: (subscription: SubscriptionRow) => void;
}

function getPlanName(sub: SubscriptionRow): string {
  if (sub.notes && sub.notes.trim().toLowerCase().includes('plan')) {
    return sub.notes.trim();
  }
  const nameLower = sub.name.toLowerCase();
  if (nameLower.includes('netflix')) return 'Basic Plan';
  if (nameLower.includes('spotify')) return 'Premium Plan';
  if (nameLower.includes('chatgpt') || nameLower.includes('openai')) return 'Plus Plan';
  if (nameLower.includes('icloud') || nameLower.includes('google')) return 'Storage Plan';
  
  const cycleName = sub.billing_cycle ? sub.billing_cycle.charAt(0).toUpperCase() + sub.billing_cycle.slice(1) : 'Monthly';
  return `${cycleName} Plan`;
}

function getRenewalStatus(diffDays: number) {
  if (diffDays === 0) {
    return { text: 'Due today', color: '#D9363E' };
  }
  if (diffDays === 1) {
    return { text: 'In 1 day', color: '#D9363E' };
  }
  if (diffDays <= 4) {
    return { text: `In ${diffDays} days`, color: '#D9363E' };
  }
  return { text: `In ${diffDays} days`, color: '#94A3B8' };
}

function getCycleSuffix(billingCycle?: string): string {
  if (!billingCycle) return '/month';
  const lower = billingCycle.toLowerCase();
  if (lower === 'yearly' || lower === 'annual') return '/yr';
  if (lower === 'quarterly') return '/quarter';
  if (lower === 'weekly') return '/wk';
  return '/month';
}

export function UpcomingRenewalsSpotlight({ subscriptions, onEdit }: UpcomingRenewalsSpotlightProps) {
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
    <div className="p-4 sm:p-6 rounded-[20px] bg-[#0B0D0D] border border-[#1A1D1D] space-y-4">
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
        <div className="p-6 text-center bg-[#0B0D0D] border border-[#1A1D1D] rounded-2xl">
          <p className="text-sm sm:text-base font-medium text-[#F5F7F6]/80">
            No renewals in the next 10 days.
          </p>
          <p className="text-xs text-[#94A3B8]/60 mt-1">
            You&apos;re all caught up.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#1A1D1D]/60">
          {displayItems.map(({ sub, diffDays }) => {
            const status = getRenewalStatus(diffDays);
            const price = Number(sub.price) || 0;
            const cycleSuffix = getCycleSuffix(sub.billing_cycle);
            const planName = getPlanName(sub);

            return (
              <div
                key={sub.id}
                className="flex flex-col sm:grid sm:grid-cols-[minmax(180px,1.5fr)_minmax(130px,1fr)_minmax(120px,auto)] items-start sm:items-center py-3.5 px-1 gap-2.5 sm:gap-4 cursor-default"
              >
                {/* 1. Service Logo + Name + Plan */}
                <div className="flex items-center gap-3.5 min-w-0 w-full sm:w-auto">
                  <ServiceIcon name={sub.name} category={sub.category} providerUrl={sub.provider_url} className="w-9 h-9 rounded-xl shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-semibold text-[#F5F7F6] block">
                      {sub.name}
                    </span>
                    <span className="text-xs text-[#94A3B8] block mt-0.5">
                      {planName}
                    </span>
                  </div>
                </div>

                {/* 2 & 3: Mobile sub-row / Desktop grid cells */}
                <div className="flex sm:contents items-center justify-between w-full pt-2 sm:pt-0 border-t sm:border-t-0 border-[#1A1D1D]/60 gap-2">
                  {/* 2. Renewal Status */}
                  <div className="flex items-center justify-start sm:justify-center text-left sm:text-center min-w-0">
                    <span
                      className="text-xs sm:text-sm font-medium"
                      style={{ color: status.color }}
                    >
                      {status.text}
                    </span>
                  </div>

                  {/* 3. Single-line Price */}
                  <div className="text-right min-w-0 shrink-0 justify-self-end">
                    <span className="text-base sm:text-lg font-bold text-[#F5F7F6]">
                      {formatCurrency(price, sub.currency || 'USD')}
                    </span>
                    <span className="text-xs font-normal text-[#94A3B8]">
                      {cycleSuffix}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
