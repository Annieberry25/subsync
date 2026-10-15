import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Bell,
  CircleSlash2,
  Inbox,
  Receipt,
  ScanLine,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { MarketingPage, TYPE } from '@/components/marketing/marketing-page';
import { SUPPORT_ENQUIRY_MAILTO } from '@/lib/constants/contact';

/**
 * Public features page.
 *
 * These cards used to sit on the landing page below the hero. They were the
 * longest thing on it and pushed the page's actual argument — how it works —
 * below the fold, so they moved here.
 *
 * A server component, like the landing page it shares copy with.
 */

export const metadata: Metadata = {
  title: 'Features | SubHalt',
  description:
    'Track every subscription, get alerted before each renewal, and see what cancelling the worst offenders would actually save you.',
  alternates: { canonical: '/features' },
};

/**
 * Plain icons in the secondary tone. They were previously the accent colour inside
 * a bordered chip, which read as six status badges rather than as captions under
 * six headings.
 */
const GROUPS: {
  title: string;
  summary: string;
  items: { icon: LucideIcon; title: string; body: string }[];
}[] = [
  {
    title: 'See everything',
    summary: 'The parts that tell you where your money actually goes.',
    items: [
      {
        icon: Wallet,
        title: 'Everything in one place',
        body: 'Subscriptions, bills, renewal dates and category, on a single board. Add one manually, import a receipt, or let SubHalt find them for you.',
      },
      {
        icon: Receipt,
        title: 'Receipts captured for you',
        body: 'Scan a receipt and SubHalt pulls out the plan, the price and the renewal cycle, so you are not retyping them.',
      },
      {
        icon: ScanLine,
        title: 'Insights, not just totals',
        body: 'Monthly spend, annualised cost and what cancelling the three worst offenders would actually save you.',
      },
    ],
  },
  {
    title: 'Get told in time',
    summary: 'The part that stops a charge you were not expecting.',
    items: [
      {
        icon: Bell,
        title: 'Alerts before every renewal',
        body: 'Choose how far ahead you want to know. Email, push, or both, and set it once per subscription rather than per reminder app.',
      },
      {
        icon: Inbox,
        title: 'One inbox for what needs you',
        body: 'Anything waiting on a decision collects in a single inbox, so the items that need action are never buried in a list.',
      },
    ],
  },
  {
    title: 'Do something about it',
    summary: 'Knowing is only useful if the next step is obvious.',
    items: [
      {
        icon: CircleSlash2,
        title: 'Cancel what is not earning it',
        body: 'See which subscriptions cost the most for the least use, with the cancellation route already worked out for you.',
      },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <MarketingPage
      label="Features"
      title="Everything SubHalt does"
      lead="Grouped by what you are trying to find out: where the money goes, what is about to charge you, and what to do about the rest."
    >
      <div className="mt-14 space-y-14">
        {GROUPS.map((group) => (
          <section key={group.title}>
            <h2 className={TYPE.h2}>{group.title}</h2>
            <p className={`${TYPE.body} mt-2`}>{group.summary}</p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="rounded-xl border border-[#1A1D1D] bg-[#0F1111] p-5"
                  >
                    <Icon className="h-5 w-5 text-[#94A3B8]" aria-hidden="true" />
                    <h3 className={`${TYPE.h3} mt-4`}>{item.title}</h3>
                    <p className={`${TYPE.body} mt-2`}>{item.body}</p>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-16 flex flex-col gap-3 sm:flex-row sm:items-center">
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
