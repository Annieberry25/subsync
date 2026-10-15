import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingPage, TYPE } from '@/components/marketing/marketing-page';
import { SUPPORT_ENQUIRY_MAILTO } from '@/lib/constants/contact';

/**
 * Public "how it works" page.
 *
 * The landing page keeps the three-step sequence as a summary, because that is
 * the argument the page exists to make and bouncing a first-time visitor off to
 * another route before they have scrolled is a poor trade. This page is the long
 * form of the same sequence for someone who has already decided to care.
 *
 * No step numbers. They were set as oversized monospace in the accent colour,
 * which read as a numbered list a template generated rather than as an argument.
 * The order is carried by the sequence itself.
 */

export const metadata: Metadata = {
  title: 'How it works | SubHalt',
  description:
    'Add what you pay for, get told before it renews, and cancel what you stopped using.',
  alternates: { canonical: '/how-it-works' },
};

const STEPS = [
  {
    title: 'Add what you pay for',
    summary:
      'Type it in, forward a receipt, or connect the inbox you already get receipts in.',
    detail:
      'The manual route takes a subscription name, a price and a renewal date, which is enough to start being reminded. Most people already have a receipt for anything they care about, so scanning one is usually faster than typing. SubHalt pulls out the plan, the amount and the billing cycle for you. On Plus you can also connect Gmail or forward receipts to a personal address, and SubHalt will find the subscriptions itself.',
  },
  {
    title: 'Get told before it renews',
    summary: 'SubHalt watches every renewal date and tells you in advance.',
    detail:
      'Lead time is yours to set, per subscription, rather than a single global setting: a monthly service you use daily and an annual one you forgot about do not want the same warning. You choose email, push, or both, and anything waiting on a decision collects in your inbox so the items that need you are never buried in a list.',
  },
  {
    title: 'Cancel what you stopped using',
    summary:
      'Open the item, follow the cancellation route, and watch it move to your history.',
    detail:
      'This is the step most trackers skip. SubHalt ranks what you pay for against what you use, and works out the cancellation route for the ones that are not earning their keep. Deleting is a soft delete: the record moves to your history, stays restorable, and only disappears for good when you ask it to.',
  },
];

export default function HowItWorksPage() {
  return (
    <MarketingPage
      label="How it works"
      title="Three steps, then it looks after itself"
      lead="The first setup is short. Everything after that is SubHalt noticing a renewal before you do."
    >
      {/*
        No rules between the steps. They were hairline-separated, which turned a
        continuous argument into a stack of unrelated blocks. The vertical spacing
        carries the grouping instead.
      */}
      <div className="mt-12 max-w-[68ch]">
        {STEPS.map((step) => (
          <section key={step.title} className="py-8 first:pt-0">
            <h2 className={TYPE.h2}>{step.title}</h2>
            <p className={`${TYPE.body} mt-3 text-[#F5F7F6]`}>{step.summary}</p>
            <p className={`${TYPE.body} mt-3`}>{step.detail}</p>
          </section>
        ))}
      </div>

      <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:items-center">
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
