'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { goBack } from '@/lib/back-nav';

/**
 * Back control for the public legal pages.
 *
 * Legal pages can be opened from the landing footer, the auth screens, Settings,
 * or a Google verification link, so the destination is not fixed. `goBack` uses
 * history when there is any, returns to Settings when the URL says the page was
 * opened from there, and falls back to the homepage on a cold visit.
 */
export function BackButton({ label = 'Back' }: { label?: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => goBack(router)}
      className="-ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-[13px] text-[#94A3B8] transition-colors hover:text-[#F5F7F6]"
    >
      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}
