import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MorePage from '@/app/more/page';

const mocks = vi.hoisted(() => ({
  pathname: '/more',
  isAdmin: false,
  isPlus: false,
  signOut: vi.fn(async () => true),
  toastError: vi.fn(),
  billsEnabled: false,
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

vi.mock('@/lib/contexts/user-settings-context', () => ({
  useAuth: () => ({ isAdmin: mocks.isAdmin }),
  usePlan: () => ({ isPlus: mocks.isPlus }),
}));

vi.mock('@/lib/auth/sign-out', () => ({
  signOutAndRedirect: () => mocks.signOut(),
}));

vi.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => ({ toast: { error: mocks.toastError, success: vi.fn(), info: vi.fn() } }),
}));

// The flag is read at module load, so it has to be mocked before nav.ts
// evaluates it.
vi.mock('@/lib/config/feature-flags', () => ({
  get BILL_PAYMENT_ENABLED() {
    return mocks.billsEnabled;
  },
}));

beforeEach(() => {
  mocks.pathname = '/more';
  mocks.isAdmin = false;
  mocks.isPlus = false;
  mocks.billsEnabled = false;
  mocks.signOut.mockClear();
  mocks.signOut.mockResolvedValue(true);
  mocks.toastError.mockClear();
});

describe('MorePage', () => {
  it('renders as a page labelled More', () => {
    render(<MorePage />);

    expect(screen.getByRole('heading', { name: 'More' })).toBeInTheDocument();
  });

  it('does not repeat the routes that already have their own dock slot', () => {
    render(<MorePage />);

    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));

    // Home, Subs, Renewals, and Inbox are dock slots, so repeating them here
    // would give the user two identical targets in one menu.
    expect(hrefs).not.toContain('/');
    expect(hrefs).not.toContain('/subscriptions');
    expect(hrefs).not.toContain('/renewals');
    expect(hrefs).not.toContain('/inbox');
  });

  it('keeps a group collapsed until it is opened', () => {
    mocks.pathname = '/more';
    render(<MorePage />);

    expect(screen.queryByRole('link', { name: 'Past Activity' })).not.toBeInTheDocument();
  });

  it('opens a group on tap', async () => {
    render(<MorePage />);

    await userEvent.click(screen.getByRole('button', { name: 'Toggle History submenu' }));

    expect(screen.getByRole('link', { name: 'Past Activity' })).toBeInTheDocument();
  });

  it('collapses a group again on a second tap', async () => {
    render(<MorePage />);

    const toggle = screen.getByRole('button', { name: 'Toggle History submenu' });

    await userEvent.click(toggle);
    await userEvent.click(toggle);

    expect(screen.queryByRole('link', { name: 'Past Activity' })).not.toBeInTheDocument();
  });

  it('defaults a group to open when the current route lives inside it', () => {
    // The page must never open showing a collapsed section that holds the
    // page the user is already on.
    mocks.pathname = '/history/archive';
    render(<MorePage />);

    const toggle = screen.getByRole('button', { name: 'Toggle History submenu' });

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Archive' })).toHaveAttribute('aria-current', 'page');
  });

  it('hides Bills & Payments while the feature flag is off', () => {
    mocks.billsEnabled = false;
    render(<MorePage />);

    expect(
      screen.queryByRole('button', { name: 'Toggle Bills & Payments submenu' }),
    ).not.toBeInTheDocument();
  });

  it('shows Bills & Payments with its submenu while the feature flag is on', async () => {
    mocks.billsEnabled = true;
    render(<MorePage />);

    const toggle = screen.getByRole('button', { name: 'Toggle Bills & Payments submenu' });

    expect(toggle).toBeInTheDocument();

    await userEvent.click(toggle);

    expect(screen.getByRole('link', { name: 'Pay a Bill' })).toBeInTheDocument();
  });

  it('hides the Admin entry from non-admins', () => {
    mocks.isAdmin = false;
    render(<MorePage />);

    expect(screen.queryByRole('link', { name: /Admin/ })).not.toBeInTheDocument();
  });

  it('shows the Admin entry to admins', () => {
    mocks.isAdmin = true;
    render(<MorePage />);

    expect(screen.getByRole('link', { name: /Admin/ })).toBeInTheDocument();
  });

  it('marks the active row with aria-current', () => {
    mocks.pathname = '/settings';
    render(<MorePage />);

    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
  });

  it('always offers the account and support links', () => {
    render(<MorePage />);

    expect(screen.getByRole('link', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Help' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Upgrade Plan' })).toBeInTheDocument();
  });

  it('returns to the route the user came from when upgrading', () => {
    mocks.pathname = '/settings';
    render(<MorePage />);

    expect(screen.getByRole('link', { name: 'Upgrade Plan' })).toHaveAttribute(
      'href',
      '/plans?from=%2Fsettings',
    );
  });

  it('sends a plus customer to their plan instead of offering another upgrade', () => {
    mocks.isPlus = true;
    render(<MorePage />);

    expect(screen.getByRole('link', { name: 'Plus' })).toHaveAttribute(
      'href',
      '/settings?section=plan',
    );
    expect(screen.queryByRole('link', { name: 'Upgrade Plan' })).not.toBeInTheDocument();
  });

  it('asks for confirmation before signing out', async () => {
    render(<MorePage />);

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));

    // The button only opens the confirmation; nothing is signed out yet.
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('signs out and hard-navigates to login once confirmed', async () => {
    render(<MorePage />);

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Log out' }));

    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it('reports an error when sign-out fails', async () => {
    mocks.signOut.mockResolvedValue(false);
    render(<MorePage />);

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Log out' }));

    expect(mocks.toastError).toHaveBeenCalledTimes(1);
  });

  it('keeps the build SHA off the page', () => {
    render(<MorePage />);

    // The commit marker was a support aid, but it read to users as a stray
    // version string at the bottom of the menu. The SHA is still exposed on the
    // document element as `data-build` for debugging.
    expect(screen.queryByText(/^build /)).not.toBeInTheDocument();
  });

  it('links every visible nav item somewhere', () => {
    mocks.billsEnabled = true;
    mocks.isAdmin = true;
    render(<MorePage />);

    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute('href')).toBeTruthy();
    }
  });
});
