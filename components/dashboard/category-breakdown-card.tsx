'use client';

import { calculateCategoryBreakdown } from '@/lib/utils/analytics-utils';
import { calculateMonthlySpend, formatCurrency } from '@/lib/utils/metrics-utils';
import type { SubscriptionRow } from '@/lib/services/subscription-service';
import { useUserSettings } from '@/lib/contexts/user-settings-context';
import { PieChart, Tag } from 'lucide-react';

interface CategoryBreakdownCardProps {
  subscriptions: SubscriptionRow[];
}

// SubSync Design System: Teal-Green & Near-Black Palette
const chartColorPalette = [
  { stroke: '#14B8A6', dot: 'bg-[#14B8A6]' }, // Primary Accent
  { stroke: '#9CA3AF', dot: 'bg-[#9CA3AF]' }, // Secondary Text
  { stroke: '#6B7280', dot: 'bg-[#6B7280]' }, // Muted Neutral
];

export function CategoryBreakdownCard({ subscriptions }: CategoryBreakdownCardProps) {
  const { defaultCurrency, exchangeRates } = useUserSettings();

  const breakdown = calculateCategoryBreakdown(subscriptions, defaultCurrency, exchangeRates);
  const totalMonthlySpend = calculateMonthlySpend(subscriptions, defaultCurrency, exchangeRates);

  // SVG Donut Chart Calculation
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const gapAngle = breakdown.length > 1 ? 2 : 0;
  const totalGap = gapAngle * breakdown.length;
  const availableCircumference = circumference - (totalGap * (circumference / 360));

  let accumulatedPercentage = 0;

  return (
    <div className="p-4 sm:p-6 rounded-[20px] bg-[#0B0D0D] border border-[#1A1D1D] space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <PieChart className="w-5 h-5 text-[#94A3B8] shrink-0" />
          <h2 className="text-base sm:text-lg font-semibold text-[#F5F7F6] tracking-tight">Spending by Category</h2>
        </div>
      </div>

      {breakdown.length === 0 ? (
        <div className="p-6 sm:p-8 text-center rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] space-y-2">
          <Tag className="w-8 h-8 text-[#94A3B8] mx-auto" />
          <p className="text-base font-semibold text-[#F5F7F6]">No active category spending</p>
          <p className="text-xs sm:text-[15px] text-[#94A3B8]">Add active subscriptions to view category distribution.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Donut Chart with Center Total Spend */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center relative py-2">
            <div className="relative w-44 h-44 sm:w-56 sm:h-56 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 180 180">
                {/* Background Ring */}
                <circle
                  cx="90"
                  cy="90"
                  r={radius}
                  stroke="#1A1D1D"
                  strokeWidth="18"
                  fill="none"
                />

                {/* Donut Arcs */}
                {breakdown.map((item, idx) => {
                  const categoryStyle = chartColorPalette[idx % chartColorPalette.length];
                  const itemFraction = item.percentage / 100;
                  const strokeDash = itemFraction * availableCircumference;
                  const strokeOffset = -(accumulatedPercentage / 100) * availableCircumference - (accumulatedPercentage > 0 ? (gapAngle * accumulatedPercentage) : 0);
                  
                  accumulatedPercentage += item.percentage;

                  return (
                    <circle
                      key={item.category}
                      cx="90"
                      cy="90"
                      r={radius}
                      stroke={categoryStyle.stroke}
                      strokeWidth={18}
                      strokeDasharray={`${strokeDash} ${circumference}`}
                      strokeDashoffset={strokeOffset}
                      strokeLinecap="round"
                      fill="none"
                    >
                      <title>{`${item.category}: ${formatCurrency(item.monthlySpend, defaultCurrency)} (${item.percentage.toFixed(1)}%)`}</title>
                    </circle>
                  );
                })}
              </svg>

              {/* Center Content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none p-2">
                <span className="text-[11px] sm:text-[13px] font-medium text-[#94A3B8] uppercase tracking-wider block">
                  Total Monthly
                </span>
                <span className="text-xl sm:text-2xl font-bold text-[#F5F7F6] tracking-tight block">
                  {formatCurrency(totalMonthlySpend, defaultCurrency)}
                </span>
                <span className="text-[11px] sm:text-[13px] text-[#94A3B8] block">
                  {breakdown.length} {breakdown.length === 1 ? 'category' : 'categories'}
                </span>
              </div>
            </div>
          </div>

          {/* Breakdown List on Right */}
          <div className="lg:col-span-7 space-y-2.5">
            {breakdown.map((item, idx) => {
              const categoryStyle = chartColorPalette[idx % chartColorPalette.length];

              return (
                <div
                  key={item.category}
                  className="p-3 sm:p-3.5 rounded-2xl border border-[#1A1D1D] bg-[#0B0D0D] flex flex-col xs:flex-row xs:items-center justify-between gap-2.5 sm:gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-3 h-3 rounded-full ${categoryStyle.dot} shrink-0`}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-sm sm:text-base font-semibold text-[#F5F7F6] block">{item.category}</span>
                      <span className="text-xs sm:text-[15px] text-[#94A3B8] block">
                        {item.count} {item.count === 1 ? 'plan' : 'plans'}
                      </span>
                    </div>
                  </div>

                  <div className="text-left xs:text-right shrink-0 flex items-center justify-between xs:justify-end gap-3 sm:gap-4 w-full xs:w-auto pt-2 xs:pt-0 border-t xs:border-t-0 border-[#1A1D1D]/60">
                    <div>
                      <span className="text-sm sm:text-base font-semibold text-[#F5F7F6] block">
                        {formatCurrency(item.monthlySpend, defaultCurrency)}
                      </span>
                      <span className="text-xs sm:text-[13px] text-[#94A3B8] block">
                        / mo
                      </span>
                    </div>
                    <span className="text-xs font-medium text-[#F5F7F6] bg-[#1A1D1D] px-2.5 py-1 rounded-lg min-w-[48px] sm:min-w-[50px] text-center">
                      {item.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
