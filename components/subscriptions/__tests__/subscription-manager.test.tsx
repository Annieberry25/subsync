import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockSubscriptions = vi.hoisted(() => ({ value: [] as unknown[] }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

vi.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// The manager and the modals it mounts read from several context providers
// (settings, inbox, auth). This suite is about the view toggle, so stub the
// hooks rather than mounting the provider tree. Category constants stay real.
vi.mock('@/lib/contexts/user-settings-context', async (orig) => {
  const actual = await orig<typeof import('@/lib/contexts/user-settings-context')>();
  return {
    ...actual,
    usePlan: () => ({ currentPlan: 'plus', maxSubscriptions: 50, isLoading: false }),
    useSettings: () => ({
      timezone: 'UTC',
      notificationPreferences: actual.DEFAULT_NOTIFICATION_PREFERENCES,
      assistantName: 'SubHalt',
      isGmailConnected: false,
      gmailEmail: null,
      billingDetails: null,
      paymentMethods: [],
      billingTransactions: [],
      updateNotificationPreferences: vi.fn(),
      updateAssistantName: vi.fn(),
      setGmailConnection: vi.fn(),
      updateBillingDetails: vi.fn(),
      addPaymentMethod: vi.fn(),
      deletePaymentMethod: vi.fn(),
      setDefaultPaymentMethod: vi.fn(),
      refreshSettings: vi.fn(),
    }),
    useAuth: () => ({
      email: 'user@example.com',
      fullName: 'Test User',
      lastNameChange: null,
      loading: false,
      isAdmin: false,
      updateProfile: vi.fn(),
      reauthenticateAndChangeEmail: vi.fn(),
    }),
    useCategories: () => ({
      customCategories: [],
      allCategories: actual.BUILT_IN_CATEGORIES,
      categoryMetadata: actual.DEFAULT_CATEGORY_META,
      addCategory: vi.fn(),
      updateCategory: vi.fn(),
      deleteCategory: vi.fn(),
      getCategoryMeta: (name: string) => actual.DEFAULT_CATEGORY_META[name],
    }),
  };
});

vi.mock('@/lib/contexts/inbox-context', async (orig) => {
  const actual = await orig<typeof import('@/lib/contexts/inbox-context')>();
  return {
    ...actual,
    useInbox: () => ({
      items: [],
      archivedItems: [],
      allItems: [],
      favouritedItems: [],
      favouritedIds: [],
      unreadCount: 0,
      markAsRead: vi.fn(),
      markAsUnread: vi.fn(),
      markAllAsRead: vi.fn(),
      deleteItem: vi.fn(),
      archiveItem: vi.fn(),
      unarchiveItem: vi.fn(),
      toggleFavourite: vi.fn(),
      addToFavourites: vi.fn(),
    }),
  };
});

vi.mock('@/lib/supabase/client', () => ({
  supabase: { auth: { getUser: vi.fn() }, from: vi.fn(() => ({ select: vi.fn() })) },
  default: { auth: { getUser: vi.fn() }, from: vi.fn(() => ({ select: vi.fn() })) },
}));

vi.mock('@/lib/services/subscription-service', async (orig) => {
  const actual = await orig<typeof import('@/lib/services/subscription-service')>();
  return {
    ...actual,
    fetchSubscriptions: vi.fn(async () => ({ data: mockSubscriptions.value, error: null })),
    archiveSubscription: vi.fn(async () => {}),
  };
});

import SubscriptionManager from '@/components/subscriptions/subscription-manager';

const rows = [
  {
    id: 'sub-1',
    name: 'Netflix',
    price: 15.99,
    currency: 'USD',
    billing_cycle: 'monthly',
    category: 'Streaming',
    status: 'active',
    next_billing_date: '2026-10-14',
    notes: 'Standard plan',
    provider_url: 'https://netflix.com',
    account_links: [],
  },
  {
    id: 'sub-2',
    name: 'Spotify',
    price: 11.99,
    currency: 'USD',
    billing_cycle: 'monthly',
    category: 'Music',
    status: 'active',
    next_billing_date: '2026-10-02',
    notes: 'Duo plan',
    provider_url: 'https://spotify.com',
    account_links: [],
  },
];

describe('SubscriptionManager view toggle', () => {
  beforeEach(() => {
    mockSubscriptions.value = rows;
  });

  it('renders the list/grid toggle without a breakpoint-gated hidden class', async () => {
    // Regression: the toggle was `hidden md:flex` and the table was gated
    // behind isWideViewport, so a phone could never reach the list view.
    const { container } = render(<SubscriptionManager />);

    const group = screen.getByRole('group', { name: 'View mode' });
    expect(group).toBeInTheDocument();
    expect(group.className).not.toContain('hidden');
    expect(screen.getByRole('button', { name: 'Table view' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Grid view' })).toBeInTheDocument();

    // The list itself is available, not just the control.
    expect(await screen.findByRole('columnheader', { name: 'Provider' })).toBeInTheDocument();
    expect(container.querySelector('.table-scroll')).not.toBeNull();
  });

  it('gives the toggle buttons a 44px touch target on small screens', () => {
    render(<SubscriptionManager />);
    const btn = screen.getByRole('button', { name: 'Table view' });
    expect(btn.className).toContain('w-11');
    expect(btn.className).toContain('h-11');
    expect(btn.className).toContain('sm:w-9');
  });

  it('switches between the list and the cards view', async () => {
    const user = userEvent.setup();
    render(<SubscriptionManager />);

    // List view by default.
    expect(await screen.findByRole('columnheader', { name: 'Provider' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Grid view' }));
    await waitFor(() =>
      expect(screen.queryByRole('columnheader', { name: 'Provider' })).not.toBeInTheDocument()
    );

    await user.click(screen.getByRole('button', { name: 'Table view' }));
    expect(await screen.findByRole('columnheader', { name: 'Provider' })).toBeInTheDocument();
  });

  /**
   * Regression: the empty state rendered an "Add Your First Subscription"
   * button, which made three controls open the same modal — that one, the
   * header's "Add Subscription" (desktop only, `hidden lg:inline-flex`), and the
   * contextual FAB in the dock. The empty state is now text only.
   */
  it('offers no competing add button in the empty state', async () => {
    mockSubscriptions.value = [];
    render(<SubscriptionManager />);

    expect(await screen.findByText('No subscriptions added yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add Your First Subscription/i })).toBeNull();

    // The header action and the FAB between them still cover every width.
    expect(screen.getByRole('button', { name: 'Add Subscription' })).toBeInTheDocument();
  });

  it('still offers no add button when filters exclude every row', async () => {
    const user = userEvent.setup();
    render(<SubscriptionManager />);
    await screen.findByRole('columnheader', { name: 'Provider' });

    await user.type(screen.getByPlaceholderText(/search/i), 'zzzznomatch');

    expect(await screen.findByText('No matching subscriptions')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add Your First Subscription/i })).toBeNull();
  });
});
