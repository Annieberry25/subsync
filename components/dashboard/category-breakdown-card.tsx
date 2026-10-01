'use client';

import { memo } from 'react';
import { calculateCategoryBreakdown } from '@/lib/utils/analytics-utils';
import { calculateMonthlySpend, formatCurrency } from '@/lib/utils/metrics-utils';
import type { SubscriptionRow } from '@/lib/services/subscription-service';
import { useCurrency } from '@/lib/contexts/user-settings-context';
import { PieChart, Tag } from 'lucide-react';

interface CategoryBreakdownCardProps {
  subscriptions: SubscriptionRow[];
  isEmbedded?: boolean;
}

// SubHalt Design System: Teal-Green & Near-Black Palette
const chartColorPalette = [
  { stroke: '#14B8A6', dot: 'bg-[#14B8A6]' }, // Primary Accent
  { stroke: '#9CA3AF', dot: 'bg-[#9CA3AF]' }, // Secondary Text
  { stroke: '#6B7280', dot: 'bg-[#6B7280]' }, // Muted Neutral
];

export const CategoryBreakdownCard = memo(function CategoryBreakdownCard({ subscriptions, isEmbedded = false }: CategoryBreakdownCardProps) {
  const { defaultCurrency, exchangeRates } = useCurrency();

  const breakdown = calculateCategoryBreakdown(subscriptions, defaultCurrency, exchangeRates);
  const totalMonthlySpend = calculateMonthlySpend(subscriptions, defaultCurrency, exchangeRates);

  // SVG Donut Chart Calculation
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const gapAngle = breakdown.length > 1 ? 2 : 0;
  const totalGap = gapAngle * breakdown.length;
  const availableCircumference = circumference - (totalGap * (circumference / 360));

  let accumulatedPercentage = 0;

  /* The centre text has to live inside the ring, so the amount steps down in
     size as the formatted string gets longer: "$25.00" (6 chars) renders at
     18/20px, anything past 8 chars drops a step, and past 11 chars — ₦1,500.00,
     $123,456.78 — drops again. `truncate` on the line is the backstop, so a
     pathological total degrades to an ellipsis rather than a collision. */
  const totalLabel = formatCurrency(totalMonthlySpend, defaultCurrency);
  const totalTextSize =
    totalLabel.length > 11 ? 'text-sm' : totalLabel.length > 8 ? 'text-base' : 'text-lg';

  return (
    <div className={isEmbedded ? "space-y-4 sm:space-y-6" : "p-4 sm:p-6 rounded-[20px] bg-[#0B0D0D] border border-[#1A1D1D] space-y-4 sm:space-y-6"}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <PieChart className="w-5 h-5 text-[#94A3B8] shrink-0" />
          <h2 className="text-base sm:text-lg font-semibold text-[#F5F7F6] tracking-tight">Spending by Category</h2>
        </div>
      </div>

      {breakdown.length === 0 ? (
        <div className="card-pad sm:p-8 text-center rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] space-y-2">
          <Tag className="w-8 h-8 text-[#94A3B8] mx-auto" />
          <p className="text-base font-semibold text-[#F5F7F6]">No active category spending</p>
          <p className="text-xs sm:text-[15px] text-[#94A3B8]">Add active subscriptions to view category distribution.</p>
        </div>
      ) : (
        <div className={isEmbedded ? "grid grid-cols-1 gap-6 items-center" : "grid grid-cols-1 lg:grid-cols-12 gap-6 items-center"}>
          {/* Donut Chart with Center Total Spend */}
          <div className={isEmbedded ? "flex flex-col items-center justify-center relative py-2" : "lg:col-span-5 flex flex-col items-center justify-center relative py-2"}>
            <div className={isEmbedded ? "relative w-36 h-36 sm:w-40 sm:h-40 flex items-center justify-center" : "relative w-44 h-44 sm:w-56 sm:h-56 flex items-center justify-center"}>
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

              {/* Center Content. The donut hole is r=68 with an 18px stroke, so
                  the usable inner diameter is 2*(68-9) = 118 of the 180 viewBox —
                  about 65% of the box. Content is capped to that width and the
                  amount steps down in size as it gets longer, otherwise wide
                  amounts like $1,234.56 spill across the ring. */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[62%] text-center">
                  <span className="block text-[9px] sm:text-[10px] font-medium text-[#94A3B8] uppercase tracking-wider truncate">
                    Total Monthly
                  </span>
                  <span
                    className={`block font-bold text-[#F5F7F6] tracking-tight truncate leading-tight ${totalTextSize}`}
                    title={totalLabel}
                  >
                    {totalLabel}
                  </span>
                  <span className="block text-[9px] sm:text-[10px] text-[#94A3B8] truncate">
                    {breakdown.length} {breakdown.length === 1 ? 'category' : 'categories'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Breakdown List on Right */}
          <div className={isEmbedded ? "divide-y divide-[#1A1D1D]/60" : "lg:col-span-7 divide-y divide-[#1A1D1D]/60"}>
            {breakdown.map((item, idx) => {
              const categoryStyle = chartColorPalette[idx % chartColorPalette.length];

              return (
                <div
                  key={item.category}
                  className={isEmbedded ? "py-2.5 px-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4" : "py-3 px-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4"}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${categoryStyle.dot} shrink-0`}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-semibold text-[#F5F7F6] block">{item.category}</span>
                      <span className="text-xs text-[#94A3B8] block">
                        {item.count} {item.count === 1 ? 'plan' : 'plans'}
                      </span>
                    </div>
                  </div>

                  <div className="sm:text-right shrink-0 flex items-center justify-between sm:justify-end gap-3 sm:gap-4 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-[#1A1D1D]/60">
                    <div>
                      <span className="text-sm font-semibold text-[#F5F7F6] block">
                        {formatCurrency(item.monthlySpend, defaultCurrency)}
                      </span>
                      <span className="text-xs text-[#94A3B8] block">
                        / mo
                      </span>
                    </div>
                    <span className="text-xs font-medium text-[#94A3B8] min-w-[48px] text-right">
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
});
