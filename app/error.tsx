'use client';

import { useEffect } from 'react';
import { RefreshCw, AlertOctagon, Home } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('SubSync Application Error:', error);
  }, [error]);

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6 p-8 rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D]">
        <div className="w-12 h-12 rounded-xl bg-[#D9363E]/10 text-[#D9363E] border border-[#D9363E]/20 mx-auto flex items-center justify-center">
          <AlertOctagon className="w-6 h-6 text-[#D9363E]" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-[#F5F7F6] tracking-tight">Something Went Wrong</h2>
          <p className="text-xs text-[#D9363E] font-mono bg-[#000000] p-3 rounded-xl border border-[#1A1D1D] truncate">
            {error.message || 'An unexpected application error occurred.'}
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="px-5 py-2.5 rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer min-h-[44px]"
          >
            <RefreshCw className="w-4 h-4 text-[#091512]" />
            <span>Try Again</span>
          </button>

          <Link
            href="/"
            className="px-4 py-2.5 rounded-xl bg-[#0B0D0D] hover:bg-[#1A1D1D] text-[#F5F7F6] text-xs font-medium transition-colors border border-[#1A1D1D] min-h-[44px] flex items-center gap-2"
          >
            <Home className="w-4 h-4" />
            <span>Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
