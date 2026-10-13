import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { BrandWordmark } from '@/components/ui/brand-logo';
import {
  HOME_H1,
  HOME_SUBLINE,
  HOME_CTA_HREF,
  HOME_CTA_LABEL,
} from '@/lib/seo/home-copy';

/**
 * Signed-out landing page, served at `/`.
 *
 * Marketing surface, so it deliberately has none of the app chrome: no sidebar,
 * no dock, no AdBanner units. It follows the "Midnight" theme in
 * docs/DESIGN_SYSTEM.md — pure black, teal accent, off-white headings.
 *
 * `/` also renders the dashboard for a signed-in user, so everything here is
 * written to stand alone without depending on surrounding layout.
 *
 * A server component on purpose: the H1 and subline are the copy Google indexes,
 * so they have to be in the HTML the server sends. The headline, subline and
 * call to action are read from lib/seo/home-copy so the <title>, meta
 * description and H1 keep the exact wording the existing index entry was built
 * on.
 *
 * The footer is deliberately absent for now — its contents are still being
 * decided. That leaves /privacy and /terms with no inbound link from the public
 * homepage, so they must be re-added when the footer comes back.
 */

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
            the primary funnel, so the account entry points cannot depend on it. */}
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
            {HOME_H1}
          </h1>

          <p className="mt-6 max-w-xl text-left text-base leading-relaxed text-[#94A3B8] sm:text-lg">
            {HOME_SUBLINE}
          </p>

          <div className="mt-9">
            {/*
               A plain <a>, not next/link: the target is a mailto, and routing
               that through the client router would either no-op or try to
               resolve it as an app route.
             */}
            <a
              href={HOME_CTA_HREF}
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#F5F7F6] px-7 text-sm font-bold text-[#091512] transition-colors hover:bg-white"
            >
              {HOME_CTA_LABEL}
              <ArrowRight
                className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </a>
          </div>

          {/*
             The original tagline. It used to be the hero H1, but the H1 now
             carries the indexed copy from lib/seo/home-copy and rewording that
             risks a re-index — so the line is kept as a muted brand statement
             under the call to action rather than dropped with the footer.
           */}
          <p className="mt-10 max-w-xl text-sm leading-relaxed text-[#5A6461]">
            Track and Manage Every Subscription. Every Renewal. Nothing Missed.
          </p>
        </main>
      </div>
    </div>
  );
}

export default LandingPage;