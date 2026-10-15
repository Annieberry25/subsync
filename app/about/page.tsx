import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingPage, TYPE } from '@/components/marketing/marketing-page';
import { SUPPORT_ENQUIRY_MAILTO } from '@/lib/constants/contact';

/**
 * Public about page.
 *
 * The landing page's About link pointed at its own footer, which is where this
 * copy lived before it earned a page. A server component like the landing page:
 * there is nothing interactive here.
 */

export const metadata: Metadata = {
  title: 'About | SubHalt',
  description:
    'SubHalt exists so the subscriptions you forgot about stop charging you. Here is what we built and why.',
  alternates: { canonical: '/about' },
};

const PARAGRAPHS = [
  'Most subscription trackers do one thing well: add up what you spend. That total is useful for about ten seconds, and then it sits there while the charge you actually forgot about goes through anyway.',
  'SubHalt is built around the part after the total. It holds your subscriptions and bills in one place, tells you before each renewal rather than after, collects anything waiting on a decision into a single inbox, and works out the cancellation route for the ones that are not earning their keep.',
  'The free plan is the product, not a trial. It covers a handful of subscriptions with no card and no time limit. Plus lifts the caps and turns on automatic discovery from your inbox.',
  'If something here is not working for you, the fastest route to a human is an email. It reaches the person who built it.',
];

export default function AboutPage() {
  return (
    <MarketingPage
      label="About"
      title="Built so the quiet charges stop"
      lead="SubHalt tracks what you pay for, tells you before it renews, and helps you cancel what you stopped using."
    >
      <div className={`mt-10 max-w-[68ch] space-y-5 ${TYPE.body}`}>
        {PARAGRAPHS.map((paragraph) => (
          <p key={paragraph.slice(0, 24)}>{paragraph}</p>
        ))}
      </div>

      <div className={`mt-12 flex flex-col gap-3 sm:flex-row sm:items-center`}>
        <Link
          href="/signup"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-[#F5F7F6] px-5 text-sm font-semibold text-[#091512] transition-colors hover:bg-white"
        >
          Start tracking free
        </Link>
        {/* A mailto, so a plain <a>: the client router would no-op on it. */}
        <a
          href={SUPPORT_ENQUIRY_MAILTO}
          className="inline-flex h-10 items-center justify-center rounded-lg px-3 text-sm text-[#94A3B8] transition-colors hover:text-[#F5F7F6]"
        >
          Contact Us
        </a>
      </div>
    </MarketingPage>
  );
}
