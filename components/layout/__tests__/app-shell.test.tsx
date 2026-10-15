import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * The shell's chrome decision on `/`, which is both the public homepage signed out
 * and the dashboard signed in.
 *
 * It used to stay bare for the whole loading window, because it decided from
 * `loading || !email` and both are true while the session is being resolved — for
 * a signed-in user too. The dashboard's greeting and stat cards therefore painted
 * into a frameless page, and the sidebar and header arriving a moment later pushed
 * everything down the viewport.
 *
 * Now the chrome is drawn while resolving and only the content is withheld, so
 * nothing can paint into the wrong frame.
 */

const auth = { loading: true, email: '' as string | null };
const pathname = { value: '/' };

vi.mock('next/navigation', () => ({
  usePathname: () => pathname.value,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/components/layout/Sidebar', () => ({
  default: () => <nav aria-label="Sidebar" />,
}));
vi.mock('@/components/layout/Header', () => ({
  default: () => <header data-testid="app-header" />,
}));
vi.mock('@/components/layout/MobileDock', () => ({ default: () => null }));
vi.mock('@/components/layout/ContextualFab', () => ({ default: () => null }));
vi.mock('@/components/ai/ask-subhalt-modal', () => ({
  AskSubHaltModal: () => null,
}));
vi.mock('@/components/ui/toast', () => ({ ToastContainer: () => null }));
vi.mock('@/lib/hooks/use-theme', () => ({ ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('@/lib/hooks/use-toast', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/lib/contexts/inbox-context', () => ({
  InboxProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useInbox: () => ({ unreadCount: 0 }),
}));

const useAuth = vi.fn(() => auth);
vi.mock('@/lib/contexts/user-settings-context', () => ({
  UserSettingsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => useAuth(),
  usePlan: () => ({ planTier: 'free' }),
  useSettings: () => ({ assistantName: 'SubHalt', notificationPreferences: {} }),
}));

import AppShell from '@/components/layout/AppShell';

const DASHBOARD = <div>DASHBOARD CONTENT</div>;

beforeEach(() => {
  pathname.value = '/';
  auth.loading = true;
  auth.email = '';
});

describe('AppShell chrome on /', () => {
  it('withholds the content while the session is resolving, so nothing paints in the wrong frame', () => {
    render(<AppShell>{DASHBOARD}</AppShell>);

    expect(screen.queryByText('DASHBOARD CONTENT')).toBeNull();
    expect(screen.getByTestId('app-header')).toBeInTheDocument();
  });

  it('shows the dashboard in the chrome once the session is known', () => {
    auth.loading = false;
    auth.email = 'user@example.com';

    render(<AppShell>{DASHBOARD}</AppShell>);

    expect(screen.getByText('DASHBOARD CONTENT')).toBeInTheDocument();
    expect(screen.getByTestId('app-header')).toBeInTheDocument();
  });

  it('drops the chrome entirely for a signed-out visitor', () => {
    auth.loading = false;
    auth.email = null;

    render(<AppShell>{DASHBOARD}</AppShell>);

    expect(screen.queryByTestId('app-header')).toBeNull();
    expect(screen.getByText('DASHBOARD CONTENT')).toBeInTheDocument();
  });

  it('never withholds content on an ordinary page', () => {
    pathname.value = '/subscriptions';
    auth.loading = true;
    auth.email = '';

    render(<AppShell>{DASHBOARD}</AppShell>);

    expect(screen.getByText('DASHBOARD CONTENT')).toBeInTheDocument();
    expect(screen.getByTestId('app-header')).toBeInTheDocument();
  });
});
