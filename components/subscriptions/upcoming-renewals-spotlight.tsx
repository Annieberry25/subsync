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
  if (diffDays < 0) {
    const days = Math.abs(diffDays);
    return {
      text: days === 1 ? 'Overdue by 1 day' : `Overdue by ${days} days`,
      color: '#EF4444',
    };
  }
  if (diffDays === 0) {
    return { text: 'Today', color: '#F59E0B' };
  }
  if (diffDays === 1) {
    return { text: 'Tomorrow', color: '#F59E0B' };
  }
  if (diffDays <= 7) {
    return { text: `In ${diffDays} days`, color: '#F59E0B' };
  }
  return { text: `In ${diffDays} days`, color: '#22C55E' };
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
    .filter(({ diffDays }) => diffDays <= 30)
    .sort((a, b) => a.diffDays - b.diffDays);

  const displayItems = upcomingList.slice(0, 3);
  const showViewAll = upcomingList.length > 0;

  return (
    <div className="p-4 sm:p-6 rounded-[20px] bg-[#171A21] border border-[#2B313D]/60 space-y-4">
      {/* Header Row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-[28px] font-bold text-white tracking-tight leading-tight sm:leading-[34px]">
            Upcoming Renewals
          </h2>
          <p className="text-xs sm:text-[14px] font-normal text-[#A1AAB8] mt-0.5">
            Your next subscription payments
          </p>
        </div>
        {showViewAll && (
          <Link
            href="/renewals"
            prefetch={true}
            className="text-xs font-semibold text-[#4F46E5] hover:text-[#4338CA] flex items-center gap-1 cursor-pointer transition-colors pt-1 shrink-0"
          >
            <span>View all</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      {/* List Container / Empty State */}
      {displayItems.length === 0 ? (
        <div className="p-6 text-center bg-[#1D222B] border border-white/[0.04] rounded-2xl">
          <p className="text-base font-semibold text-white">
            No renewals in the next 30 days.
          </p>
          <p className="text-sm text-[#A1AAB8] mt-1">
            You&apos;re all caught up.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {displayItems.map(({ sub, diffDays }) => {
            const status = getRenewalStatus(diffDays);
            const price = Number(sub.price) || 0;
            const cycleSuffix = getCycleSuffix(sub.billing_cycle);
            const planName = getPlanName(sub);

            return (
              <div
                key={sub.id}
                className="flex flex-col sm:grid sm:grid-cols-[minmax(180px,1.5fr)_minmax(130px,1fr)_minmax(120px,auto)] items-start sm:items-center px-4 sm:px-5 py-3.5 bg-[#1D222B] border border-white/[0.04] rounded-2xl gap-2.5 sm:gap-4 cursor-default"
              >
                {/* 1. Service Logo + Name + Plan */}
                <div className="flex items-center gap-3.5 min-w-0 w-full sm:w-auto">
                  <ServiceIcon name={sub.name} category={sub.category} providerUrl={sub.provider_url} className="w-10 h-10 rounded-xl shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-sm sm:text-base font-semibold text-white block">
                      {sub.name}
                    </span>
                    <span className="text-xs sm:text-[14px] text-[#A1AAB8] block mt-0.5">
                      {planName}
                    </span>
                  </div>
                </div>

                {/* 2 & 3: Mobile sub-row (flex justify-between) / Desktop grid cells (sm:contents) */}
                <div className="flex sm:contents items-center justify-between w-full pt-2 sm:pt-0 border-t sm:border-t-0 border-white/[0.04] gap-2">
                  {/* 2. Renewal Status */}
                  <div className="flex items-center justify-start sm:justify-center text-left sm:text-center min-w-0">
                    <span
                      className="text-xs sm:text-sm font-semibold"
                      style={{ color: status.color }}
                    >
                      {status.text}
                    </span>
                  </div>

                  {/* 3. Single-line Price */}
                  <div className="text-right min-w-0 shrink-0 justify-self-end">
                    <span className="text-base sm:text-[20px] font-bold text-white">
                      {formatCurrency(price, sub.currency || 'USD')}
                    </span>
                    <span className="text-xs sm:text-[15px] font-normal text-[#A1AAB8]">
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
