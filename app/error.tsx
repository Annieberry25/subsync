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
      <div className="max-w-md w-full text-center space-y-6 p-8 rounded-3xl glass-panel shadow-2xl">
        <div className="w-16 h-16 rounded-3xl bg-rose-500/10 text-rose-400 border border-rose-500/20 mx-auto flex items-center justify-center shadow-lg">
          <AlertOctagon className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-env-heading">Something Went Wrong</h2>
          <p className="text-xs text-rose-300/90 font-mono bg-rose-950/40 p-2.5 rounded-xl border border-rose-500/20 truncate">
            {error.message || 'An unexpected application error occurred.'}
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try Again</span>
          </button>

          <Link
            href="/"
            className="px-4 py-2.5 rounded-2xl bg-env-button-sec hover:bg-env-button-sec-hover text-env-heading text-xs font-semibold transition-all border border-env-main"
          >
            <Home className="w-4 h-4 inline mr-1.5" />
            <span>Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
