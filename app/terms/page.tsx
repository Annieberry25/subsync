'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { LegalDocumentBody } from '@/components/legal/document-body';

/**
 * Public Terms of Service. See app/privacy/page.tsx for why this is reachable
 * without a session; both share the copy in components/legal/document-body.
 */
export default function TermsPage() {
  return (
    <div className="min-h-[100dvh] bg-[#000000] text-[#F5F7F6] antialiased font-sans">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-40 h-[420px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(20,184,166,0.14),transparent_70%)]"
      />

      <div
        className="relative mx-auto max-w-3xl px-[max(1.25rem,var(--spacing-safe-l))]
          pr-[max(1.25rem,var(--spacing-safe-r))]
          pt-[max(2.5rem,var(--spacing-safe-t))]
          pb-[max(2rem,var(--spacing-safe-b))]"
      >
        <Link
          href="/"
          aria-label="Back to SubHalt"
          data-touch="compact"
          className="-ml-2 inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#94A3B8] transition-colors hover:text-[#F5F7F6]"
        >
          <ChevronLeft className="w-6 h-6" />
        </Link>

        <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Terms of Service</h1>

        <div className="mt-8">
          <LegalDocumentBody type="terms" />
        </div>
      </div>
    </div>
  );
}