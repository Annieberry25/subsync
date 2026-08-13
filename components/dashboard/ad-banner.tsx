'use client';

import { useState } from 'react';
import { Sparkles, Info, X } from 'lucide-react';

interface AdBannerProps {
  planTier?: 'free' | 'premium' | 'family';
  adUnitId?: string;
  className?: string;
}

export function AdBanner({ planTier = 'free', className = '' }: AdBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  // Paid plans do not show advertisements
  if (planTier !== 'free' || dismissed) {
    return null;
  }

  return (
    <div
      className={`w-full rounded-2xl bg-[#0B0D0D]/80 border border-[#1A1D1D] p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs transition-all ${className}`}
      role="region"
      aria-label="Sponsor advertisement"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#1A1D1D] text-[#94A3B8] tracking-wider uppercase shrink-0 border border-[#1A1D1D]">
          Ad
        </div>
        <div className="min-w-0">
          <span className="text-xs font-semibold text-[#F5F7F6] block truncate">
            Sponsor Spotlight — Optimize your SaaS stack & team productivity
          </span>
          <span className="text-[11px] text-[#94A3B8] block truncate">
            Discover tailored software management tools built for high-growth tech teams.
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end border-t sm:border-t-0 border-[#1A1D1D]/60 pt-2 sm:pt-0">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1 rounded-lg text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] transition-colors cursor-pointer"
          title="Dismiss ad container"
          aria-label="Dismiss ad container"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
