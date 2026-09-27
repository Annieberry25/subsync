'use client';

import { useCallback, useEffect, useState } from 'react';
import { Users, UserPlus, CreditCard, Plug, DollarSign, Activity as ActivityIcon } from 'lucide-react';
import type { AdminOverview } from '@/lib/types/admin.types';
import { StatCard, LoadingState, ErrorState, EmptyState, formatMoney, formatDateTime } from '@/components/admin/admin-ui';

export default function AdminOverviewTab() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/overview');
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Failed to load admin overview.');
        return;
      }
      setError(null);
      setOverview(data as AdminOverview);
    } catch {
      setError('Failed to load admin overview.');
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => load());
  }, [load]);

  if (error) return <ErrorState message={error} />;
  if (!overview) return <LoadingState label="Loading admin overview…" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={Users} label="Total Users" value={overview.totalUsers.toLocaleString()} />
        <StatCard icon={UserPlus} label="New Users (30d)" value={overview.activeUsers30d.toLocaleString()} />
        <StatCard icon={CreditCard} label="Active Subscriptions" value={overview.activeSubscriptions.toLocaleString()} />
        <StatCard icon={CreditCard} label="Paid Plans" value={overview.paidPlans.toLocaleString()} />
        <StatCard icon={DollarSign} label="MRR (USD)" value={formatMoney(overview.estimatedMrrUsd, 'USD')} />
        <StatCard icon={Plug} label="Gmail Links" value={overview.gmailConnections.toLocaleString()} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard icon={CreditCard} label="All Subscriptions" value={overview.totalSubscriptions.toLocaleString()} />
        <StatCard icon={CreditCard} label="Plan Payments" value={overview.totalPlanSubscriptions.toLocaleString()} />
        <StatCard icon={CreditCard} label="Pending" value={overview.pendingPlans.toLocaleString()} />
        <StatCard icon={CreditCard} label="Failed" value={overview.failedPlans.toLocaleString()} />
        <StatCard icon={ActivityIcon} label="Bill Payments" value={overview.billPayments.toLocaleString()} />
        <StatCard icon={ActivityIcon} label="AI Conversations" value={overview.aiConversations.toLocaleString()} />
      </div>

      <div className="rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D]">
        <div className="px-4 sm:px-5 py-4 border-b border-[#1A1D1D]">
          <h2 className="text-sm font-semibold text-[#F5F7F6] tracking-tight">Recent Activity</h2>
        </div>
        {overview.recentActivity.length === 0 ? (
          <div className="p-2">
            <EmptyState message="No activity recorded yet." />
          </div>
        ) : (
          <ul className="divide-y divide-[#1A1D1D]">
            {overview.recentActivity.map((item) => (
              <li key={item.id} className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#F5F7F6] truncate">{item.title}</p>
                  <p className="text-[11px] text-[#94A3B8] truncate">
                    {item.email}
                    {item.type ? <span className="mx-1.5 text-[#3F3F46]">·</span> : null}
                    {item.type}
                    <span className="mx-1.5 text-[#3F3F46]">·</span>
                    {formatDateTime(item.timestamp)}
                  </p>
                </div>
                {item.amount != null ? (
                  <span className="text-xs font-semibold text-[#F5F7F6] shrink-0">
                    {formatMoney(item.amount, item.currency ?? undefined)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}