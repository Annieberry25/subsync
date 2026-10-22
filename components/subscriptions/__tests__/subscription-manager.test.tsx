import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockSubscriptions = vi.hoisted(() => ({ value: [] as unknown[] }));
const mockRouter = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
const mockSearchParams = vi.hoisted(() => ({ value: new URLSearchParams() }));
const mockCreateSubscription = vi.hoisted(() =>
  vi.fn(async () => ({ data: { id: 'sub-new' }, error: null, synced: true }))
);
const mockUpdateSubscription = vi.hoisted(() =>
  vi.fn(async (id: string) => ({ data: { id }, error: null, synced: true }))
);

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams.value,
  useRouter: () => mockRouter,
}));

vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

vi.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => ({
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  }),
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

vi.mock('@/lib/supabase/client', () => {
  /*
   * createClient is what lib/services/reminder-preferences.ts imports. Without it
   * that module threw on every call, the provider never received its preferences,
   * and the warnings buried the reason the table was missing.
   *
   * Built inside the factory because vi.mock is hoisted above the module scope.
   */
  const chainable = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === 'then') return undefined;
        return () => chainable;
      },
    }
  );

  const supabase = {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      getClaims: async () => ({ data: { sub: 'test-user' }, error: null }),
    },
    from: () => chainable,
  };

  return {
    createClient: () => supabase,
    supabase,
    default: supabase,
  };
});

vi.mock('@/lib/services/subscription-service', async (orig) => {
  const actual = await orig<typeof import('@/lib/services/subscription-service')>();
  return {
    ...actual,
    fetchSubscriptions: vi.fn(async () => ({ data: mockSubscriptions.value, error: null })),
    archiveSubscription: vi.fn(async () => {}),
    createSubscription: mockCreateSubscription,
    updateSubscription: mockUpdateSubscription,
  };
});

import SubscriptionManager from '@/components/subscriptions/subscription-manager';

/*
 * Billing dates are relative to today on purpose. Hardcoded dates turn
 * overdue once the calendar passes them, and the manager hides overdue rows
 * from the main list — so the old fixed dates (2026-10) made the table vanish
 * and every test that waits for it time out. The suite now stays valid
 * whenever it runs.
 */
const futureDate = (daysFromNow: number) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
};

const rows = [
  {
    id: 'sub-1',
    name: 'Netflix',
    price: 15.99,
    currency: 'USD',
    billing_cycle: 'monthly',
    category: 'Streaming',
    status: 'active',
    next_billing_date: futureDate(10),
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
    next_billing_date: futureDate(20),
    notes: 'Duo plan',
    provider_url: 'https://spotify.com',
    account_links: [],
  },
];

