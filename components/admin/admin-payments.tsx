'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AdminPlanSubscriptionRow } from '@/lib/types/admin.types';
import { LoadingState, ErrorState, EmptyState, StatusBadge, formatMoney, formatDateTime } from '@/components/admin/admin-ui';

type StatusFilter = 'all' | 'pending' | 'paid' | 'failed' | 'cancelled' | 'expired';

export default function AdminPaymentsTab() {
  const [rows, setRows] = useState<AdminPlanSubscriptionRow[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/plan-subscriptions');
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Failed to load plan subscriptions.');
        return;
      }
      setError(null);
      setRows(data.rows ?? []);
    } catch {
      setError('Failed to load plan subscriptions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => load());
  }, [load]);

  const filtered = filter === 'all' ? rows : rows.filter((r) => r.status === filter);

  const totals = {
    paid: rows.filter((r) => r.status === 'paid').length,
    pending: rows.filter((r) => r.status === 'pending').length,
    failed: rows.filter((r) => r.status === 'failed').length,
    paidUsd: rows.filter((r) => r.status === 'paid').reduce((s, r) => s + r.amount, 0) / 100,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] p-4">
          <p className="text-xs text-[#94A3B8]">Total</p>
          <p className="mt-1 text-xl font-semibold text-[#F5F7F6]">{rows.length.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] p-4">
          <p className="text-xs text-[#94A3B8]">Paid</p>
          <p className="mt-1 text-xl font-semibold text-[#14B8A6]">{totals.paid.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] p-4">
          <p className="text-xs text-[#94A3B8]">Pending</p>
          <p className="mt-1 text-xl font-semibold text-[#F59E0B]">{totals.pending.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] p-4">
          <p className="text-xs text-[#94A3B8]">Collected (USD)</p>
          <p className="mt-1 text-xl font-semibold text-[#F5F7F6]">{formatMoney(totals.paidUsd, 'USD')}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter plan payments by status">
        {(['all', 'paid', 'pending', 'failed', 'cancelled', 'expired'] as StatusFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`px-3 py-1.5 min-h-[44px] rounded-lg text-[11px] font-medium capitalize transition-colors cursor-pointer ${
              filter === f
                ? 'bg-[#1A1D1D] text-[#F5F7F6] border border-[#1A1D1D]'
                : 'text-[#94A3B8] hover:text-[#F5F7F6] border border-transparent'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState message={error} />
      ) : loading ? (
        <LoadingState label="Loading payments…" />
      ) : filtered.length === 0 ? (
        <EmptyState message="No plan subscriptions match this filter." />
      ) : (
        <div className="rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] table-scroll">
          <table className="w-full min-w-[820px] text-left">
            <thead className="border-b border-[#1A1D1D]">
              <tr className="text-[11px] uppercase tracking-wider text-[#94A3B8]">
                <th className="px-4 py-3 font-medium table-sticky-col">User</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1D1D]">
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-[#0D0F0F] transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-xs font-semibold text-[#F5F7F6] truncate max-w-[220px]">{row.email}</p>
                    <p className="text-[11px] text-[#94A3B8] truncate max-w-[220px]">{row.full_name || '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#F5F7F6] capitalize">{row.plan}</td>
                  <td className="px-4 py-3 text-xs text-[#F5F7F6]">
                    {row.amount > 0 ? formatMoney(row.amount / 100, row.currency) : '—'}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                  <td className="px-4 py-3 text-[11px] text-[#94A3B8] font-mono truncate max-w-[180px]">{row.paystack_reference}</td>
                  <td className="px-4 py-3 text-xs text-[#94A3B8]">{formatDateTime(row.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}