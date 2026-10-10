'use client';

import React, { useState, useEffect, useRef, memo } from 'react';
import {
  ChevronDown,
  Lightbulb,
} from 'lucide-react';
import type { SubscriptionRow } from '@/lib/services/subscription-service';
import { getTopInsight } from '@/lib/insights/generate-insights';

/**
 * SMART INSIGHT ENGINE & ACCORDION PRESENTATION DIRECTIVE:
 * 1. Fixed Card Title: Always 💡 "Smart Insight"
 * 2. Collapsed State: Displays short 1-line preview sentence without category name.
 * 3. Expanded State: Reveals 💡 "Smart Insight", clean category heading (e.g. Spending Trend), and friendly 3-part advice.
 * 4. Clean UI: No duplicate icon inside expanded content, no purple category badge.
 * 5. Conversational Copy: Friendly, natural, supportive tone (no corporate jargon).
 * 6. Vertical Spacing: Clean breathing room between title, heading, and advice text.
 * 7. Accordion Interaction: Smooth 200-300ms inline expansion toggle.
 *
 * The generation rules live in lib/insights/generate-insights.ts, shared with the
 * push notifier so both agree on what counts as a new insight.
 */
export const SmartInsightCard = memo(function SmartInsightCard({ subscriptions }: { subscriptions: SubscriptionRow[] }) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedInsight = getTopInsight(subscriptions);

  // Announced so the insight notifier can tell a *new* insight from the same one
  // still showing. Without this the notification would repeat every time the
  // dashboard re-rendered with an unchanged subscription list.
  const insightIdRef = useRef<string | null>(null);

  useEffect(() => {
    const id = selectedInsight?.id ?? null;
    if (id === insightIdRef.current) return;
    insightIdRef.current = id;
    if (!id) return;

    void fetch('/api/push/insight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ insightId: id }),
    }).catch(() => {
      // Fire-and-forget: the card must render whether or not the notifier
      // responds, and a failed announcement is not worth surfacing.
    });
  }, [selectedInsight?.id]);

  if (!selectedInsight) return null;

  return (
    <div
      onClick={() => setIsOpen((prev) => !prev)}
      className="py-3 px-1 border-t-0 sm:border-t border-[#1A1D1D]/50 cursor-pointer select-none group"
    >
      {/* Header Row: Displays "Smart Insight" Label + Insight Preview + Chevron */}
      <div className="flex items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
          <Lightbulb className="w-4 h-4 text-[#14B8A6] shrink-0" />

          <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-3 overflow-hidden">
            <span className="text-xs sm:text-sm font-semibold text-[#F5F7F6] shrink-0">
              Smart Insight:
            </span>

            {/* Collapsed Preview */}
            {!isOpen && (
              <span className="text-xs text-[#94A3B8] min-w-0 flex-1 block leading-tight truncate">
                {selectedInsight.preview}
              </span>
            )}
          </div>
        </div>

        {/* Chevron Indicator */}
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#F5F7F6] transition-transform duration-200 shrink-0 ml-auto ${
            isOpen ? 'rotate-180 text-[#14B8A6]' : ''
          }`}
        />
      </div>

      {/* Expanded Accordion Body */}
      <div
        className={`grid transition-all duration-200 ease-in-out ${
          isOpen
            ? 'grid-rows-[1fr] opacity-100 mt-2.5 pt-2.5 border-t border-[#1A1D1D]/40'
            : 'grid-rows-[0fr] opacity-0 mt-0 pt-0 border-t-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="space-y-1.5 pt-0.5">
            <h4 className="text-xs font-semibold text-[#F5F7F6]">
              {selectedInsight.title}
            </h4>

            <p className="text-xs text-[#94A3B8] leading-relaxed max-w-3xl font-normal">
              <span className="text-[#F5F7F6] font-medium">
                {selectedInsight.observation}{' '}
              </span>
              <span>{selectedInsight.meaning} </span>
              <span className="text-[#94A3B8]">
                {selectedInsight.recommendation}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});