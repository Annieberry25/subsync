'use client';

import Link from 'next/link';
import { Home, ShieldAlert } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6 p-8 rounded-3xl glass-panel shadow-2xl">
        <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mx-auto flex items-center justify-center shadow-lg">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="text-4xl font-black text-env-heading tracking-tight block">404</span>
          <h2 className="text-lg font-bold text-env-heading">Page Not Found</h2>
          <p className="text-xs text-env-body leading-relaxed">
            The page or subscription route you are looking for doesn&apos;t exist or has been moved.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
