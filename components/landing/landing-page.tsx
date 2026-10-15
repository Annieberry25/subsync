import Link from 'next/link';
import { MarketingPage, TYPE } from '@/components/marketing/marketing-page';
import { HOME_H1, HOME_SUBLINE, HOME_CTA_HREF, HOME_CTA_LABEL } from '@/lib/seo/home-copy';

/**
 * Signed-out landing page, served at `/`.
 *
 * Marketing surface, so it deliberately has none of the app chrome: no sidebar,
 * no dock, no AdBanner units. `/` also renders the dashboard for a signed-in
 * user, so everything here is written to stand alone without depending on
 * surrounding layout.
 *
 * A server component on purpose. The H1 and subline are the copy Google indexes,
 * so they have to be in the HTML the server sends; they are read from
 * lib/seo/home-copy rather than retyped here, and must not be reworded without
 * expecting a re-index.
 *
 * The chrome, the footer and the type scale come from components/marketing, which
 * is shared with /features, /how-it-works and /about. Earlier revisions each
 * carried their own copy of that bar and drifted; see MarketingPage for the
 * design rules it enforces.
 *
 * An earlier revision also put a radial teal glow and a masked grid behind the
 * hero. Both are gone: that pairing is the signature of a generated landing page
 * and it carried no information.
 */

const STEPS = [
  {
    title: 'Add what you pay for',
    body: 'Type it in, forward a receipt, or connect the inbox you already get receipts in. Most people are done in a couple of minutes.',
  },
  {
    title: 'Get told before it renews',
    body: 'SubHalt watches every renewal date and tells you in advance, on the channel you asked for.',
  },
  {
    title: 'Cancel what you stopped using',
    body: 'Open the item, follow the cancellation route, and watch it move to your history instead of your bill.',
  },
];

/** The closing call to action. Separate from the hero so the page has an end. */
function ClosingCta() {
  return (
    <section className="mt-16 sm:mt-20">
      <h2 className={`${TYPE.h2} max-w-[46ch]`}>Find out what renews next month</h2>
      <p className={`${TYPE.body} mt-3 max-w-[56ch]`}>
        It takes a couple of minutes to set up, and it works out what you are already
        paying for.
      </p>
      <div className="mt-8">
        {/* One action. The contact address already leads the page, and repeating
            it here gave the same destination two competing buttons. */}
        <Link
          href="/signup"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-[#F5F7F6] px-5 text-sm font-semibold text-[#091512] transition-colors hover:bg-white"
        >
          Start tracking free
        </Link>
      </div>
    </section>
  );
}

export function LandingPage() {
  return (
    // No page label here. The H1 is already the page's own headline, and putting a
    // category above it made the hero read as a document heading rather than as an
    // opening line. The other pages keep theirs.
    <MarketingPage title={HOME_H1} lead={HOME_SUBLINE}>
      {/*
        The hero's one call to action is the contact address. A plain <a>: the
        target is a mailto, and routing it through the client router would either
        no-op or try to resolve it as an app route. Sign-up stays reachable in the
        header and again in the closing call to action.
      */}
      {/* Compact and left-aligned at every width. Stretching it to the full column
          on a phone turned a two-word label into a wide bar that read as a banner
          rather than a button. */}
      <div className="mt-8 sm:mt-9">
        <a
          href={HOME_CTA_HREF}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-[#14B8A6] px-5 text-sm font-semibold text-[#04120F] transition-colors hover:bg-[#2DD4BF]"
        >
          {HOME_CTA_LABEL}
        </a>
      </div>

      {/*
        No rule above this block. The hairlines that separated the sections turned
        the page into a stack of disconnected panels and did nothing for the
        hierarchy, which the type scale already carries. Spacing is the separator.
      */}
      <section className="mt-16 sm:mt-24">
        <h2 className={`${TYPE.h2} max-w-[46ch]`}>Three steps, then it looks after itself</h2>
        <p className={`${TYPE.body} mt-3 max-w-[56ch]`}>
          The first setup is short. Everything after that is SubHalt noticing a
          renewal before you do.
        </p>

        {/*
          Three columns only from `lg`, not `sm`. At `sm` and `md` each column is
          under 250px on a tablet in portrait, which wraps every sentence into a
          narrow ribbon and reads as broken rather than as a layout. One column
          below desktop and three above is the only width where all three fit their
          own text.
        */}
        <div className="mt-8 grid gap-8 sm:mt-10 lg:grid-cols-3 lg:gap-8">
          {STEPS.map((step) => (
            <div key={step.title}>
              <h3 className={TYPE.h3}>{step.title}</h3>
              <p className={`${TYPE.body} mt-2`}>{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <ClosingCta />
    </MarketingPage>
  );
}

export default LandingPage;
