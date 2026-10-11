'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { BrandWordmark } from '@/components/ui/brand-logo';

/**
 * Signed-out landing page, served at `/`.
 *
 * Marketing surface, so it deliberately has none of the app chrome: no sidebar,
 * no dock, no AdBanner units. It follows the "Midnight" theme in
 * docs/DESIGN_SYSTEM.md — pure black, teal accent, off-white headings.
 *
 * `/` also renders the dashboard for a signed-in user, so everything here is
 * written to stand alone without depending on surrounding layout.
 */
/**
 * Footer link columns. Every href must work for a signed-out visitor: anything
 * behind auth would bounce a marketing visitor to the login form.
 */
const FOOTER_COLUMNS = [
  {
    heading: 'Account',
    links: [
      { label: 'Sign Up', href: '/signup' },
      { label: 'Sign In', href: '/login' },
    ],
  },
  {
    heading: 'Support',
    links: [{ label: 'Contact', href: 'mailto:support@subhalt.app' }],
  },
];

export function LandingPage() {
  return (
    <div className="relative min-h-[100dvh] bg-[#000000] text-[#F5F7F6] antialiased font-sans overflow-hidden">
      {/* Soft teal backdrop glow, matching the app's ambient treatment. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-40 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(20,184,166,0.16),transparent_70%)]"
      />

      {/*
         Its own spacing scale rather than `--spacing-gutter`: 16px is right for
         dense app screens but reads cramped on a marketing page. Safe-area
         insets win wherever they are larger, so a notched phone or a landscape
         cutout still clears the OS chrome.
       */}
      <div
        className="relative mx-auto flex min-h-[100dvh] max-w-5xl flex-col
          pl-[max(1.25rem,var(--spacing-safe-l))]
          pr-[max(1.25rem,var(--spacing-safe-r))]
          pt-[max(3rem,var(--spacing-safe-t))]
          pb-[max(2rem,var(--spacing-safe-b))]
          sm:pl-[max(2rem,var(--spacing-safe-l))]
          sm:pr-[max(2rem,var(--spacing-safe-r))]
          sm:pt-[max(3.5rem,var(--spacing-safe-t))]"
      >
        {/* Sign-in and sign-up both live top right: the hero's call to action is
            Contact Us, so the account entry points cannot depend on it. */}
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/"
            aria-label="SubHalt home"
            className="shrink-0 rounded-lg opacity-90 transition-opacity hover:opacity-100"
          >
            <BrandWordmark height={26} priority />
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="inline-flex h-10 items-center rounded-xl px-3 text-sm font-semibold text-[#94A3B8] transition-colors hover:text-[#F5F7F6] sm:px-4"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-10 items-center rounded-xl bg-[#F5F7F6] px-4 text-sm font-bold text-[#091512] transition-colors hover:bg-white sm:px-5"
            >
              Sign Up
            </Link>
          </div>
        </header>

        {/*
           Not vertically centred on mobile. The hero is short and a phone is
           tall, so `justify-center` had roughly 440px of slack to distribute
           and pushed the headline halfway down the screen — no padding value
           could undo that. Top-aligned with a fixed gap reads as intentional
           at any height, and the spare room collects below the button.

           From `sm` up there is enough room for centring to look deliberate.
         */}
        <main className="flex flex-1 flex-col pt-24 sm:justify-center sm:pt-24 sm:pb-12">
          <h1 className="max-w-3xl text-left text-2xl font-bold leading-[1.2] tracking-tight text-balance sm:text-4xl md:text-5xl">
            Track and Manage Every Subscription. Every Renewal. Nothing Missed.
          </h1>

          <p className="mt-6 max-w-xl text-left text-base leading-relaxed text-[#94A3B8] sm:text-lg">
            SubHalt keeps your subscriptions and bills in one place, then tells you what is coming
            next before it charges you.
          </p>

          <div className="mt-9">
            <a
              href="mailto:support@subhalt.app?subject=SubHalt%20enquiry"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#F5F7F6] px-7 text-sm font-bold text-[#091512] transition-colors hover:bg-white"
            >
              Contact Us
              <ArrowRight
                className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </a>
          </div>
        </main>

        {/*
           Standard landing footer: brand block, link columns, legal row.

           `/help` is deliberately absent — it sits behind auth, so linking it
           would drop a marketing visitor onto the login form. Only routes that
           actually work signed out are linked.

           Each link carries its own 44px hit area. The app's touch floor in
           globals.css covers `button` and `[role="button"]` but not `a[href]`,
           so plain footer text would be a ~20px target on a phone. The negative
           margin plus matching padding keeps the label optically aligned with
           the words above it while the box stays full size.
         */}
        <footer className="mt-12 border-t border-[#1A1D1D] pt-10">
          <div className="flex flex-col gap-10 sm:flex-row sm:justify-between sm:gap-12">
            <div className="max-w-xs space-y-3">
              <BrandWordmark height={22} />
              <p className="text-xs leading-relaxed text-[#94A3B8]">
                Every subscription and every renewal, tracked in one place.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8 sm:gap-16">
              {FOOTER_COLUMNS.map((column) => (
                <div key={column.heading}>
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-[#F5F7F6]">
                    {column.heading}
                  </h2>
                  <ul className="mt-3 space-y-1">
                    {column.links.map((link) => (
                      <li key={link.label}>
                        {link.href.startsWith('mailto:') ? (
                          <a
                            href={link.href}
                            className="-ml-3 inline-flex h-11 items-center rounded-lg px-3 text-sm text-[#94A3B8] transition-colors hover:text-[#F5F7F6]"
                          >
                            {link.label}
                          </a>
                        ) : (
                          <Link
                            href={link.href}
                            className="-ml-3 inline-flex h-11 items-center rounded-lg px-3 text-sm text-[#94A3B8] transition-colors hover:text-[#F5F7F6]"
                          >
                            {link.label}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 border-t border-[#1A1D1D]/70 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-[#5A6461]">
              &copy; {new Date().getFullYear()} SubHalt. All rights reserved.
            </p>

            <div className="flex items-center gap-5">
              <Link
                href="/privacy"
                className="text-[11px] text-[#5A6461] transition-colors hover:text-[#94A3B8]"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="text-[11px] text-[#5A6461] transition-colors hover:text-[#94A3B8]"
              >
                Terms of Service
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default LandingPage;