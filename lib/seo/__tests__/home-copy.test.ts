import { describe, it, expect } from 'vitest';
import {
  HOME_TITLE,
  HOME_DESCRIPTION,
  HOME_H1,
  HOME_SUBLINE,
  HOME_OG_DESCRIPTION,
  HOME_CTA_LABEL,
  HOME_CTA_HREF,
} from '@/lib/seo/home-copy';
import { SUPPORT_ENQUIRY_MAILTO } from '@/lib/constants/contact';

/**
 * These strings are indexed. Changing one silently changes what Google shows
 * for the site and can drop the existing index entry, so they are pinned here
 * to fail loudly instead.
 */
describe('homepage SEO copy', () => {
  it('pins the exact title tag', () => {
    // The em dash was dropped from the social card on purpose; a plain hyphen
    // keeps the wording while losing the dash.
    expect(HOME_TITLE).toBe('SubHalt - Track, Manage & Cancel Subscriptions');
  });

  it('pins the exact meta description', () => {
    expect(HOME_DESCRIPTION).toBe(
      'SubHalt shows every subscription you pay for in one place and reminds you before they renew. Cancel the ones you forgot about — stop leaking money every month.',
    );
  });

  it('pins the exact H1 and subline', () => {
    // Reworded from "Never get surprise-charged again" while the landing page
    // was being worked on: the hyphen was dropped. The title and meta
    // description above are deliberately unchanged, so the indexed entry keeps
    // its wording and only the on-page headline moved.
    expect(HOME_H1).toBe('Never get surprise charged again');
    expect(HOME_SUBLINE).toBe(
      'SubHalt tracks every subscription you have and alerts you before each renewal.',
    );
  });

  it('pins the exact social preview description, led by the H1', () => {
    expect(HOME_OG_DESCRIPTION).toBe(
      'Never get surprise charged again. SubHalt tracks every subscription you pay for and alerts you before each renewal.',
    );
  });

  /**
   * The hero call to action is a pre-addressed mail, not a signup route. Sign-up
   * remains reachable from the header and footer. Pinned so the label and the
   * href cannot drift apart — a "Contact Us" button pointing at /signup would be
   * a lie the visitor only discovers by clicking.
   */
  it('pins the contact call to action', () => {
    expect(HOME_CTA_LABEL).toBe('Contact Us');
    expect(HOME_CTA_HREF).toBe(SUPPORT_ENQUIRY_MAILTO);
    expect(HOME_CTA_HREF).toMatch(/^mailto:/);
  });
});
