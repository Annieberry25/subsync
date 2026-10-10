import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MobileDock } from '@/components/layout/MobileDock';

const mocks = vi.hoisted(() => ({
  pathname: '/',
  overlayOpen: false,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/hooks/use-overlay-open', () => ({
  useOverlayOpen: () => mocks.overlayOpen,
}));

const setPath = (pathname: string) => {
  mocks.pathname = pathname;
};

const scrollTo = async (value: number) => {
  await act(async () => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value });
    window.dispatchEvent(new Event('scroll'));
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  });
};

beforeEach(() => {
  mocks.pathname = '/';
  mocks.overlayOpen = false;
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
});

describe('MobileDock', () => {
  it('renders exactly five slots, so target widths stay predictable', () => {
    render(<MobileDock />);

    expect(screen.getAllByRole('link')).toHaveLength(5);
  });

  it('exposes the four primary routes plus a More link', () => {
    render(<MobileDock />);

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Subscriptions' })).toHaveAttribute(
      'href',
      '/subscriptions',
    );
    expect(screen.getByRole('link', { name: 'Renewals' })).toHaveAttribute('href', '/renewals');
    expect(screen.getByRole('link', { name: 'Inbox' })).toHaveAttribute('href', '/inbox');
    expect(screen.getByRole('link', { name: 'More' })).toHaveAttribute('href', '/more');
  });

  it('keeps every label visible rather than collapsing to icons', () => {
    render(<MobileDock />);

    // The subscriptions slot reads "Subs" because "Subscriptions" would not
    // fit in a ~64px slot at 320px, but it keeps an explicit full-name
    // aria-label so the truncation is not exposed as the name.
    expect(screen.getByText('Subs')).toBeInTheDocument();
    expect(screen.getByText('Renewals')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Inbox')).toBeInTheDocument();
    expect(screen.getByText('More')).toBeInTheDocument();
  });

  it('marks the current route with aria-current', () => {
    setPath('/renewals');
    render(<MobileDock />);

    expect(screen.getByRole('link', { name: 'Renewals' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('treats a nested route as active for its section', () => {
    setPath('/renewals/upcoming');
    render(<MobileDock />);

    expect(screen.getByRole('link', { name: 'Renewals' })).toHaveAttribute('aria-current', 'page');
  });

  it('marks the More slot as the fallback for a route it owns', () => {
    setPath('/settings');
    render(<MobileDock />);

    expect(screen.getByRole('link', { name: 'More' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('does not mark More as current when a primary slot is active', () => {
    setPath('/subscriptions');
    render(<MobileDock />);

    // More is only "active" as a fallback; when a real route is active the
    // fallback must not also light up, or two slots read as current.
    expect(screen.getByRole('link', { name: 'More' })).not.toHaveAttribute('aria-current', 'page');
  });

  it('stays hidden on full-page routes, which carry their own layout', () => {
    setPath('/login');
    const { container } = render(<MobileDock />);

    expect(container).toBeEmptyDOMElement();
  });

  it('collapses while an overlay owns the viewport', () => {
    mocks.overlayOpen = true;
    const { container } = render(<MobileDock />);

    const nav = container.querySelector('[data-mobile-dock]');

    expect(nav).toHaveClass('translate-y-full');
  });

  it('hides below lg only, since the sidebar replaces it above that', () => {
    const { container } = render(<MobileDock />);

    expect(container.querySelector('[data-mobile-dock]')).toHaveClass('lg:hidden');
  });

  it('sits under the Sheet overlay rather than over it', () => {
    const { container } = render(<MobileDock />);

    const nav = container.querySelector('[data-mobile-dock]');

    // z-60 vs the overlay's z-70. If these ever cross, the dock paints over
    // open dialogs.
    expect(nav).toHaveClass('z-60');
  });

  it('hides on downward scroll once the user has left the top of the page', async () => {
    const { container } = render(<MobileDock />);

    expect(container.querySelector('[data-mobile-dock]')).toHaveClass('translate-y-0');

    // The scroll handler is rAF-throttled, so the frame has to be flushed
    // before the resulting state is observable.
    await scrollTo(400);

    expect(container.querySelector('[data-mobile-dock]')).toHaveClass('translate-y-full');
  });

  it('returns on upward scroll', async () => {
    const { container } = render(<MobileDock />);

    await scrollTo(400);
    expect(container.querySelector('[data-mobile-dock]')).toHaveClass('translate-y-full');

    await scrollTo(100);
    expect(container.querySelector('[data-mobile-dock]')).toHaveClass('translate-y-0');
  });

  it('forces the dock back when scrolling to the very top', async () => {
    const { container } = render(<MobileDock />);

    await scrollTo(400);
    expect(container.querySelector('[data-mobile-dock]')).toHaveClass('translate-y-full');

    // At the top the direction is forced to "up" rather than being derived
    // from a delta, so a page that reloads mid-scroll does not come back
    // with a hidden dock.
    await scrollTo(0);
    expect(container.querySelector('[data-mobile-dock]')).toHaveClass('translate-y-0');
  });
});
