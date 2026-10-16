'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  ADSENSE_AD_SLOT,
  ADSENSE_CLIENT,
  ADSENSE_ENABLED,
  ADSENSE_LOADER_SRC,
} from '@/lib/config/adsense';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

interface AdBannerProps {
  planTier?: 'free' | 'plus' | 'premium' | 'family';
  adSlot?: string;
  className?: string;
}

let adsenseScriptLoaded = false;

/**
 * Loads the AdSense library only if it is not already on the page.
 *
 * The root layout now serves the loader from the document head
 * (`strategy="beforeInteractive"`, for AdSense verification), so on every page
 * that script is already present by the time this runs. The module-level flag
 * alone cannot see it — it only tracks injections made through this function — so
 * a second adsbygoogle.js would be appended, and loading the library twice
 * resets AdSense's own state and invalidates it.
 */
function loadAdsenseScript() {
  if (adsenseScriptLoaded || typeof window === 'undefined') return;
  if (document.querySelector(`script[src="${ADSENSE_LOADER_SRC}"]`)) {
    adsenseScriptLoaded = true;
    return;
  }
  adsenseScriptLoaded = true;
  const script = document.createElement('script');
  script.async = true;
  script.src = ADSENSE_LOADER_SRC;
  script.crossOrigin = 'anonymous';
  document.head.appendChild(script);
}

export function AdBanner({
  planTier = 'free',
  adSlot = ADSENSE_AD_SLOT,
  className = '',
}: AdBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  // React's JSX types resolve <ins> to HTMLModElement, which is what it demands
// here even though the element is a plain HTMLElement at runtime.
const insRef = useRef<HTMLModElement>(null);

  const enabled = ADSENSE_ENABLED && adSlot;

  useEffect(() => {
    if (!enabled || dismissed) return;
    loadAdsenseScript();

    // Mark this slot as filled to avoid duplicate pushes (React strict mode / re-renders).
    const ins = insRef.current;
    if (!ins || ins.getAttribute('data-adsbygoogle-status') === 'done') return;

    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch {
      // AdSense may reject the fill (e.g. not fully laid out); ignore silently.
    }
  }, [enabled, dismissed]);

  // Paid plans do not show advertisements; ads never render without real AdSense config.
  if (planTier !== 'free' || dismissed || !enabled) {
    return null;
  }

  return (
    /*
     * Narrow on a phone, and nothing is cropped.
     *
     * The slot was full-width inside a container that runs to ~1280px, with
     * `data-full-width-responsive="true"`, so on a phone AdSense was still being
     * offered its large mobile formats. The old response was to cap the slot at
     * 60px behind `overflow-hidden`, which chopped the creative in half — and
     * AdSense's rules do not permit obscuring ad content, so that was a risk to the
     * whole account rather than a display choice.
     *
     * The width is the lever AdSense actually responds to: give the slot a narrow
     * box on a phone and it selects a format that fits it, so the ad is genuinely
     * small instead of a large one cut to size. The container grows to whatever the
     * chosen creative needs and clips nothing.
     *
     * If this ever comes back unfilled rather than small, the account only has large
     * formats enabled for this slot and the fix is fewer placements, not more
     * cropping.
     */
    <div
      className={`mx-auto w-full max-w-[320px] rounded-2xl border border-[#1A1D1D] bg-[#0B0D0D] sm:max-w-none ${className}`}
      role="region"
      aria-label="Advertisement"
    >
      <div className="flex items-center justify-between gap-2 px-3 pt-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
          Ads by Google
        </span>
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

      {/* Height is a floor, never a ceiling. A ceiling would crop whatever Google
          serves, which is both a layout bug and an AdSense policy problem. */}
      <ins
        ref={insRef}
        className="adsbygoogle block min-h-[50px] sm:min-h-[90px]"
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={adSlot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}