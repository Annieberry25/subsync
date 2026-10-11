import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MinimalHome } from '@/components/home/minimal-home';
import { HOME_H1, HOME_SUBLINE } from '@/lib/seo/home-copy';

describe('MinimalHome', () => {
  it('renders the indexed copy as a real <h1>', () => {
    render(<MinimalHome />);

    // Level 1 specifically: a styled <div> would pass a text query but carry no
    // heading semantics for a crawler.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(HOME_H1);
  });

  it('renders the subline', () => {
    render(<MinimalHome />);

    expect(screen.getByText(HOME_SUBLINE)).toBeInTheDocument();
  });

  it('offers one get-started link pointing at signup', () => {
    render(<MinimalHome />);

    const link = screen.getByRole('link', { name: 'Get started' });
    expect(link).toHaveAttribute('href', '/signup');
  });
});
