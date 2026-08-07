'use client';

import Link from 'next/link';
import { Home, ShieldAlert } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6 p-8 rounded-2xl bg-[#171A21] border border-[#262A33]">
        <div className="w-12 h-12 rounded-xl bg-[#0B0D11] border border-[#262A33] mx-auto flex items-center justify-center">
          <ShieldAlert className="w-6 h-6 text-[#9CA3AF]" />
        </div>

        <div className="space-y-2">
          <span className="text-[40px] font-bold text-white tracking-tight block">404</span>
          <h2 className="text-xl font-bold text-white tracking-tight">Page Not Found</h2>
          <p className="text-[13px] text-[#9CA3AF] leading-relaxed">
            The page or subscription route you are looking for doesn&apos;t exist or has been moved.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer min-h-[44px]"
          >
            <Home className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
