'use client';

import { TrendingUp, TrendingDown, Calendar, PieChart, Zap } from 'lucide-react';
import type { BillSpendingSummary } from '@/lib/types/bills.types';
import { formatCurrencyAmount } from '@/lib/services/currency-service';
import { useUserSettings } from '@/lib/contexts/user-settings-context';

interface CompactMonthlySummaryCardProps {
  summary: BillSpendingSummary;
}

/**
 * Compact Monthly Summary Card — placed directly below header on mobile and desktop.
 */
export function CompactMonthlySummaryCard({ summary }: CompactMonthlySummaryCardProps) {
  const { defaultCurrency } = useUserSettings();

  const formattedTotalThisMonth = formatCurrencyAmount(summary.totalThisMonth, defaultCurrency);
  const formattedPrevMonth = formatCurrencyAmount(summary.previousMonthTotal, defaultCurrency);

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-[#090C0B] border border-[#161F1D] shadow-sm flex flex-col justify-between transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#94A3B8] tracking-tight">
          Total this month
        </span>
        <span className="text-[11px] font-semibold text-[#94A3B8] px-2.5 py-0.5 rounded-full bg-[#161F1D] border border-[#222B28]">
          {summary.totalCountThisMonth} {summary.totalCountThisMonth === 1 ? 'payment' : 'payments'}
        </span>
      </div>

      <div className="mt-2 flex items-baseline justify-between flex-wrap gap-1">
        <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F5F7F6]">
          {formattedTotalThisMonth}
        </div>

        {/* Semantic Delta vs last month */}
        <div className="flex items-center gap-1.5 text-xs">
          {summary.percentageChange !== null ? (
            <span
              className={`px-2 py-0.5 rounded-md font-semibold text-[11px] flex items-center gap-1 ${
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
            <span className="text-[11px] text-[#94A3B8]">Initial month</span>
          )}
          <span className="text-[11px] text-[#94A3B8] hidden sm:inline">
            vs last month ({formattedPrevMonth})
          </span>
        </div>
      </div>
    </div>
  );
}

interface BillAnalyticsInsightsProps {
  summary: BillSpendingSummary;
  onFilterCategory?: (category: string) => void;
}

/**
 * Insights Section — deeper analytics rendered BELOW the primary payment list.
 */
export function BillAnalyticsInsights({
  summary,
  onFilterCategory,
}: BillAnalyticsInsightsProps) {
  const { defaultCurrency } = useUserSettings();

  const formattedRecurring = formatCurrencyAmount(summary.recurringMonthlyTotal, defaultCurrency);

  return (
    <div className="space-y-4 pt-4 border-t border-[#161F1D]">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#F5F7F6] tracking-tight flex items-center gap-2">
          <PieChart className="w-4 h-4 text-[#F5F7F6]" />
          <span>Insights & Analytics</span>
        </h3>
        <span className="text-[11px] text-[#94A3B8]">Monthly Breakdown</span>
      </div>

      {/* Analytics Cards — Minimal Neutral Surface */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Card 1: Recurring Commitment */}
        <div className="p-4 rounded-2xl bg-[#090C0B] border border-[#161F1D] space-y-2">
          <div className="flex items-center justify-between text-xs text-[#94A3B8]">
            <span>Recurring Bill Commitment</span>
            <Calendar className="w-3.5 h-3.5 text-[#F5F7F6]" />
          </div>
          <div className="text-lg font-bold text-[#F5F7F6]">
            {formattedRecurring} <span className="text-xs font-normal text-[#94A3B8]">/mo</span>
          </div>
          <p className="text-[11px] text-[#94A3B8]">
            Calculated monthly total of recurring utilities & services
          </p>
        </div>

        {/* Card 2: Highest Spending Category */}
        <div className="p-4 rounded-2xl bg-[#090C0B] border border-[#161F1D] space-y-2">
          <div className="flex items-center justify-between text-xs text-[#94A3B8]">
            <span>Highest Category</span>
            <Zap className="w-3.5 h-3.5 text-[#F5F7F6]" />
          </div>
          {summary.categoryBreakdown.length > 0 ? (
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#F5F7F6] truncate">
                  {summary.categoryBreakdown[0].category}
                </span>
                <span className="text-xs font-semibold text-[#F5F7F6]">
                  {summary.categoryBreakdown[0].percentage}%
                </span>
              </div>
              <p className="text-[11px] text-[#94A3B8]">
                {formatCurrencyAmount(summary.categoryBreakdown[0].totalAmount, defaultCurrency)} total
              </p>
            </div>
          ) : (
            <p className="text-xs text-[#94A3B8]">No category data recorded yet.</p>
          )}
        </div>
      </div>

      {/* Category Spending Breakdown — Clean White Fills */}
      {summary.categoryBreakdown.length > 0 && (
        <div className="p-4 rounded-2xl bg-[#090C0B] border border-[#161F1D] space-y-3">
          <span className="text-xs font-semibold text-[#F5F7F6] block">
            Spending by Category
          </span>

          <div className="space-y-3">
            {summary.categoryBreakdown.map((cat) => (
              <div
                key={cat.category}
                onClick={() => onFilterCategory?.(cat.category)}
                className="group cursor-pointer space-y-1"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#F5F7F6] group-hover:text-[#14B8A6] transition-colors">
                    {cat.category}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[#94A3B8]">
                      {formatCurrencyAmount(cat.totalAmount, defaultCurrency)}
                    </span>
                    <span className="text-xs font-semibold text-[#F5F7F6]">
                      {cat.percentage}%
                    </span>
                  </div>
                </div>

                <div className="w-full h-2 bg-[#050706] rounded-full overflow-hidden border border-[#161F1D]">
                  <div
                    className="h-full rounded-full transition-all duration-500 bg-[#F5F7F6]"
                    style={{
                      width: `${Math.max(cat.percentage, 4)}%`,
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

export default function BillSpendingSummaryComponent({
  summary,
  onFilterCategory,
}: BillAnalyticsInsightsProps) {
  return (
    <div className="space-y-4">
      <CompactMonthlySummaryCard summary={summary} />
      <BillAnalyticsInsights summary={summary} onFilterCategory={onFilterCategory} />
    </div>
  );
}
