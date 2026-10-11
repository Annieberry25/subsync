import { describe, it, expect } from 'vitest';
import {
  HOME_TITLE,
  HOME_DESCRIPTION,
  HOME_H1,
  HOME_SUBLINE,
  HOME_OG_DESCRIPTION,
} from '@/lib/seo/home-copy';

/**
 * These strings are indexed. Changing one silently changes what Google shows
 * for the site and can drop the existing index entry, so they are pinned here
 * to fail loudly instead.
 */
describe('homepage SEO copy', () => {
  it('pins the exact title tag', () => {
    expect(HOME_TITLE).toBe('SubHalt — Track, Manage & Cancel Subscriptions');
  });

  it('pins the exact meta description', () => {
    expect(HOME_DESCRIPTION).toBe(
      'SubHalt shows every subscription you pay for in one place and reminds you before they renew. Cancel the ones you forgot about — stop leaking money every month.',
    );
  });

  it('pins the exact H1 and subline', () => {
    expect(HOME_H1).toBe('Never get surprise-charged again');
    expect(HOME_SUBLINE).toBe(
      'SubHalt tracks every subscription you have and alerts you before each renewal.',
    );
  });

  it('pins the exact social preview description, led by the H1', () => {
    expect(HOME_OG_DESCRIPTION).toBe(
      'Never get surprise-charged again. SubHalt tracks every subscription you pay for and alerts you before each renewal.',
    );
  });
});
