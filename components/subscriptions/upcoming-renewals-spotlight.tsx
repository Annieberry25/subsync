'use client';

import { AlertTriangle, ShieldCheck } from 'lucide-react';
import type { SubscriptionRow } from '@/lib/services/subscription-service';
import { formatCurrency } from '@/lib/utils/metrics-utils';
import { ServiceIcon } from '@/components/ui/service-icon';

interface UpcomingRenewalsSpotlightProps {
  subscriptions: SubscriptionRow[];
  onEdit: (subscription: SubscriptionRow) => void;
}

export function UpcomingRenewalsSpotlight({ subscriptions, onEdit }: UpcomingRenewalsSpotlightProps) {
  const today = new Date();

  // Find subscriptions due within 30 days, sorted by soonest first
  const upcomingList = subscriptions
    .filter((sub) => sub.status === 'active' || sub.status === 'trial')
    .map((sub) => {
      const nextDate = new Date(sub.next_billing_date);
      const diffTime = nextDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24));
      return { sub, diffDays };
    })
    .filter((item) => item.diffDays >= 0 && item.diffDays <= 30)
    .sort((a, b) => a.diffDays - b.diffDays);

  const urgentRenewals = upcomingList.filter((item) => item.diffDays <= 7);
  const totalUpcomingCost = upcomingList.reduce((acc, item) => acc + Number(item.sub.price), 0);

  if (upcomingList.length === 0) {
    return (
      <div className="glass-panel p-6 rounded-3xl border border-emerald-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-env-heading">All Renewals On Track</h4>
            <p className="text-xs text-env-body">No subscriptions due for payment within the next 30 days.</p>
          </div>
        </div>
        <span className="text-xs font-semibold px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          0 Payments Pending
        </span>
      </div>
    );
  }

  return (
    <div className="glass-panel p-6 rounded-3xl border border-amber-500/30 space-y-4 shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-env-main pb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-env-heading tracking-tight">Upcoming Renewals Spotlight</h3>
              {urgentRenewals.length > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
                  {urgentRenewals.length} Critical
                </span>
              )}
            </div>
            <p className="text-xs text-env-body">
              {upcomingList.length} subscription(s) due within 30 days • Total due: <strong className="text-env-heading">{formatCurrency(totalUpcomingCost)}</strong>
            </p>
          </div>
        </div>

        <div className="text-xs text-env-muted font-medium">
          Next 30 Days Forecast
        </div>
      </div>

      {/* Horizontal Scroll / Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {upcomingList.slice(0, 3).map(({ sub, diffDays }) => (
          <div
            key={sub.id}
            onClick={() => onEdit(sub)}
            className="p-3.5 rounded-2xl bg-env-button-sec hover:bg-env-badge border border-env-main transition-all flex items-center justify-between cursor-pointer group shadow-md"
          >
            <div className="flex items-center gap-3 min-w-0">
              <ServiceIcon name={sub.name} category={sub.category} className="w-9 h-9 shrink-0" />
              <div className="min-w-0">
                <span className="text-xs font-bold text-env-heading block truncate group-hover:text-env-accent transition-colors">
                  {sub.name}
                </span>
                <span className="text-[11px] text-env-body block font-medium">
                  {formatCurrency(Number(sub.price), sub.currency)} / {sub.billing_cycle}
                </span>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span
                className={`text-[10px] font-extrabold px-2.5 py-1 rounded-xl border block ${
                  diffDays <= 3
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                    : diffDays <= 7
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-env-badge text-env-body border-env-main'
                }`}
              >
                {diffDays === 0 ? 'Due Today' : `In ${diffDays}d`}
              </span>
              <span className="text-[10px] text-env-muted mt-0.5 block">{sub.next_billing_date}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
