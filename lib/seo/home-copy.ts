/**
 * The exact homepage copy that carries SEO weight.
 *
 * Kept in one module for a specific reason: the minimal public homepage at `/`
 * is a placeholder for the finished landing page parked on the `landing-wip`
 * branch. When that page is swapped in, it must import these same values rather
 * than re-typing them, so the <title>, meta description and H1 stay
 * byte-identical and the existing Google index entry is not lost.
 *
 * Do not reword these without expecting a re-index. The accents are em dashes
 * (U+2014) in both the title and the description, exactly as specified.
 */
export const HOME_TITLE = 'SubHalt — Track, Manage & Cancel Subscriptions';

export const HOME_DESCRIPTION =
  'SubHalt shows every subscription you pay for in one place and reminds you before they renew. Cancel the ones you forgot about — stop leaking money every month.';

export const HOME_H1 = 'Never get surprise-charged again';

/**
 * The social-preview blurb, shared by `og:description` and
 * `twitter:description`. It is intentionally not HOME_DESCRIPTION: the card
 * leads with the H1 and drops the second sentence, because unfurls truncate
 * hard and the first line is the part that survives.
 */
export const HOME_OG_DESCRIPTION = `${HOME_H1}. SubHalt tracks every subscription you pay for and alerts you before each renewal.`;

export const HOME_SUBLINE =
  'SubHalt tracks every subscription you have and alerts you before each renewal.';

/** Where the single call to action points. */
export const HOME_CTA_HREF = '/signup';

export const HOME_CTA_LABEL = 'Get started';
