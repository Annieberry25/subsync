import Link from 'next/link';
import { SiteHeader } from '@/components/marketing/site-header';

/**
 * Shared shell for the public marketing pages.
 *
 * Four pages each built their own background, header, footer and spacing, and
 * they drifted: one offered four nav links while the others offered two. Duplicated
 * layout is the cause, so it now lives here once.
 *
 * Design rules this encodes, so they hold without anyone having to remember them:
 *
 *  - **One type scale.** Five steps, used the same way on every page. A page that
 *    needs a sixth size is a page that has grown a component the scale cannot
 *    describe, and that is a content problem, not a styling one.
 *  - **One spacing scale, on 8px.** Section rhythm is `SECTION`, card padding is
 *    `CARD`, and the gap between stacked blocks is a multiple of 8. Nothing is
 *    hand-tuned per page.
 *  - **A reading measure.** Body copy is capped near 68ch. Full-width paragraphs
 *    are the single fastest way to make a page look machine-generated.
 *  - **No decorative background.** An earlier revision carried a radial teal glow
 *    and a masked grid behind the hero. That pairing — colour blob over a fine
 *    grid — is the signature of a generated landing page and it bought nothing
 *    here, so it is gone rather than dialled down.
 *  - **One pill per page, not per section.** Rounded-full everywhere reads as a
 *    template; reserved for the primary call to action it reads as emphasis.
 */

export const PAGE_SHELL = 'mx-auto w-full max-w-5xl px-[max(1.25rem,var(--spacing-safe-l))] sm:px-8';

export const TYPE = {
  /** Page name, above the H1. The one place uppercase is used. */
  label: 'text-sm font-semibold uppercase tracking-[0.1em] text-[#14B8A6]',
  /**
   * Exactly one per page. The floor is set by a phone rather than a desktop: at
   * `text-4xl` from `sm` up, the base size has to stay large enough to be a real
   * heading on a 360px screen, which is what stops the middle of the range from
   * being an arbitrary number.
   */
  h1: 'text-[1.75rem] sm:text-4xl font-bold leading-[1.15] tracking-[-0.02em] text-balance',
  /** Section headings under the H1. */
  h2: 'text-lg sm:text-2xl font-semibold leading-snug tracking-[-0.01em]',
  /** Card and step titles. */
  h3: 'text-[15px] sm:text-base font-semibold leading-snug',
  /** The sentence under the H1. */
  lead: 'text-base sm:text-lg leading-relaxed text-[#94A3B8] max-w-[60ch]',
  /** Running copy. */
  body: 'text-[15px] leading-relaxed text-[#94A3B8]',
  /** Quiet supporting copy. */
  meta: 'text-[13px] leading-relaxed text-[#6E7A76]',
} as const;

/**
 * Vertical rhythm on 8px. The mobile value is the one that matters: a phone has
 * roughly a third of the height of a laptop, so a section gap tuned on a desktop
 * reads as two unrelated screens on a phone.
 */
export const SPACE = {
  /** Above and below a full section. */
  section: 'py-16 sm:py-24',
  /** Inside a card. */
  card: 'p-5 sm:p-6',
  /** Between the H1 and its lead. */
  afterH1: 'mt-4 sm:mt-5',
  /** Between a heading and the block it introduces. */
  afterHeading: 'mt-3 sm:mt-4',
  /** Before a group of cards. */
  beforeCards: 'mt-8 sm:mt-10',
  /** Between stacked cards. */
  stack: 'space-y-12 sm:space-y-16',
} as const;

/**
 * Footer, shared by every marketing page.
 *
 * Deliberately two items: the company name and Help. The tagline, the Sign In
 * link and the contact address were all here and all duplicated something the
 * page already offers above it — the sign-in entry point is in the header on
 * every page, and the contact address is the hero's call to action on the landing
 * page and the closing call to action on the others.
 */
function SiteFooter() {
  return (
    <footer className="border-t border-[#1A1D1D]">
      <div
        className={`${PAGE_SHELL} flex flex-col gap-3 py-8 text-[13px] text-[#6E7A76] sm:flex-row sm:items-center sm:justify-between`}
      >
        <p>© SUBHALT LTD</p>
        <nav aria-label="Footer">
          <Link href="/help" className="transition-colors hover:text-[#94A3B8]">
            Help
          </Link>
        </nav>
      </div>
    </footer>
  );
}

/**
 * Page wrapper. `title` is the page's own name, rendered above the H1 as a real
 * heading so it reaches a screen reader and anything enumerating headings.
 */
export function MarketingPage({
  label,
  title,
  lead,
  children,
}: {
  /** Optional. The landing page omits it: its H1 is already the page headline. */
  label?: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#0B0D0D] text-[#F5F7F6] antialiased font-sans">
      <SiteHeader />

      <main className={`${PAGE_SHELL} flex-1 pb-16 pt-10 sm:pb-24 sm:pt-16`}>
        {label && <h2 className={TYPE.label}>{label}</h2>}
        <h1 className={`${TYPE.h1} mt-3`}>{title}</h1>
        {lead && <p className={`${TYPE.lead} mt-4 sm:mt-5`}>{lead}</p>}
        {children}
      </main>

      <SiteFooter />
    </div>
  );
}

export { SiteHeader, SiteFooter };
