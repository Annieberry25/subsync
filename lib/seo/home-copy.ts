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
 *
 * HOME_H1 is the one deliberate exception: it was reworded from
 * "Never get surprise-charged again" to drop the hyphen while the landing page
 * design was being finalised. HOME_TITLE and HOME_DESCRIPTION were left alone on
 * purpose, so the indexed title and meta description are unchanged and only the
 * on-page headline moved. HOME_OG_DESCRIPTION interpolates HOME_H1, so the social
 * card copy follows the new wording automatically.
 */
import { SUPPORT_ENQUIRY_MAILTO } from '@/lib/constants/contact';

export const HOME_TITLE = 'SubHalt — Track, Manage & Cancel Subscriptions';

export const HOME_DESCRIPTION =
  'SubHalt shows every subscription you pay for in one place and reminds you before they renew. Cancel the ones you forgot about — stop leaking money every month.';

export const HOME_H1 = 'Never get surprise charged again';

/**
 * The social-preview blurb, shared by `og:description` and
 * `twitter:description`. It is intentionally not HOME_DESCRIPTION: the card
 * leads with the H1 and drops the second sentence, because unfurls truncate
 * hard and the first line is the part that survives.
 */
export const HOME_OG_DESCRIPTION = `${HOME_H1}. SubHalt tracks every subscription you pay for and alerts you before each renewal.`;

export const HOME_SUBLINE =
  'SubHalt tracks every subscription you have and alerts you before each renewal.';

/**
 * The hero's single call to action.
 *
 * "Contact Us" opens a pre-addressed mail rather than the signup page, which is
 * how this page was originally built. Sign-up is still one tap away in the header
 * and again in the footer, so the conversion path is intact — but the hero no
 * longer asks for an account before it offers help. Pairing the label with a
 * `/signup` href would have been a lie the visitor only discovers by clicking.
 */
export const HOME_CTA_HREF = SUPPORT_ENQUIRY_MAILTO;

export const HOME_CTA_LABEL = 'Contact Us';
