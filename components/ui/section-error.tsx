'use client';

import { useEffect } from 'react';
import { RefreshCw, AlertOctagon, Home } from 'lucide-react';
import Link from 'next/link';

export default function SectionError({
  error,
  reset,
  label = 'This section',
}: {
  error: Error & { digest?: string };
  reset: () => void;
  label?: string;
}) {
  useEffect(() => {
    console.error(`SubHalt Error (${label}):`, error);
  }, [error, label]);

  return (
    <div className="flex-1 min-w-0 min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6 p-8 rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D]">
        <div className="w-12 h-12 rounded-xl bg-[#D9363E]/10 text-[#D9363E] border border-[#D9363E]/20 mx-auto flex items-center justify-center">
          <AlertOctagon className="w-6 h-6 text-[#D9363E]" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-[#F5F7F6] tracking-tight">Something Went Wrong</h2>
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            {label} failed to load. Please try again.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={reset}
            className="h-11 min-h-[44px] px-5 rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          <Link
            href="/"
            className="h-11 min-h-[44px] px-5 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] text-[#94A3B8] hover:text-[#F5F7F6] text-xs font-semibold flex items-center gap-2 transition-colors border border-[#1A1D1D]"
          >
            <Home className="w-4 h-4" />
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