describe('SubscriptionManager view toggle', () => {
  beforeEach(() => {
    mockSubscriptions.value = rows;
    mockSearchParams.value = new URLSearchParams();
    mockRouter.push.mockReset();
    mockRouter.replace.mockReset();
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

  it('sizes the toggle buttons compactly across breakpoints', () => {
    render(<SubscriptionManager />);
    const btn = screen.getByRole('button', { name: 'Table view' });
    expect(btn.className).toContain('w-9');
    expect(btn.className).toContain('h-9');
    expect(btn.className).toContain('sm:w-8');
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

  /**
   * Overdue rows belong on the dashboard's overdue banner and in the dedicated
   * "Overdue Subscriptions" section on /renewals, not mixed into the main list.
   * The definition matches the one those two already use.
   */
  it('keeps overdue subscriptions off the main list', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const overdueDate = yesterday.toISOString().split('T')[0];

    mockSubscriptions.value = [
      { ...rows[0], id: 'sub-overdue', name: 'Overdue Netflix', next_billing_date: overdueDate },
      { ...rows[0], id: 'sub-current', name: 'Current Netflix', next_billing_date: '2099-01-01' },
    ];

    render(<SubscriptionManager />);

    expect(await screen.findByText('Current Netflix')).toBeInTheDocument();
    expect(screen.queryByText('Overdue Netflix')).not.toBeInTheDocument();
  });
});

/**
 * Adding the same service twice is the mistake people make most: they add
 * Netflix, forget they added it, and add it again. A second row for the same
 * service is not what they meant — a second *account* on the row they already
 * have is — so the save is intercepted and offered back that way.
 */
describe('SubscriptionManager duplicate guard', () => {
  beforeEach(() => {
    mockSubscriptions.value = rows;
    mockSearchParams.value = new URLSearchParams();
    mockRouter.push.mockReset();
    mockRouter.replace.mockReset();
    mockCreateSubscription.mockClear();
  });

  const openManualForm = async (user: ReturnType<typeof userEvent.setup>) => {
    render(<SubscriptionManager />);
    await screen.findByRole('columnheader', { name: 'Provider' });

    await user.click(screen.getByRole('button', { name: 'Add Subscription' }));
    await user.click(await screen.findByRole('button', { name: /Add Manually/ }));
  };

  it('offers another account instead of creating a second row for the same service', async () => {
    const user = userEvent.setup();
    await openManualForm(user);

    await user.type(screen.getByPlaceholderText('e.g. Netflix, Spotify, GitHub Pro'), 'netflix');

    // The form recognises the service and becomes the "add another account"
    // form, with the existing row's values already in it.
    expect(
      await screen.findByRole('heading', { name: 'Add Another Account' })
    ).toBeInTheDocument();
    expect(screen.getByText('Add another Netflix account')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByPlaceholderText('15.99')).toHaveValue(15.99)
    );
  });

  it('saves the extra account onto the subscription already tracked', async () => {
    const user = userEvent.setup();
    await openManualForm(user);

    await user.type(screen.getByPlaceholderText('e.g. Netflix, Spotify, GitHub Pro'), 'Netflix');
    // The form carries an account, so the type of that account is a choice,
    // and so are the two dates.
    await user.selectOptions(screen.getByLabelText('Account Type'), 'Personal');
    fireEvent.change(screen.getByLabelText('Start Date'), {
      target: { value: '2026-01-01' },
    });
    fireEvent.change(screen.getByLabelText('Next Billing Date'), {
      target: { value: '2026-11-19' },
    });

    const submit = screen
      .getAllByRole('button', { name: 'Add Another Account' })
      .find((b) => b.getAttribute('form') === 'subscription-modal-form');
    await user.click(submit!);

    // The row that is already there is updated. Nothing new is created.
    await waitFor(() => expect(mockUpdateSubscription).toHaveBeenCalledTimes(1));
    expect(mockUpdateSubscription.mock.calls[0][0]).toBe('sub-1');
    expect(mockCreateSubscription).not.toHaveBeenCalled();
  }, 20000);

  it('still creates a subscription that is not already tracked', async () => {
    const user = userEvent.setup();
    await openManualForm(user);

    await user.type(screen.getByPlaceholderText('e.g. Netflix, Spotify, GitHub Pro'), 'Disney+');
    await user.type(screen.getByPlaceholderText('15.99'), '9.99');
    // The currency, the cycle, the category and the status are choices, so
    // they have to be made, and the start date is part of the subscription.
    await user.selectOptions(screen.getByLabelText('Currency'), 'USD');
    await user.selectOptions(screen.getByLabelText('Cycle'), 'monthly');
    await user.selectOptions(screen.getByLabelText('Category'), 'Streaming');
    await user.selectOptions(screen.getByLabelText('Status'), 'active');
    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2026-01-01' } });

    const submit = screen
      .getAllByRole('button', { name: 'Add Subscription' })
      .find((b) => b.getAttribute('form') === 'subscription-modal-form');
    await user.click(submit!);

    await waitFor(() => expect(mockCreateSubscription).toHaveBeenCalledTimes(1));
    expect(mockCreateSubscription.mock.calls[0][0]).toMatchObject({ name: 'Disney+' });
  }, 20000);
});

/**
 * The inbox builds `?highlight=<id>&detail=true` links from a stored
 * subscription name, so a link can outlive the row: if the subscription was moved
 * to Deleted in the meantime, the deep link resolved to a deleted row and the
 * normal detail sheet opened. Its actions do not apply there — Edit was rejected
 * by the save path (losing the change with only a generic error) and Move to
 * Deleted re-ran a delete the user had already done.
 */
describe('SubscriptionManager deleted deep link', () => {
  const deletedRow = {
    ...rows[0],
    id: 'sub-deleted',
    name: 'Hulu',
    notes: 'Standard plan [HistoryState: {"state":"deleted","deletedAt":"2026-10-01T00:00:00.000Z"}]',
  };

  beforeEach(() => {
    mockSubscriptions.value = [deletedRow];
    mockRouter.push.mockReset();
    mockRouter.replace.mockReset();
    mockSearchParams.value = new URLSearchParams('highlight=sub-deleted&detail=true');
  });

  it('shows a read-only notice instead of the editable detail sheet', async () => {
    render(<SubscriptionManager />);

    expect(await screen.findByText(/Hulu is in Deleted/)).toBeInTheDocument();
    expect(screen.getByText(/nothing to edit here/i)).toBeInTheDocument();

    // None of the detail sheet's live-subscription actions are offered.
    expect(screen.queryByRole('button', { name: 'Edit Subscription' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Set Reminder' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Move to Deleted/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Restore Subscription/i })).toBeNull();
  });

  it('offers a way out to the active list and to Deleted', async () => {
    const user = userEvent.setup();
    render(<SubscriptionManager />);
    await screen.findByText(/Hulu is in Deleted/);

    await user.click(screen.getByRole('button', { name: 'Go to Deleted' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/history/deleted');

    await user.click(screen.getByRole('button', { name: 'Back to subscriptions' }));
    await waitFor(() => expect(screen.queryByText(/Hulu is in Deleted/)).not.toBeInTheDocument());
  });

  it('still opens the detail sheet for a live row behind the same link', async () => {
    // Same code path, an id that is not in Deleted: guards the fix against
    // swallowing deep links that should still open the detail sheet.
    mockSubscriptions.value = rows;
    mockSearchParams.value = new URLSearchParams('highlight=sub-1&detail=true');

    render(<SubscriptionManager />);

    expect(await screen.findByRole('button', { name: 'Edit Subscription' })).toBeInTheDocument();
    expect(screen.queryByText(/is in Deleted/)).toBeNull();
  });
});
