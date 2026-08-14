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
      className={`w-full py-2 px-1 border-b border-[#1A1D1D]/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-[#94A3B8] bg-transparent ${className}`}
      role="region"
      aria-label="Sponsor advertisement"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-[11px] font-semibold text-[#94A3B8] shrink-0">
          Ads.
        </span>
        <span className="text-xs text-[#94A3B8] truncate">
          <strong className="font-semibold text-[#F5F7F6]">Sponsor Spotlight:</strong> Optimize your SaaS stack & team productivity tools.
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1 rounded text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer"
          title="Dismiss ad"
          aria-label="Dismiss ad"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
