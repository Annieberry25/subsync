'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { 
  fetchSubscriptions, 
  getCachedSubscriptions, 
  filterActiveSubscriptions,
  type SubscriptionRow 
} from '@/lib/services/subscription-service';
import { formatCurrency } from '@/lib/utils/metrics-utils';
import { ServiceIcon } from '@/components/ui/service-icon';
import { SubscriptionCardSkeleton } from '@/components/ui/skeleton';

function getPlanName(sub: SubscriptionRow): string {
  if (sub.notes && sub.notes.trim()) {
    return sub.notes.trim();
  }
  const cycleName = sub.billing_cycle ? sub.billing_cycle.charAt(0).toUpperCase() + sub.billing_cycle.slice(1) : 'Monthly';
  return `${cycleName} Subscription`;
}

function getRenewalStatus(diffDays: number) {
  if (diffDays < 0) {
    const days = Math.abs(diffDays);
    return {
      text: days === 1 ? 'Overdue by 1 day' : `Overdue by ${days} days`,
      color: '#D9363E',
    };
  }
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

export default function RenewalsPageContent() {
  const initialCache = getCachedSubscriptions();
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>(initialCache || []);
  const [loading, setLoading] = useState(!initialCache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchSubscriptions().then(({ data, error: err }) => {
      if (!active) return;
      if (err && subscriptions.length === 0) {
        setError(err.message || 'Failed to load subscriptions.');
      } else if (data) {
        setSubscriptions(data);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [subscriptions.length]);

  const { overdueList, upcomingRenewals } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allMapped = filterActiveSubscriptions(subscriptions)
      .filter((sub) => sub.status === 'active' || sub.status === 'trial')
      .map((sub) => {
        const nextDate = new Date(sub.next_billing_date);
        nextDate.setHours(0, 0, 0, 0);
        const diffTime = nextDate.getTime() - today.getTime();
        const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
        return { sub, diffDays };
      });

    const overdue = allMapped
      .filter(({ diffDays }) => diffDays < 0)
      .sort((a, b) => a.diffDays - b.diffDays);

    const upcoming = allMapped
      .filter(({ diffDays }) => diffDays >= 0 && diffDays <= 30)
      .sort((a, b) => a.diffDays - b.diffDays);

    return { overdueList: overdue, upcomingRenewals: upcoming };
  }, [subscriptions]);

  return (
    <div className="animate-page-transition space-y-4 sm:space-y-5 bg-ambient-grid pb-8 sm:pb-12 overflow-x-hidden">
      {/* Top-left Back Button */}
      <div>
        <Link
          href="/"
          prefetch={true}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>
      </div>

      {/* Accessible DOM Heading */}
      <h1 className="sr-only">Upcoming Renewals</h1>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-[#D9363E]/10 border border-[#D9363E]/20 flex items-center gap-3 text-[#D9363E] text-xs">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Overdue & Renewal Rows Container */}
      {loading && subscriptions.length === 0 ? (
        <div className="space-y-4">
          <SubscriptionCardSkeleton />
          <SubscriptionCardSkeleton />
          <SubscriptionCardSkeleton />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overdue Subscriptions Section */}
          {overdueList.length > 0 && (
            <div className="bg-[#0B0D0D] border border-[#D9363E]/30 rounded-[20px] p-4 sm:p-6 space-y-3.5 shadow-sm">
              <div className="flex items-center gap-2 border-b border-[#D9363E]/20 pb-3">
                <AlertCircle className="w-5 h-5 text-[#D9363E]" />
                <h2 className="text-base sm:text-lg font-bold text-[#D9363E]">
                  Overdue Subscriptions ({overdueList.length})
                </h2>
              </div>
              <div className="space-y-2.5">
                {overdueList.map(({ sub, diffDays }) => {
                  const status = getRenewalStatus(diffDays);
                  const price = Number(sub.price) || 0;
                  const cycleSuffix = getCycleSuffix(sub.billing_cycle);
                  const planName = getPlanName(sub);

                  return (
                    <div
                      key={sub.id}
                      className="flex flex-col sm:grid sm:grid-cols-[minmax(180px,1.5fr)_minmax(130px,1fr)_minmax(120px,auto)] items-start sm:items-center px-4 sm:px-5 py-3.5 bg-[#0D0F0F] border border-[#D9363E]/20 rounded-2xl transition-colors cursor-default gap-2.5 sm:gap-4 w-full"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 w-full sm:w-auto">
                        <ServiceIcon name={sub.name} category={sub.category} providerUrl={sub.provider_url} className="w-10 h-10 rounded-xl shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="text-sm sm:text-base font-semibold text-[#F5F7F6] block">
                            {sub.name}
                          </span>
                          <span className="text-xs sm:text-[14px] text-[#94A3B8] block mt-0.5">
                            {planName}
                          </span>
                        </div>
                      </div>

                      <div className="flex sm:contents items-center justify-between w-full pt-2 sm:pt-0 border-t sm:border-t-0 border-[#1A1D1D] gap-2">
                        <div className="flex items-center justify-start sm:justify-center text-left sm:text-center min-w-0">
                          <span className="text-xs sm:text-sm font-bold text-[#D9363E]">
                            Overdue ({Math.abs(diffDays)}d)
                          </span>
                        </div>

                        <div className="text-right min-w-0 shrink-0 justify-self-end">
                          <span className="text-base sm:text-[20px] font-bold text-[#F5F7F6]">
                            {formatCurrency(price, sub.currency || 'USD')}
                          </span>
                          <span className="text-xs sm:text-[15px] font-normal text-[#94A3B8]">
                            {cycleSuffix}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upcoming Renewals Section */}
          <div className="bg-[#0B0D0D] border border-[#1A1D1D] rounded-[20px] space-y-3.5 p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-bold text-[#F5F7F6] tracking-tight border-b border-[#1A1D1D] pb-3">
              Upcoming Renewals (Next 30 Days)
            </h2>
            {upcomingRenewals.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm font-medium text-[#F5F7F6]/80">
                  No upcoming renewals in the next 30 days.
                </p>
                <p className="text-xs text-[#94A3B8]/60 mt-1">
                  You&apos;re all caught up.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {upcomingRenewals.map(({ sub, diffDays }) => {
                  const status = getRenewalStatus(diffDays);
                  const price = Number(sub.price) || 0;
                  const cycleSuffix = getCycleSuffix(sub.billing_cycle);
                  const planName = getPlanName(sub);

                  return (
                    <div
                      key={sub.id}
                      className="flex flex-col sm:grid sm:grid-cols-[minmax(180px,1.5fr)_minmax(130px,1fr)_minmax(120px,auto)] items-start sm:items-center px-4 sm:px-5 py-3.5 bg-[#0B0D0D] border border-[#1A1D1D] rounded-2xl transition-colors cursor-default gap-2.5 sm:gap-4 w-full"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 w-full sm:w-auto">
                        <ServiceIcon name={sub.name} category={sub.category} providerUrl={sub.provider_url} className="w-10 h-10 rounded-xl shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="text-sm sm:text-base font-semibold text-[#F5F7F6] block">
                            {sub.name}
                          </span>
                          <span className="text-xs sm:text-[14px] text-[#94A3B8] block mt-0.5">
                            {planName}
                          </span>
                        </div>
                      </div>

                      <div className="flex sm:contents items-center justify-between w-full pt-2 sm:pt-0 border-t sm:border-t-0 border-[#1A1D1D] gap-2">
                        <div className="flex items-center justify-start sm:justify-center text-left sm:text-center min-w-0">
                          <span
                            className="text-xs sm:text-sm font-semibold"
                            style={{ color: status.color }}
                          >
                            {status.text}
                          </span>
                        </div>

                        <div className="text-right min-w-0 shrink-0 justify-self-end">
                          <span className="text-base sm:text-[20px] font-bold text-[#F5F7F6]">
                            {formatCurrency(price, sub.currency || 'USD')}
                          </span>
                          <span className="text-xs sm:text-[15px] font-normal text-[#94A3B8]">
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
        </div>
      )}
    </div>
  );
}
