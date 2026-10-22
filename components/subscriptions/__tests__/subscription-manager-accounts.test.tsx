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
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  }),
}));

vi.mock('@/lib/contexts/user-settings-context', async (orig) => {
  const actual = await orig<typeof import('@/lib/contexts/user-settings-context')>();
  return {
    ...actual,
    usePlan: () => ({ planTier: 'plus', isPlus: true }),
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

const rowWithTwoAccounts = {
  id: 'sub-1',
  name: 'Spotify',
  price: 2600,
  currency: 'NGN',
  billing_cycle: 'monthly',
  category: 'Streaming',
  status: 'active',
  start_date: '2026-09-13',
  end_date: null,
  next_billing_date: '2026-11-16',
  notes: null,
  provider_url: null,
  payment_method: null,
  account_links: [
    {
      id: 'link-1',
      label: 'Personal',
      url: 'https://spotify.com/personal',
      email: '',
      price: 1600,
      currency: 'NGN',
      category: 'Streaming',
      billing_cycle: 'monthly',
      next_billing_date: '2026-11-16',
    },
    {
      id: 'link-2',
      label: 'Work',
      url: '',
      email: '',
      price: 1000,
      currency: 'NGN',
      category: 'Streaming',
      billing_cycle: 'monthly',
      next_billing_date: '2026-11-16',
    },
  ],
  receipts: null,
  is_synced: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('editing an account through the real path', () => {
  beforeEach(() => {
    mockSubscriptions.value = [rowWithTwoAccounts];
    mockSearchParams.value = new URLSearchParams();
    mockRouter.push.mockReset();
    mockRouter.replace.mockReset();
    mockUpdateSubscription.mockClear();
    mockCreateSubscription.mockClear();
  });

  it('saves what was typed into the second account', async () => {
    const user = userEvent.setup();
    render(<SubscriptionManager />);

    // Click the subscription: the chooser opens because it has two accounts.
    await user.click(await screen.findByText('Spotify'));
    await user.click(await screen.findByRole('button', { name: /Personal/ }));

    // The detail sheet, then the form.
    await user.click(await screen.findByRole('button', { name: 'Edit Subscription' }));

    // Change the second account's amount and date.
    const amount = await screen.findByLabelText('Amount for account 2');
    await user.clear(amount);
    await user.type(amount, '2500');
    fireEvent.change(screen.getByLabelText('Renewal date for account 2'), {
      target: { value: '2026-12-01' },
    });

    await user.click(screen.getByRole('button', { name: 'Update Subscription' }));

    await waitFor(() => expect(mockUpdateSubscription).toHaveBeenCalledTimes(1));
    const payload = mockUpdateSubscription.mock.calls[0][1];
    const links = payload.account_links as {
      label: string;
      price?: number;
      next_billing_date?: string;
    }[];

    // The second account has what was typed into it, and the first is untouched.
    expect(links[1]).toMatchObject({
      label: 'Work',
      price: 2500,
      next_billing_date: '2026-12-01',
    });
    expect(links[0]).toMatchObject({ label: 'Personal', price: 1600 });
  }, 30000);
});
