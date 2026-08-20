'use client';

import { TrendingUp, TrendingDown, DollarSign, Calendar, Zap, PieChart, Building2, CreditCard, ArrowRight } from 'lucide-react';
import type { BillSpendingSummary } from '@/lib/types/bills.types';
import { formatCurrencyAmount } from '@/lib/services/currency-service';
import { useUserSettings } from '@/lib/contexts/user-settings-context';

interface BillSpendingSummaryProps {
  summary: BillSpendingSummary;
  onFilterCategory?: (category: string) => void;
}

export default function BillSpendingSummaryComponent({
  summary,
  onFilterCategory,
}: BillSpendingSummaryProps) {
  const { defaultCurrency } = useUserSettings();

  const formattedTotalThisMonth = formatCurrencyAmount(summary.totalThisMonth, defaultCurrency);
  const formattedPrevMonth = formatCurrencyAmount(summary.previousMonthTotal, defaultCurrency);
  const formattedRecurring = formatCurrencyAmount(summary.recurringMonthlyTotal, defaultCurrency);

  // Original currency list representation e.g. "₦53,000 NGN + $45.00 USD"
  const rawCurrenciesStr = Object.entries(summary.totalThisMonthOriginalCurrencies)
    .map(([curr, amt]) => formatCurrencyAmount(amt, curr))
    .join(' + ');

  return (
    <div className="space-y-6">
      {/* Top 3 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Spending This Month */}
        <div className="p-5 rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] relative overflow-hidden group hover:border-[#14B8A6]/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#94A3B8]">Total Bills This Month</span>
            <div className="w-9 h-9 rounded-xl bg-[#14B8A6]/10 border border-[#14B8A6]/30 flex items-center justify-center text-[#14B8A6]">
              <Zap className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-[#F5F7F6] tracking-tight">
                {formattedTotalThisMonth}
              </span>
              <span className="text-xs font-bold text-[#14B8A6]">{defaultCurrency}</span>
            </div>

            {/* Original currency note if present */}
            {rawCurrenciesStr ? (
              <p className="text-[11px] text-[#94A3B8] mt-1.5 truncate">
                Original: <span className="text-[#F5F7F6] font-medium">{rawCurrenciesStr}</span>
              </p>
            ) : null}
          </div>

          {/* Mo/Mo Delta */}
          <div className="mt-4 pt-3 border-t border-[#1A1D1D]/70 flex items-center justify-between text-xs">
            <span className="text-[#94A3B8]">vs Last Month ({formattedPrevMonth})</span>
            {summary.percentageChange !== null ? (
              <span
                className={`px-2 py-0.5 rounded-full font-bold text-[10px] flex items-center gap-1 ${
                  summary.percentageChange > 0
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}
              >
                {summary.percentageChange > 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {summary.percentageChange > 0 ? `+${summary.percentageChange}%` : `${summary.percentageChange}%`}
              </span>
            ) : (
              <span className="text-[11px] text-[#64748B]">Initial Month</span>
            )}
          </div>
        </div>

        {/* Card 2: Monthly Recurring Commitment */}
        <div className="p-5 rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] relative overflow-hidden group hover:border-[#14B8A6]/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#94A3B8]">Recurring Bill Commitment</span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Calendar className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-[#F5F7F6] tracking-tight">
                {formattedRecurring}
              </span>
              <span className="text-xs text-[#94A3B8]">/mo</span>
            </div>
            <p className="text-[11px] text-[#94A3B8] mt-1.5">
              Calculated monthly cost of recurring utilities & services
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-[#1A1D1D]/70 flex items-center justify-between text-xs">
            <span className="text-[#94A3B8]">Recorded Payments</span>
            <span className="font-semibold text-[#F5F7F6]">{summary.totalCountThisMonth} payments</span>
          </div>
        </div>

        {/* Card 3: Top Category */}
        <div className="p-5 rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] relative overflow-hidden group hover:border-[#14B8A6]/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#94A3B8]">Highest Spending Category</span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <PieChart className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3">
            {summary.categoryBreakdown.length > 0 ? (
              <>
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-bold text-[#F5F7F6] truncate">
                    {summary.categoryBreakdown[0].category}
                  </span>
                  <span className="text-xs font-bold text-[#14B8A6]">
                    {summary.categoryBreakdown[0].percentage}%
                  </span>
                </div>
                <p className="text-[11px] text-[#94A3B8] mt-1">
                  {formatCurrencyAmount(summary.categoryBreakdown[0].totalAmount, defaultCurrency)} total
                </p>
              </>
            ) : (
              <p className="text-xs text-[#64748B] mt-2">No category data recorded yet.</p>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-[#1A1D1D]/70 flex items-center justify-between text-xs">
            <span className="text-[#94A3B8]">Active Categories</span>
            <span className="font-semibold text-[#F5F7F6]">{summary.categoryBreakdown.length} active</span>
          </div>
        </div>
      </div>

      {/* Category Spending Breakdown Bars */}
      {summary.categoryBreakdown.length > 0 && (
        <div className="p-6 rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D]">
          <h3 className="text-sm font-bold text-[#F5F7F6] mb-4 flex items-center justify-between">
            <span>Category Spending Breakdown</span>
            <span className="text-xs font-medium text-[#94A3B8]">This Month</span>
          </h3>

          <div className="space-y-4">
            {summary.categoryBreakdown.map((cat) => (
              <div
                key={cat.category}
                onClick={() => onFilterCategory?.(cat.category)}
                className="group cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-[#F5F7F6] group-hover:text-[#14B8A6] transition-colors">
                    {cat.category}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[#94A3B8] font-mono">
                      {formatCurrencyAmount(cat.totalAmount, defaultCurrency)}
                    </span>
                    <span className="text-xs font-bold text-[#F5F7F6] min-w-[36px] text-right">
                      {cat.percentage}%
                    </span>
                  </div>
                </div>

                <div className="w-full h-2.5 bg-[#000000] rounded-full overflow-hidden border border-[#1A1D1D]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(cat.percentage, 3)}%`,
                      backgroundColor: cat.color || '#14B8A6',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
