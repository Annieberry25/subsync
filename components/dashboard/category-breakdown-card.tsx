'use client';

import { useState } from 'react';
import { calculateCategoryBreakdown } from '@/lib/utils/analytics-utils';
import { calculateMonthlySpend, formatCurrency } from '@/lib/utils/metrics-utils';
import type { SubscriptionRow } from '@/lib/services/subscription-service';
import { PieChart, Tag, ChevronRight } from 'lucide-react';

interface CategoryBreakdownCardProps {
  subscriptions: SubscriptionRow[];
}

const categoryColors: Record<string, { stroke: string; dot: string; text: string }> = {
  Streaming: { stroke: '#a855f7', dot: 'bg-purple-500', text: 'text-purple-400' },
  Software: { stroke: '#6366f1', dot: 'bg-indigo-500', text: 'text-indigo-400' },
  Utilities: { stroke: '#f59e0b', dot: 'bg-amber-500', text: 'text-amber-400' },
  Fitness: { stroke: '#10b981', dot: 'bg-emerald-500', text: 'text-emerald-400' },
  Finance: { stroke: '#14b8a6', dot: 'bg-teal-500', text: 'text-teal-400' },
  Education: { stroke: '#3b82f6', dot: 'bg-blue-500', text: 'text-blue-400' },
  Gaming: { stroke: '#f43f5e', dot: 'bg-rose-500', text: 'text-rose-400' },
  Other: { stroke: '#71717a', dot: 'bg-zinc-500', text: 'text-zinc-400' },
};

export function CategoryBreakdownCard({ subscriptions }: CategoryBreakdownCardProps) {
  const breakdown = calculateCategoryBreakdown(subscriptions);
  const totalMonthlySpend = calculateMonthlySpend(subscriptions);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  // SVG Donut Chart Calculation
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const gapAngle = breakdown.length > 1 ? 2 : 0;
  const totalGap = gapAngle * breakdown.length;
  const availableCircumference = circumference - (totalGap * (circumference / 360));

  let accumulatedPercentage = 0;

  return (
    <div className="glass-panel p-5 sm:p-7 rounded-3xl space-y-6 shadow-xl border border-env-subtle/80 relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shadow-md">
            <PieChart className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-env-heading tracking-tight">Spending by Category</h3>
            <p className="text-xs text-env-muted">Normalized monthly allocation across active plans</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {}}
          className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25 transition-all cursor-pointer"
        >
          View report
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {breakdown.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-env-badge/50 border border-env-main space-y-2">
          <Tag className="w-8 h-8 text-env-muted mx-auto" />
          <p className="text-xs font-bold text-env-heading">No active category spending</p>
          <p className="text-[11px] text-env-muted">Add active subscriptions to view category distribution.</p>
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
                  stroke="currentColor"
                  strokeWidth="18"
                  fill="none"
                  className="text-env-badge/60"
                />

                {/* Donut Arcs */}
                {breakdown.map((item) => {
                  const categoryStyle = categoryColors[item.category] || categoryColors.Other;
                  const itemFraction = item.percentage / 100;
                  const strokeDash = itemFraction * availableCircumference;
                  const strokeOffset = -(accumulatedPercentage / 100) * availableCircumference - (accumulatedPercentage > 0 ? (gapAngle * accumulatedPercentage) : 0);
                  
                  accumulatedPercentage += item.percentage;

                  const isHovered = hoveredCategory === item.category;

                  return (
                    <circle
                      key={item.category}
                      cx="90"
                      cy="90"
                      r={radius}
                      stroke={categoryStyle.stroke}
                      strokeWidth={isHovered ? 22 : 18}
                      strokeDasharray={`${strokeDash} ${circumference}`}
                      strokeDashoffset={strokeOffset}
                      strokeLinecap="round"
                      fill="none"
                      className="transition-all duration-300 cursor-pointer"
                      onMouseEnter={() => setHoveredCategory(item.category)}
                      onMouseLeave={() => setHoveredCategory(null)}
                    >
                      <title>{`${item.category}: ${formatCurrency(item.monthlySpend)} (${item.percentage.toFixed(1)}%)`}</title>
                    </circle>
                  );
                })}
              </svg>

              {/* Center Content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none p-2">
                <span className="text-[11px] font-bold text-env-muted tracking-wider uppercase block">
                  Total Monthly
                </span>
                <span className="text-xl sm:text-2xl font-black text-env-heading tracking-tight block">
                  {formatCurrency(totalMonthlySpend)}
                </span>
                <span className="text-[10px] text-env-muted block font-medium">
                  {breakdown.length} {breakdown.length === 1 ? 'category' : 'categories'}
                </span>
              </div>
            </div>
          </div>

          {/* Breakdown List on Right */}
          <div className="md:col-span-7 space-y-2.5">
            {breakdown.map((item) => {
              const categoryStyle = categoryColors[item.category] || categoryColors.Other;
              const isHovered = hoveredCategory === item.category;

              return (
                <div
                  key={item.category}
                  onMouseEnter={() => setHoveredCategory(item.category)}
                  onMouseLeave={() => setHoveredCategory(null)}
                  className={`p-3.5 rounded-2xl border flex items-center justify-between gap-4 transition-all duration-200 ${
                    isHovered
                      ? 'bg-env-button-sec border-env-border-hover shadow-md scale-[1.01]'
                      : 'bg-env-button-sec/60 hover:bg-env-button-sec border-env-subtle'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-3 h-3 rounded-full ${categoryStyle.dot} shrink-0 shadow-sm`}
                    />
                    <div className="min-w-0 truncate">
                      <span className="text-xs font-bold text-env-heading block truncate">{item.category}</span>
                      <span className="text-[11px] text-env-muted block truncate">
                        {item.count} {item.count === 1 ? 'plan' : 'plans'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex items-center gap-4">
                    <div>
                      <span className="text-xs font-bold text-env-heading block">
                        {formatCurrency(item.monthlySpend)}
                      </span>
                      <span className="text-[10px] text-env-muted block">
                        / mo
                      </span>
                    </div>
                    <span className={`text-xs font-black ${categoryStyle.text} bg-env-badge px-2.5 py-1 rounded-lg border border-env-main min-w-[50px] text-center`}>
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

