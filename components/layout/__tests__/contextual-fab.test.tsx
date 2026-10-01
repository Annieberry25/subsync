import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ContextualFab } from '@/components/layout/ContextualFab';

const mocks = vi.hoisted(() => ({
  pathname: '/',
  overlayOpen: false,
  atTop: true,
  direction: 'up' as 'up' | 'down',
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/hooks/use-overlay-open', () => ({
  useOverlayOpen: () => mocks.overlayOpen,
}));

vi.mock('@/lib/hooks/use-scroll-direction', () => ({
  useScrollDirection: () => ({ direction: mocks.direction, atTop: mocks.atTop }),
}));

const setPath = (pathname: string) => {
  mocks.pathname = pathname;
};

const addFab = () => screen.queryByRole('button', { name: 'Add subscription' });
const recordFab = () => screen.queryByRole('button', { name: 'Record payment' });

describe('ContextualFab route visibility', () => {
  beforeEach(() => {
    mocks.overlayOpen = false;
    mocks.atTop = true;
    mocks.direction = 'up';
  });

  it('offers Add subscription inside the subscriptions menu', () => {
    setPath('/subscriptions');
    render(<ContextualFab />);

    expect(addFab()).toBeInTheDocument();
  });

  it('offers it on a nested subscriptions route too', () => {
    setPath('/subscriptions/archived');
    render(<ContextualFab />);

    expect(addFab()).toBeInTheDocument();
  });

  it('does not offer it on the dashboard', () => {
    // The dashboard has its own explicit "Add Subscription" button, so a second
    // floating one just competed with it.
    setPath('/');
    render(<ContextualFab />);

    expect(addFab()).not.toBeInTheDocument();
  });

  it('does not offer it on renewals, where it read as "add this renewal"', () => {
    setPath('/renewals');
    render(<ContextualFab />);

    expect(addFab()).not.toBeInTheDocument();
  });

  it('keeps the unrelated bills action working', () => {
    setPath('/bills');
    render(<ContextualFab />);

    expect(recordFab()).toBeInTheDocument();
    expect(addFab()).not.toBeInTheDocument();
  });

  it('stays hidden on full-page routes and while an overlay is open', () => {
    setPath('/subscriptions');
    mocks.overlayOpen = true;
    const { unmount } = render(<ContextualFab />);
    expect(addFab()).not.toBeInTheDocument();
    unmount();

    mocks.overlayOpen = false;
    setPath('/auth/login');
    render(<ContextualFab />);
    expect(addFab()).not.toBeInTheDocument();
  });
});
