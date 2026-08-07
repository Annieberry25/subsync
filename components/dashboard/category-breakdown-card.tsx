import { calculateCategoryBreakdown } from '@/lib/utils/analytics-utils';
import { calculateMonthlySpend, formatCurrency } from '@/lib/utils/metrics-utils';
import type { SubscriptionRow } from '@/lib/services/subscription-service';
import { PieChart, Tag } from 'lucide-react';

interface CategoryBreakdownCardProps {
  subscriptions: SubscriptionRow[];
}

// SubSync Design System v2.0: Monochromatic Palette
const chartColorPalette = [
  { stroke: '#4F46E5', dot: 'bg-[#4F46E5]' }, // Primary Accent
  { stroke: '#A1AAB8', dot: 'bg-[#A1AAB8]' }, // Secondary Text
  { stroke: '#6F7787', dot: 'bg-[#6F7787]' }, // Muted Neutral
];

export function CategoryBreakdownCard({ subscriptions }: CategoryBreakdownCardProps) {
  const breakdown = calculateCategoryBreakdown(subscriptions);
  const totalMonthlySpend = calculateMonthlySpend(subscriptions);

  // SVG Donut Chart Calculation
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const gapAngle = breakdown.length > 1 ? 2 : 0;
  const totalGap = gapAngle * breakdown.length;
  const availableCircumference = circumference - (totalGap * (circumference / 360));

  let accumulatedPercentage = 0;

  return (
    <div className="p-6 rounded-[20px] bg-[#171A21] border border-[#2B313D] space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <PieChart className="w-5 h-5 text-[#6F7787]" />
          <div>
            <h2 className="text-[28px] font-bold text-white tracking-tight leading-[36px]">Spending by Category</h2>
            <p className="text-[15px] text-[#A1AAB8] font-normal leading-[22px]">Monthly expense allocation by category</p>
          </div>
        </div>
      </div>

      {breakdown.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-[#1D222B] border border-[#2B313D] space-y-2">
          <Tag className="w-8 h-8 text-[#6F7787] mx-auto" />
          <p className="text-base font-semibold text-white">No active category spending</p>
          <p className="text-[15px] text-[#A1AAB8]">Add active subscriptions to view category distribution.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Donut Chart with Center Total Spend */}
          <div className="md:col-span-5 flex flex-col items-center justify-center relative py-2">
            <div className="relative w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 180 180">
                {/* Background Ring */}
                <circle
                  cx="90"
                  cy="90"
                  r={radius}
                  stroke="#2B313D"
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
                      <title>{`${item.category}: ${formatCurrency(item.monthlySpend)} (${item.percentage.toFixed(1)}%)`}</title>
                    </circle>
                  );
                })}
              </svg>

              {/* Center Content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none p-2">
                <span className="text-[13px] font-medium text-[#6F7787] uppercase tracking-wider block">
                  Total Monthly
                </span>
                <span className="text-2xl font-bold text-white tracking-tight block">
                  {formatCurrency(totalMonthlySpend)}
                </span>
                <span className="text-[13px] text-[#6F7787] block">
                  {breakdown.length} {breakdown.length === 1 ? 'category' : 'categories'}
                </span>
              </div>
            </div>
          </div>

          {/* Breakdown List on Right */}
          <div className="md:col-span-7 space-y-2.5">
            {breakdown.map((item, idx) => {
              const categoryStyle = chartColorPalette[idx % chartColorPalette.length];

              return (
                <div
                  key={item.category}
                  className="p-3.5 rounded-2xl border border-[#2B313D] bg-[#1D222B] flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-3 h-3 rounded-full ${categoryStyle.dot} shrink-0`}
                    />
                    <div className="min-w-0 truncate">
                      <span className="text-base font-semibold text-white block truncate">{item.category}</span>
                      <span className="text-[15px] text-[#A1AAB8] block truncate">
                        {item.count} {item.count === 1 ? 'plan' : 'plans'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex items-center gap-4">
                    <div>
                      <span className="text-base font-semibold text-white block">
                        {formatCurrency(item.monthlySpend)}
                      </span>
                      <span className="text-[13px] text-[#6F7787] block">
                        / mo
                      </span>
                    </div>
                    <span className="text-xs font-medium text-white bg-[#2B313D] px-2.5 py-1 rounded-lg min-w-[50px] text-center">
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
