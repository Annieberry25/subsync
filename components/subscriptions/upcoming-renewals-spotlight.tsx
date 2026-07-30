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
      <div className="glass-panel px-5 py-3.5 rounded-2xl border border-env-status-active-border bg-env-status-active-bg shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-env-status-active-bg text-env-status-active border border-env-status-active-border flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4.5 h-4.5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-env-heading">All Renewals On Track</h4>
            <p className="text-xs text-env-body">No subscriptions due for payment within the next 30 days.</p>
          </div>
        </div>
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-env-status-active-bg text-env-status-active border border-env-status-active-border">
          0 Payments Pending
        </span>
      </div>
    );
  }

  return (
    <div className="glass-panel px-5 py-4 rounded-2xl border border-env-status-warning-border bg-env-status-warning-bg space-y-3 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-env-main pb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-env-status-warning-bg text-env-status-warning border border-env-status-warning-border flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-env-heading tracking-tight">Upcoming Renewals Spotlight</h3>
              {urgentRenewals.length > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-env-status-danger-bg text-env-status-danger border border-env-status-danger-border animate-pulse">
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
            className="p-3.5 rounded-2xl bg-[var(--env-spotlight-card-bg)] hover:bg-[var(--env-spotlight-card-hover)] border border-[var(--env-spotlight-card-border)] transition-all flex items-center justify-between cursor-pointer group shadow-md"
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
                    ? 'bg-env-status-danger-bg text-env-status-danger border-env-status-danger-border animate-pulse'
                    : diffDays <= 7
                    ? 'bg-env-status-warning-bg text-env-status-warning border-env-status-warning-border'
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
