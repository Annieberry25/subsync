import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

/**
 * `scrollY` has to go through defineProperty so repeated assignments across
 * tests stay writable; a plain assignment breaks once one test has redefined it.
 */
const setScrollY = (value: number) => {
  Object.defineProperty(window, 'scrollY', { value, configurable: true, writable: true });
};

const scrollTo = async (value: number) => {
  await act(async () => {
    setScrollY(value);
    window.dispatchEvent(new Event('scroll'));
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  });
};

beforeEach(() => {
  mocks.pathname = '/';
  mocks.overlayOpen = false;
  setScrollY(0);
});

describe('MobileDock', () => {
  it('renders exactly four slots, so target widths stay predictable', () => {
    render(<MobileDock onOpenMore={vi.fn()} />);

    const slots = screen.getAllByRole('link').concat(screen.getAllByRole('button'));

    // Three route slots plus the More button.
    expect(slots).toHaveLength(4);
  });

  it('exposes the three primary routes plus a More trigger', () => {
    render(<MobileDock onOpenMore={vi.fn()} />);

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Subscriptions' })).toHaveAttribute(
      'href',
      '/subscriptions',
    );
    expect(screen.getByRole('link', { name: 'Renewals' })).toHaveAttribute('href', '/renewals');
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
  });

  it('keeps every label visible rather than collapsing to icons', () => {
    render(<MobileDock onOpenMore={vi.fn()} />);

    // The subscriptions slot reads "Subs" because "Subscriptions" would not
    // fit in a ~76px slot at 320px, but it keeps an explicit full-name
    // aria-label so the truncation is not exposed as the name.
    expect(screen.getByText('Subs')).toBeInTheDocument();
    expect(screen.getByText('Renewals')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('More')).toBeInTheDocument();
  });

  it('marks the current route with aria-current', () => {
    setPath('/renewals');
    render(<MobileDock onOpenMore={vi.fn()} />);

    expect(screen.getByRole('link', { name: 'Renewals' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('treats a nested route as active for its section', () => {
    setPath('/renewals/upcoming');
    render(<MobileDock onOpenMore={vi.fn()} />);

    expect(screen.getByRole('link', { name: 'Renewals' })).toHaveAttribute('aria-current', 'page');
  });

  it('does not mark the More slot as the current page when a route slot is active', () => {
    setPath('/subscriptions');
    render(<MobileDock onOpenMore={vi.fn()} />);

    // More is only "active" as a fallback; when a real route is active the
    // fallback must not also light up, or two slots read as current.
    expect(screen.getByRole('button', { name: 'More' })).not.toHaveAttribute('aria-current', 'page');
  });

  it('reports the real More sheet state through aria-expanded', async () => {
    const { rerender } = render(<MobileDock onOpenMore={vi.fn()} moreOpen={false} />);

    expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'false');

    rerender(<MobileDock onOpenMore={vi.fn()} moreOpen />);

    expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('opens the More sheet from the trigger', async () => {
    const onOpenMore = vi.fn();
    render(<MobileDock onOpenMore={onOpenMore} />);

    await userEvent.click(screen.getByRole('button', { name: 'More' }));

    expect(onOpenMore).toHaveBeenCalledTimes(1);
  });

  it('wires the More trigger to the sheet panel it controls', () => {
    render(<MobileDock onOpenMore={vi.fn()} />);

    const trigger = screen.getByRole('button', { name: 'More' });

    expect(trigger).toHaveAttribute('aria-controls', 'more-sheet-panel');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('stays hidden on full-page routes, which carry their own layout', () => {
    setPath('/login');
    const { container } = render(<MobileDock onOpenMore={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('collapses while an overlay owns the viewport', () => {
    mocks.overlayOpen = true;
    const { container } = render(<MobileDock onOpenMore={vi.fn()} />);

    const nav = container.querySelector('[data-mobile-dock]');

    expect(nav).toHaveClass('translate-y-full');
  });

  it('hides below lg only, since the sidebar replaces it above that', () => {
    const { container } = render(<MobileDock onOpenMore={vi.fn()} />);

    const nav = container.querySelector('[data-mobile-dock]');

    expect(nav).toHaveClass('lg:hidden');
  });

  it('sits under the Sheet overlay rather than over it', () => {
    const { container } = render(<MobileDock onOpenMore={vi.fn()} />);

    const nav = container.querySelector('[data-mobile-dock]');

    // z-60 vs the overlay's z-70. If these ever cross, the dock paints over
    // open dialogs.
    expect(nav).toHaveClass('z-60');
  });

  it('hides on downward scroll once the user has left the top of the page', async () => {
    const { container } = render(<MobileDock onOpenMore={vi.fn()} />);

    expect(container.querySelector('[data-mobile-dock]')).toHaveClass('translate-y-0');

    // The scroll handler is rAF-throttled, so the frame has to be flushed
    // before the resulting state is observable.
    await scrollTo(400);

    expect(container.querySelector('[data-mobile-dock]')).toHaveClass('translate-y-full');
  });

  it('returns on upward scroll', async () => {
    const { container } = render(<MobileDock onOpenMore={vi.fn()} />);

    await scrollTo(400);
    expect(container.querySelector('[data-mobile-dock]')).toHaveClass('translate-y-full');

    await scrollTo(100);
    expect(container.querySelector('[data-mobile-dock]')).toHaveClass('translate-y-0');
  });

  it('forces the dock back when scrolling to the very top', async () => {
    const { container } = render(<MobileDock onOpenMore={vi.fn()} />);

    await scrollTo(400);
    expect(container.querySelector('[data-mobile-dock]')).toHaveClass('translate-y-full');

    // At the top the direction is forced to "up" rather than being derived
    // from a delta, so a page that reloads mid-scroll does not come back
    // with a hidden dock.
    await scrollTo(0);
    expect(container.querySelector('[data-mobile-dock]')).toHaveClass('translate-y-0');
  });
});
