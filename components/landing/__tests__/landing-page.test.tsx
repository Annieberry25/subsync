import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { LandingPage } from '@/components/landing/landing-page';
import {
  HOME_H1,
  HOME_SUBLINE,
  HOME_CTA_HREF,
  HOME_CTA_LABEL,
} from '@/lib/seo/home-copy';
import { SUPPORT_ENQUIRY_MAILTO } from '@/lib/constants/contact';

describe('LandingPage', () => {
  it('renders the indexed copy as a real <h1>', () => {
    render(<LandingPage />);

    // Level 1 specifically: a styled <div> would pass a text query but carry no
    // heading semantics for a crawler.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(HOME_H1);
  });

  it('renders the subline', () => {
    render(<LandingPage />);

    expect(screen.getByText(HOME_SUBLINE)).toBeInTheDocument();
  });

  /**
   * The contact action appears more than once, so every instance is checked rather
   * than the first: a second copy added with a wrong href would otherwise pass.
   */
  it('offers the contact call to action as a pre-addressed mail', () => {
    render(<LandingPage />);

    const links = screen.getAllByRole('link', { name: HOME_CTA_LABEL });
    expect(links.length).toBeGreaterThan(0);

    for (const link of links) {
      expect(link).toHaveAttribute('href', HOME_CTA_HREF);
      expect(link).toHaveAttribute('href', SUPPORT_ENQUIRY_MAILTO);
      expect(link.getAttribute('href')).toMatch(/^mailto:/);
    }
  });

  /**
   * Scoped to the banner: the footer carries the same two entry points, so an
   * unscoped query would match twice and assert nothing about either.
   */
  it('links sign in and sign up from the header', () => {
    render(<LandingPage />);

    const header = within(screen.getByRole('banner'));
    expect(header.getByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/login');
    expect(header.getByRole('link', { name: 'Sign Up' })).toHaveAttribute('href', '/signup');
  });

  /**
   * The header offers the section links and the account entry points. /help stays
   * out of it on purpose: that link belongs to the footer, where it does not
   * compete with the call to action.
   */
  it('keeps help out of the header navigation', () => {
    render(<LandingPage />);

    const header = screen.getByRole('banner');
    const nav = within(header).getByRole('navigation', { name: 'Sections' });
    const hrefs = within(nav)
      .getAllByRole('link')
      .map((l) => l.getAttribute('href'));

    // Home leads; Features, How it works and About are pages of their own.
    expect(hrefs).toEqual(['/', '/features', '/how-it-works', '/about']);
    expect(hrefs).not.toContain('/help');
  });

  /**
   * The hero's one call to action is the contact address, so the page must not
   * also offer a second contact link lower down: two buttons for one destination
   * splits the attention that either was meant to get.
   */
  it('offers the contact address once, in the hero', () => {
    render(<LandingPage />);

    expect(screen.getAllByRole('link', { name: HOME_CTA_LABEL })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(HOME_H1);

    // The closing section keeps its sign-up call to action.
    expect(
      screen.getAllByRole('link', { name: 'Start tracking free' }).length
    ).toBeGreaterThan(0);
  });

  /**
   * The hero reads H1, subline, one action. A fourth muted brand line under the
   * button was the last thing on the page competing with the headline for
   * attention, and on a phone it pushed the first section entirely below the fold.
   * Asserted so a layout pass cannot quietly reintroduce it, or let the H1 drift.
   */
  it('leaves the hero as headline, subline and one action', () => {
    render(<LandingPage />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(HOME_H1);
    expect(screen.getByText(HOME_SUBLINE)).toBeInTheDocument();
    expect(screen.queryByText(/Track and Manage Every Subscription/i)).toBeNull();
  });

  /**
   * The footer stays deliberately thin: company and a way into the help centre.
   * The support address is not printed here. A visitor who needs to write in has
   * the Contact Us action in the hero, which opens a pre-addressed mail with the
   * subject filled in, and repeating the raw address in the footer put a second
   * route to the same place on the page.
   *
   * What it must not carry is guarded below: /privacy and /terms have no route
   * yet, and a marketing page is the worst possible place to ship a dead link.
   */
  it('has a footer that stays thin and links only to routes that exist', () => {
    render(<LandingPage />);

    const footerEl = screen.getByRole('contentinfo');
    const footer = within(footerEl);
    expect(footerEl).toHaveTextContent(/SUBHALT LTD/i);
    expect(footer.getByRole('link', { name: 'Help' })).toHaveAttribute('href', '/help');
    expect(footer.queryByRole('link', { name: /privacy/i })).toBeNull();
    expect(footer.queryByRole('link', { name: /terms/i })).toBeNull();
    expect(footer.queryByRole('link', { name: /plans/i })).toBeNull();
    // The hero owns the contact route; the footer does not repeat it.
    expect(footer.queryByRole('link', { name: HOME_CTA_LABEL })).toBeNull();
  });

  /**
   * Heading order is the page's table of contents for a crawler and for anyone
   * navigating by landmark. The hero keeps level 1 alone.
   */
  it('has exactly one level 1 heading and no skipped levels', () => {
    render(<LandingPage />);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole('heading', { level: 2, name: /three steps/i })
    ).toBeInTheDocument();
    // The six-card grid moved to /features; only the sequence remains here.
    expect(screen.queryByRole('heading', { name: /built for/i })).toBeNull();
  });

  /**
   * The free-tier line used to sit under a hero button that asked for an account.
   * That button is now the contact address, so the line is gone rather than left
   * describing a step the page no longer takes.
   */
  it('no longer advertises the free tier under the hero call to action', () => {
    render(<LandingPage />);

    expect(screen.queryByText(/first \d+ subscriptions/i)).toBeNull();
    expect(screen.queryByText(/no card required/i)).toBeNull();
  });
});
