import Link from 'next/link';
import { BrandWordmark } from '@/components/ui/brand-logo';
import { HOME_H1, HOME_SUBLINE } from '@/lib/seo/home-copy';

/**
 * The minimal public homepage served at `/` to signed-out visitors.
 *
 * A server component on purpose: the H1 and subline are the copy Google
 * indexes, so they have to be in the HTML the server sends rather than injected
 * by client JS afterwards. There is no interactivity here beyond one link, so
 * there is nothing that needs to be a client component.
 *
 * Deliberately chrome-free: no sidebar, no dock, no dashboard shell. This is a
 * placeholder for the finished landing page parked on `landing-wip`; when that
 * ships it should read the same strings from lib/seo/home-copy so the <title>,
 * description and H1 keep identical wording and the index entry survives.
 */
export function MinimalHome() {
  return (
    <div className="min-h-[100dvh] bg-[#000000] text-white antialiased font-sans">
      <div
        className="mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col items-center justify-center gap-6 text-center
          pl-[max(1.25rem,var(--spacing-safe-l))]
          pr-[max(1.25rem,var(--spacing-safe-r))]
          pt-[max(2rem,var(--spacing-safe-t))]
          pb-[max(2rem,var(--spacing-safe-b))]"
      >
        <BrandWordmark height={30} priority />

        <h1 className="max-w-2xl text-3xl font-bold leading-[1.15] tracking-tight text-balance text-[#F5F7F6] sm:text-5xl">
          {HOME_H1}
        </h1>

        <p className="max-w-xl text-base leading-relaxed text-pretty text-[#94A3B8] sm:text-lg">
          {HOME_SUBLINE}
        </p>

        <Link
          href="/signup"
          className="mt-2 inline-flex h-12 items-center justify-center rounded-full bg-[#14B8A6] px-8 text-sm font-semibold text-[#091512] transition-colors hover:bg-[#0D9488]"
        >
          Get started
        </Link>
      </div>
    </div>
  );
}

export default MinimalHome;
