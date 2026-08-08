'use client';

import React, { useState } from 'react';
import {
  ChevronDown,
  Lightbulb,
} from 'lucide-react';
import { calculateCategoryBreakdown } from '@/lib/utils/analytics-utils';
import {
  calculateAnnualSpend,
  getNormalizedMonthlyPrice,
  formatCurrency,
} from '@/lib/utils/metrics-utils';
import type { SubscriptionRow } from '@/lib/services/subscription-service';

interface SmartInsightCardProps {
  subscriptions: SubscriptionRow[];
}

interface SmartInsightCandidate {
  id: string;
  title: string;
  category: 'actionable' | 'informational' | 'neutral';
  priority: number;
  preview: string;
  observation: string;
  meaning: string;
  recommendation: string;
}

/**
 * SMART INSIGHT ENGINE & ACCORDION PRESENTATION DIRECTIVE:
 * 1. Fixed Card Title: Always 💡 "Smart Insight"
 * 2. Collapsed State: Displays short 1-line preview sentence without category name.
 * 3. Expanded State: Reveals 💡 "Smart Insight", clean category heading (e.g. Spending Trend), and friendly 3-part advice.
 * 4. Clean UI: No duplicate icon inside expanded content, no purple category badge.
 * 5. Conversational Copy: Friendly, natural, supportive tone (no corporate jargon).
 * 6. Vertical Spacing: Clean breathing room between title, heading, and advice text.
 * 7. Accordion Interaction: Smooth 200-300ms inline expansion toggle.
 */
