import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { NAV_LINKS, SiteHeader } from '@/components/marketing/site-header';

/**
 * The four public marketing pages each carried their own copy of the header bar,
 * which is how /features ended up offering only Home and Sign Up while the landing
 * page offered four links. There is one header now.
 *
 * These tests guard the shared component itself. The pages importing it is checked
 * by the page-level suites, so a page going back to its own markup fails there
 * rather than here.
 */
describe('SiteHeader', () => {
  it('offers every section link, in order', () => {
    render(<SiteHeader />);

    const nav = within(screen.getByRole('banner')).getByRole('navigation', {
      name: 'Sections',
    });
    const links = within(nav).getAllByRole('link');

    expect(links.map((l) => l.textContent?.trim())).toEqual(
      NAV_LINKS.map((l) => l.label)
    );
    expect(NAV_LINKS.map((l) => l.label)).toEqual([
      'Home',
      'Features',
      'How it works',
      'About',
    ]);
  });

  it('points every link at a real route', () => {
    render(<SiteHeader />);

    const nav = within(screen.getByRole('banner')).getByRole('navigation', {
      name: 'Sections',
    });
    const hrefs = within(nav)
      .getAllByRole('link')
      .map((l) => l.getAttribute('href'));

    // No in-page anchors: each of these is its own page, so a stale #id on a
    // section that moved would otherwise scroll nowhere.
    expect(hrefs.every((h) => h?.startsWith('/'))).toBe(true);
    expect(hrefs).toEqual(['/', '/features', '/how-it-works', '/about']);
  });

  /**
   * Both account entry points are reachable in the header, and Sign Up is the one
   * that stays visible at every width. Sign In moves into the disclosure below
   * `md`: it is a return visit, and keeping it beside Sign Up in the bar left the
   * primary action competing for room the bar did not have on a phone.
   *
   * The bar's Sign In is the only one in the tree while the panel is closed, since
   * `hidden` takes the panel and its links out of the accessibility tree entirely.
   */
  it('carries both account entry points at every width', () => {
    render(<SiteHeader />);

    const header = within(screen.getByRole('banner'));
    expect(header.getByRole('link', { name: 'Sign Up' })).toHaveAttribute(
      'href',
      '/signup'
    );
    expect(header.getByRole('link', { name: 'Sign In' })).toHaveAttribute(
      'href',
      '/login'
    );
  });

  /**
   * The disclosure. The panel is reached by the id the toggle points at with
   * `aria-controls` rather than by role, because `hidden` means it is correctly
   * absent from the accessibility tree until it opens. That absence is itself
   * worth asserting: a closed menu whose links are still reachable by keyboard or
   * screen reader is a bug, not a detail.
   */
  it('opens and closes the mobile menu from the header button', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();

    render(<SiteHeader />);

    const header = within(screen.getByRole('banner'));
    const toggle = header.getByRole('button', { name: 'Open menu' });

    expect(toggle).toHaveAttribute('aria-controls', 'marketing-menu');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    const panel = document.getElementById('marketing-menu');
    expect(panel).not.toBeNull();
    expect(panel).toHaveAttribute('hidden');
    // Closed means absent from the tree, not merely invisible.
    expect(screen.queryByRole('navigation', { name: 'Menu' })).toBeNull();

    await user.click(toggle);

    expect(header.getByRole('button', { name: 'Close menu' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(panel).not.toHaveAttribute('hidden');

    const menu = within(panel as HTMLElement).getByRole('navigation', { name: 'Menu' });
    expect(
      within(menu).getAllByRole('link').map((l) => l.getAttribute('href'))
    ).toEqual(['/', '/features', '/how-it-works', '/about', '/login']);

    await user.click(header.getByRole('button', { name: 'Close menu' }));

    expect(panel).toHaveAttribute('hidden');
  });

  it('brands the home link with the wordmark', () => {
    render(<SiteHeader />);

    expect(screen.getByRole('link', { name: 'SubHalt home' })).toHaveAttribute('href', '/');
  });
});
