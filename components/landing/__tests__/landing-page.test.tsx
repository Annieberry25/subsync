import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  it('offers the contact call to action as a pre-addressed mail', () => {
    render(<LandingPage />);

    const link = screen.getByRole('link', { name: HOME_CTA_LABEL });
    expect(link).toHaveAttribute('href', HOME_CTA_HREF);
    expect(link).toHaveAttribute('href', SUPPORT_ENQUIRY_MAILTO);
    expect(link.getAttribute('href')).toMatch(/^mailto:/);
  });

  it('links sign in and sign up from the header', () => {
    render(<LandingPage />);

    expect(screen.getByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Sign Up' })).toHaveAttribute('href', '/signup');
  });

  /**
   * The original tagline used to be the hero H1. The H1 now carries the indexed
   * copy from lib/seo/home-copy, and rewording that risks a re-index, so the line
   * survives as a muted brand statement under the call to action. Asserted so a
   * future layout pass cannot quietly drop it — or let it creep back into the H1.
   */
  it('keeps the original tagline below the call to action', () => {
    render(<LandingPage />);

    expect(screen.getByText(/Track and Manage Every Subscription/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(HOME_H1);
  });

  /**
   * The footer is intentionally absent while its contents are being decided.
   * Asserted so it comes back deliberately rather than being forgotten — with the
   * footer gone, /privacy and /terms have no inbound link from this page.
   */
  it('has no footer yet', () => {
    render(<LandingPage />);

    expect(document.querySelector('footer')).toBeNull();
  });
});