export function SmartInsightCard({ subscriptions }: SmartInsightCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeSubs = subscriptions.filter(
    (sub) => sub.status === 'active' || sub.status === 'trial'
  );
  const pausedSubs = subscriptions.filter((sub) => sub.status === 'paused');
  const canceledSubs = subscriptions.filter((sub) => sub.status === 'canceled');
  const categoryBreakdown = calculateCategoryBreakdown(subscriptions);
  const totalAnnualSpend = calculateAnnualSpend(subscriptions);

  const candidates: SmartInsightCandidate[] = [];

  // 1. Genuine Duplicate Subscriptions (Strictly verified - NEVER guess!)
  const nameCounts: Record<string, number> = {};
  activeSubs.forEach((sub) => {
    const normalized = sub.name.trim().toLowerCase();
    nameCounts[normalized] = (nameCounts[normalized] || 0) + 1;
  });
  const exactDuplicateName = Object.keys(nameCounts).find(
    (name) => nameCounts[name] > 1
  );

  const knownVideoStreaming = [
    'netflix',
    'disney+',
    'hulu',
    'hbo max',
    'max',
    'amazon prime video',
    'apple tv+',
  ];
  const activeVideoSubs = activeSubs.filter(
    (sub) =>
      sub.category === 'Streaming' &&
      knownVideoStreaming.some((k) => sub.name.toLowerCase().includes(k))
  );

  if (exactDuplicateName) {
    const dupName =
      activeSubs.find(
        (s) => s.name.trim().toLowerCase() === exactDuplicateName
      )?.name || exactDuplicateName;
    candidates.push({
      id: 'duplicate-services-exact',
      title: 'Duplicate Services',
      category: 'actionable',
      priority: 95,
      preview: 'Potential duplicate subscription detected.',
      observation: `You have more than one active subscription for ${dupName}.`,
      meaning: `Having duplicate accounts often means you're accidentally being billed twice.`,
      recommendation: `Check your account settings to see if you can merge or cancel one of them.`,
    });
  } else if (activeVideoSubs.length >= 3) {
    candidates.push({
      id: 'duplicate-services-streaming',
      title: 'Potential Savings',
      category: 'actionable',
      priority: 95,
      preview: 'Multiple video streaming subscriptions active.',
      observation: `You're currently subscribed to ${activeVideoSubs.length} video streaming services (${activeVideoSubs
        .slice(0, 3)
        .map((s) => s.name)
        .join(', ')}).`,
      meaning: `It's easy to pay for several streaming apps at once without watching all of them.`,
      recommendation: `Pausing or rotating services you aren't using right now is a simple way to save each month.`,
    });
  }

  // 2. Spending Trend & Addition Velocity
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const recentSubs = activeSubs.filter((sub) => {
    const dateStr = sub.created_at || sub.start_date;
    if (!dateStr) return false;
    const subDate = new Date(dateStr);
    return subDate >= thirtyDaysAgo && subDate <= now;
  });

  if (recentSubs.length >= 2) {
    const recentIncrease = recentSubs.reduce(
      (acc, s) => acc + getNormalizedMonthlyPrice(s),
      0
    );
    candidates.push({
      id: 'spending-trend-velocity',
      title: 'Spending Trend',
      category: 'actionable',
      priority: 90,
      preview: 'Monthly subscription spending increased this month.',
      observation: `Your monthly spending went up by ${formatCurrency(
        recentIncrease
      )} after adding ${recentSubs.length} new services this month.`,
      meaning: `Adding multiple services quickly can cause your monthly total to jump.`,
      recommendation: `Take a quick moment to review these new additions and make sure they're all still worth keeping.`,
    });
  } else if (recentSubs.length === 1) {
    const recentSub = recentSubs[0];
    const monthlyIncrease = getNormalizedMonthlyPrice(recentSub);
    candidates.push({
      id: 'spending-trend-single',
      title: 'Spending Trend',
      category: 'actionable',
      priority: 88,
      preview: 'Monthly subscription spending increased recently.',
      observation: `Your monthly spending went up by ${formatCurrency(
        monthlyIncrease
      )} after adding ${recentSub.name}.`,
      meaning: `Even single new subscriptions naturally increase your regular monthly total over time.`,
      recommendation: `It's worth checking if this new service replaces an older plan you no longer need.`,
    });
  }

  // 3. Spending Habits: Billing Frequency Distribution
  if (activeSubs.length >= 3) {
    const monthlyCount = activeSubs.filter(
      (s) => s.billing_cycle === 'monthly'
    ).length;
    const yearlyCount = activeSubs.filter(
      (s) => s.billing_cycle === 'yearly'
    ).length;

    const monthlyPct = (monthlyCount / activeSubs.length) * 100;
    const yearlyPct = (yearlyCount / activeSubs.length) * 100;

    if (monthlyPct >= 75) {
      candidates.push({
        id: 'spending-habit-monthly',
        title: 'Billing Flexibility',
        category: 'informational',
        priority: 85,
        preview: 'Most of your subscriptions use monthly billing.',
        observation: `${monthlyPct.toFixed(
          0
        )}% of your active subscriptions are billed on a monthly basis.`,
        meaning: `Monthly billing gives you great flexibility, but annual plans often come with a nice discount.`,
        recommendation: `If there are services you plan to keep long-term, switching to annual billing could save you 15–20%.`,
      });
    } else if (yearlyPct >= 60) {
      candidates.push({
        id: 'spending-habit-yearly',
        title: 'Annual Savings',
        category: 'informational',
        priority: 85,
        preview: "You're taking full advantage of annual discounts.",
        observation: `${yearlyPct.toFixed(
          0
        )}% of your active subscriptions are billed annually.`,
        meaning: `This locks in the lowest rates for your favorite services.`,
        recommendation: `Just keep an eye on renewal dates so annual charges don't catch you off guard.`,
      });
    }
  }

  // 4. Annual Run-Rate Projection
  if (totalAnnualSpend > 0) {
    candidates.push({
      id: 'annual-projection',
      title: 'Annual Projection',
      category: 'informational',
      priority: 80,
      preview: 'Here is your projected annual subscription cost.',
      observation: `At your current rate, you'll spend about ${formatCurrency(
        totalAnnualSpend
      )} on subscriptions this year.`,
      meaning: `Small monthly costs can add up to a significant total over twelve months.`,
      recommendation: `Checking in on your plans once or twice a year is a great way to keep your budget on track.`,
    });
  }

  // 5. Category Concentration & Portfolio Balance
  if (categoryBreakdown.length >= 3) {
    const sortedBreakdown = [...categoryBreakdown].sort(
      (a, b) => b.percentage - a.percentage
    );
    const topTwoPct =
      sortedBreakdown[0].percentage + sortedBreakdown[1].percentage;

    if (topTwoPct >= 75) {
      candidates.push({
        id: 'portfolio-balance',
        title: 'Category Concentration',
        category: 'informational',
        priority: 70,
        preview: 'Your spending is concentrated in two main categories.',
        observation: `${topTwoPct.toFixed(0)}% of your subscription budget goes toward ${sortedBreakdown[0].category} and ${sortedBreakdown[1].category}.`,
        meaning: `When most of your budget goes to two areas, smaller subscriptions elsewhere can easily slip by.`,
        recommendation: `A quick look across all categories can help ensure your spending stays balanced.`,
      });
    }
  }

  // 6. Savings Progress
  const totalInactive = pausedSubs.length + canceledSubs.length;
  if (totalInactive >= 2) {
    candidates.push({
      id: 'savings-progress',
      title: 'Savings Progress',
      category: 'informational',
      priority: 65,
      preview: "You're actively keeping subscription costs low.",
      observation: `You currently have ${totalInactive} paused or canceled subscriptions in your account.`,
      meaning: `Pausing services you aren't using right now is a smart way to protect your monthly budget.`,
      recommendation: `Keep them paused until you need them again—we'll keep your account settings ready.`,
    });
  }

  // 7. Neutral Fallback Message
  if (subscriptions.length > 0) {
    candidates.push({
      id: 'everything-looks-good',
      title: 'Subscription Overview',
      category: 'neutral',
      priority: 10,
      preview: 'Your subscriptions look healthy and balanced.',
      observation: 'All of your active subscriptions look steady and well-managed.',
      meaning: "We haven't spotted any unexpected price jumps, recent surges, or duplicate services.",
      recommendation: "Everything is in good shape! We'll keep monitoring your renewals and let you know if anything changes.",
    });
  }

  // 8. Empty State Insight
  if (subscriptions.length === 0) {
    candidates.push({
      id: 'no-subscriptions',
      title: 'Getting Started',
      category: 'neutral',
      priority: 1,
      preview: 'Add subscriptions to get personalized insights.',
      observation: "You haven't added any recurring subscriptions to your dashboard yet.",
      meaning: "Once you add your active plans, we'll start analyzing spending trends and helpful savings tips.",
      recommendation: "Add your first subscription whenever you're ready to get started.",
    });
  }

  // Pick top 1 candidate based on priority
  candidates.sort((a, b) => b.priority - a.priority);
  const selectedInsight = candidates[0];

  return (
    <div
      onClick={() => setIsOpen((prev) => !prev)}
      className="p-4 sm:p-5 md:p-6 rounded-[20px] bg-[#171A21] border border-[#2B313D] cursor-pointer transition-all duration-300 hover:border-[#3B4252] select-none"
    >
      {/* Header Row: Always displays 💡 "Smart Insight" Title + Short 1-Sentence Preview (when Collapsed) + Chevron */}
      <div className="flex items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 flex-1 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-[#1D222B] border border-[#2B313D] flex items-center justify-center shrink-0">
            <Lightbulb className="w-5 h-5 text-[#F59E0B]" />
          </div>

          <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-3 overflow-hidden">
            <h3 className="text-base sm:text-[17px] font-semibold text-white tracking-tight shrink-0">
              Smart Insight
            </h3>

            {/* Collapsed One-Sentence Preview (Without Category Name) */}
            {!isOpen && (
              <span className="text-xs sm:text-[14px] text-[#A1AAB8] min-w-0 flex-1 block leading-tight truncate sm:whitespace-normal">
                {selectedInsight.preview}
              </span>
            )}
          </div>
        </div>

        {/* Animated Chevron ▼ / ▲ */}
        <div className="w-8 h-8 rounded-lg bg-[#1D222B] border border-[#2B313D] flex items-center justify-center shrink-0 ml-auto">
          <ChevronDown
            className={`w-4 h-4 text-[#A1AAB8] transition-transform duration-300 ${
              isOpen ? 'rotate-180 text-white' : ''
            }`}
          />
        </div>
      </div>

      {/* Expanded Accordion Body */}
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          isOpen
            ? 'grid-rows-[1fr] opacity-100 mt-4 sm:mt-5 pt-4 sm:pt-5 border-t border-[#2B313D]/60'
            : 'grid-rows-[0fr] opacity-0 mt-0 pt-0 border-t-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="pl-0 sm:pl-[50px] space-y-3 pt-0.5">
            {/* Clean Heading (e.g. "Spending Trend") without duplicate icon or purple badge */}
            <h4 className="text-sm sm:text-[16px] font-semibold text-white tracking-tight">
              {selectedInsight.title}
            </h4>

            {/* Conversational Friendly Assistant Advice */}
            <p className="text-xs sm:text-[15px] text-[#A1AAB8] leading-relaxed sm:leading-[26px] max-w-3xl font-normal">
              <span className="text-white font-medium">
                {selectedInsight.observation}{' '}
              </span>
              <span>{selectedInsight.meaning} </span>
              <span className="text-[#C1C8D4]">
                {selectedInsight.recommendation}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}








