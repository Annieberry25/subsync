'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { BrandWordmark } from '@/components/ui/brand-logo';

/**
 * Header shared by every public marketing page.
 *
 * These pages each carried their own copy of this bar, which is how `/features`
 * ended up offering only Home and Sign Up while the landing page offered four
 * links: duplicated markup drifts. There is one header now.
 *
 * Below `md` the section links collapse behind a disclosure. The wordmark and the
 * sign-up button never collapse — those two are what a visitor who has read
 * nothing else still needs, and putting the primary action behind a menu is how
 * a landing page loses sign-ups. Sign In moves into the panel for the same
 * reason: it is a return visit, not a first one.
 *
 * A client component because the disclosure needs state. That does not make the
 * pages client components: they render this from the server and ship their own
 * markup, which matters because the landing page's headline and subline are the
 * copy Google indexes.
 */

export const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/features', label: 'Features' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/about', label: 'About' },
] as const;

export function SiteHeader({ shell = '' }: { shell?: string }) {
  const [open, setOpen] = useState(false);

  /* Escape closes it, matching every other overlay in the app. */
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const linkClass =
    'block rounded-lg px-3 py-2.5 text-[15px] text-[#94A3B8] transition-colors hover:bg-white/5 hover:text-[#F5F7F6]';

  return (
    /*
     * The top padding is the safe-area inset, and it is what makes this bar usable
     * once the site is added to a home screen.
     *
     * `viewportFit: "cover"` is set in app/layout.tsx, which is what lets
     * `env(safe-area-inset-*)` resolve to a real number — and it also means the page
     * extends up behind the status bar and the notch. Added to the Home Screen,
     * that inset goes from zero to roughly 44px, and a bar with no room for it put
     * the wordmark and the menu button underneath the status bar with no way to
     * reach them.
     *
     * The height is left at a plain 4rem so the bar is 64px tall plus the inset,
     * rather than a total that grows and shrinks with the device.
     */
    <header className="sticky top-0 z-30 border-b border-[#1A1D1D] bg-[#0B0D0D]/95 backdrop-blur-md pt-[var(--spacing-safe-t)]">
      <div
        className={`${shell} mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-[max(1.25rem,var(--spacing-safe-l))] sm:px-8`}
      >
        <Link
          href="/"
          aria-label="SubHalt home"
          className="-ml-1 shrink-0 rounded-lg px-1 py-1 opacity-90 transition-opacity hover:opacity-100"
        >
          <BrandWordmark height={24} priority />
        </Link>

        <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Link
            href="/login"
            className="hidden rounded-lg px-3 py-2 text-sm text-[#94A3B8] transition-colors hover:bg-white/5 hover:text-[#F5F7F6] sm:block"
          >
            Sign In
          </Link>
          {/*
            Smallest tap target in the header, and it only grows from `sm`. The bar
            is 64px tall and already carries the wordmark, Sign In and the menu
            button; at the full button size the primary action was the widest thing
            on a 360px screen and squeezed the rest of the bar into their minimums.
          */}
          <Link
            href="/signup"
            className="inline-flex h-9 shrink-0 items-center rounded-lg bg-[#F5F7F6] px-3 text-[13px] font-semibold text-[#091512] transition-colors hover:bg-white sm:h-10 sm:px-4 sm:text-sm"
          >
            Sign Up
          </Link>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="marketing-menu"
            className="-mr-2 grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[#94A3B8] transition-colors hover:bg-white/5 hover:text-[#F5F7F6] md:hidden"
          >
            {open ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/*
        In normal flow rather than floating: on a phone the bar is full-width, so
        nothing overlaps it and no backdrop is needed. Selecting a link closes the
        panel, because leaving it open over the page it just scrolled to is the
        usual failure here.
      */}
      <div id="marketing-menu" hidden={!open} className="border-t border-[#1A1D1D] md:hidden">
        <nav aria-label="Menu" className="mx-auto w-full max-w-5xl px-[max(1.25rem,var(--spacing-safe-l))] py-3 sm:px-8">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={linkClass}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className={`${linkClass} border-t border-[#1A1D1D] sm:hidden`}
          >
            Sign In
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default SiteHeader;
