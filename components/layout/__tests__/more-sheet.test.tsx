import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MoreSheet } from '@/components/layout/MoreSheet';

const mocks = vi.hoisted(() => ({
  pathname: '/',
  unreadCount: 0,
  isAdmin: false,
  signOut: vi.fn(async () => {}),
  push: vi.fn(),
  refresh: vi.fn(),
  billsEnabled: false,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
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

vi.mock('@/lib/contexts/inbox-context', () => ({
  useInbox: () => ({ unreadCount: mocks.unreadCount }),
}));

vi.mock('@/lib/contexts/user-settings-context', () => ({
  useAuth: () => ({ isAdmin: mocks.isAdmin }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: mocks.signOut } }),
}));

// The flag is read at module load, so it has to be mocked before nav.ts
// evaluates it.
vi.mock('@/lib/config/feature-flags', () => ({
  get BILL_PAYMENT_ENABLED() {
    return mocks.billsEnabled;
  },
}));

beforeEach(() => {
  mocks.pathname = '/';
  mocks.unreadCount = 0;
  mocks.isAdmin = false;
  mocks.billsEnabled = false;
  mocks.signOut.mockClear();
  mocks.push.mockClear();
  mocks.refresh.mockClear();
});

const renderSheet = (open = true) =>
  render(<MoreSheet open={open} onClose={vi.fn()} />);

describe('MoreSheet', () => {
  it('renders nothing while closed', () => {
    const { container } = renderSheet(false);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders as a dialog labelled More', () => {
    renderSheet();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'More' })).toBeInTheDocument();
  });

  it('exposes the panel id the dock trigger points aria-controls at', () => {
    renderSheet();

    // MobileDock sets aria-controls="more-sheet-panel"; if this id drifts the
    // trigger silently stops referring to anything.
    expect(screen.getByRole('dialog')).toHaveAttribute('id', 'more-sheet-panel');
  });

  it('does not repeat the routes that already have their own dock slot', () => {
    renderSheet();

    const dialog = screen.getByRole('dialog');
    const hrefs = within(dialog)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));

    // Home, Subs, and Renewals are dock slots, so repeating them here would
    // give the user two identical targets in one menu.
    expect(hrefs).not.toContain('/');
    expect(hrefs).not.toContain('/subscriptions');
    expect(hrefs).not.toContain('/renewals');
  });

  it('pins Inbox first, since it lost its dock slot', () => {
    renderSheet();

    const dialog = screen.getByRole('dialog');
    const links = within(dialog).getAllByRole('link');
    const inbox = within(dialog).getByRole('link', { name: /Inbox/ });

    expect(links[0]).toBe(inbox);
  });

  it('badges the Inbox row with the unread count', () => {
    mocks.unreadCount = 7;
    renderSheet();

    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('caps the unread badge at 99+', () => {
    mocks.unreadCount = 250;
    renderSheet();

    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('omits the badge when the inbox is empty', () => {
    mocks.unreadCount = 0;
    renderSheet();

    const dialog = screen.getByRole('dialog');
    const inbox = within(dialog).getByRole('link', { name: /Inbox/ });

    expect(within(inbox).queryByText('99+')).not.toBeInTheDocument();
  });

  it('keeps a group collapsed until it is opened', () => {
    mocks.pathname = '/';
    renderSheet();

    expect(screen.queryByRole('link', { name: 'Past Activity' })).not.toBeInTheDocument();
  });

  it('opens a group on tap', async () => {
    renderSheet();

    await userEvent.click(screen.getByRole('button', { name: 'Toggle History submenu' }));

    expect(screen.getByRole('link', { name: 'Past Activity' })).toBeInTheDocument();
  });

  it('collapses a group again on a second tap', async () => {
    renderSheet();

    const toggle = screen.getByRole('button', { name: 'Toggle History submenu' });

    await userEvent.click(toggle);
    await userEvent.click(toggle);

    expect(screen.queryByRole('link', { name: 'Past Activity' })).not.toBeInTheDocument();
  });

  it('defaults a group to open when the current route lives inside it', () => {
    // The sheet must never open showing a collapsed section that holds the
    // page the user is already on.
    mocks.pathname = '/history/archive';
    renderSheet();

    const toggle = screen.getByRole('button', { name: 'Toggle History submenu' });

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Archive' })).toHaveAttribute('aria-current', 'page');
  });

  it('hides Bills & Payments while the feature flag is off', () => {
    mocks.billsEnabled = false;
    renderSheet();

    expect(
      screen.queryByRole('button', { name: 'Toggle Bills & Payments submenu' }),
    ).not.toBeInTheDocument();
  });

  it('shows Bills & Payments with its submenu while the feature flag is on', async () => {
    mocks.billsEnabled = true;
    renderSheet();

    const toggle = screen.getByRole('button', { name: 'Toggle Bills & Payments submenu' });

    expect(toggle).toBeInTheDocument();

    await userEvent.click(toggle);

    expect(screen.getByRole('link', { name: 'Pay a Bill' })).toBeInTheDocument();
  });

  it('hides the Admin entry from non-admins', () => {
    mocks.isAdmin = false;
    renderSheet();

    expect(screen.queryByRole('link', { name: /Admin/ })).not.toBeInTheDocument();
  });

  it('shows the Admin entry to admins', () => {
    mocks.isAdmin = true;
    renderSheet();

    expect(screen.getByRole('link', { name: /Admin/ })).toBeInTheDocument();
  });

  it('marks the active row with aria-current', () => {
    mocks.pathname = '/settings';
    renderSheet();

    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
  });

  it('always offers the account and support links', () => {
    renderSheet();

    expect(screen.getByRole('link', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Help' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Upgrade Plan' })).toBeInTheDocument();
  });

  it('returns to the route the user came from when upgrading', () => {
    mocks.pathname = '/settings';
    renderSheet();

    expect(screen.getByRole('link', { name: 'Upgrade Plan' })).toHaveAttribute(
      'href',
      '/plans?from=%2Fsettings',
    );
  });

  it('closes the sheet after a navigation so it does not sit over the new page', async () => {
    const onClose = vi.fn();
    render(<MoreSheet open onClose={onClose} />);

    await userEvent.click(screen.getByRole('link', { name: 'Settings' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('signs out and redirects to login', async () => {
    renderSheet();

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));

    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(mocks.push).toHaveBeenCalledWith('/login');
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it('still redirects when signOut rejects, so a failed sign-out cannot strand the user', async () => {
    mocks.signOut.mockRejectedValueOnce(new Error('network down'));
    renderSheet();

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));

    expect(mocks.push).toHaveBeenCalledWith('/login');
  });

  it('surfaces the deployed build SHA for support diagnostics', () => {
    renderSheet();

    // The stale-production investigation needed a way to tell which commit a
    // served build came from, so the marker is user-visible on purpose.
    expect(screen.getByText(/^build /)).toBeInTheDocument();
  });
});
