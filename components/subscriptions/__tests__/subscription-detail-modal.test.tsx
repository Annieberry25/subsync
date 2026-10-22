import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SubscriptionDetailModal from '@/components/subscriptions/subscription-detail-modal';
import AccountChooserModal from '@/components/subscriptions/account-chooser-modal';
import type { SubscriptionRow } from '@/lib/services/subscription-service';

vi.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }),
}));
vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }));

const twoAccounts: SubscriptionRow = {
  id: 'sub_two',
  user_id: 'u1',
  name: 'Spotify',
  price: 1600,
  currency: 'NGN',
  billing_cycle: 'monthly',
  category: 'Streaming',
  status: 'active',
  start_date: '2026-01-01',
  end_date: null,
  next_billing_date: '2026-11-16',
  payment_method: null,
  provider_url: null,
  notes: null,
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
      url: 'https://spotify.com/work',
      email: '',
      price: 2400,
      currency: 'NGN',
      category: 'Software',
      billing_cycle: 'yearly',
      next_billing_date: '2027-02-01',
    },
  ],
  receipts: null,
  is_synced: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('the chooser between accounts', () => {
  it('lists the accounts with their own details and hands the chosen one back', async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    render(
      <AccountChooserModal
        subscription={twoAccounts}
        isOpen
        onClose={vi.fn()}
        onChoose={onChoose}
      />
    );

    // Both accounts, each with its own amount. The row is the account, its
    // type and what it costs — nothing else.
    expect(screen.getByText('Personal')).toBeInTheDocument();
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText(/1,600/)).toBeInTheDocument();
    expect(screen.getByText(/2,400/)).toBeInTheDocument();
    expect(screen.getByText('Account 1')).toBeInTheDocument();
    expect(screen.getByText('Account 2')).toBeInTheDocument();

    await user.click(screen.getByText('Work'));

    expect(onChoose).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'link-2', label: 'Work', price: 2400 })
    );
  });
});

describe('the detail sheet of one account', () => {
  it('shows the details of the account it was opened on', () => {
    render(
      <SubscriptionDetailModal
        subscription={twoAccounts}
        isOpen
        accountId="link-2"
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDeleteRequest={vi.fn()}
      />
    );

    // The work account's own amount, cycle, category and date.
    expect(screen.getByTestId('account-type-value')).toHaveTextContent('Work');
    expect(screen.getAllByText(/2,400/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('February 1, 2027').length).toBeGreaterThan(0);
    expect(screen.getByText('Software')).toBeInTheDocument();
  });

  it('shows the other account when that is the one it was opened on', () => {
    render(
      <SubscriptionDetailModal
        subscription={twoAccounts}
        isOpen
        accountId="link-1"
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDeleteRequest={vi.fn()}
      />
    );

    expect(screen.getByTestId('account-type-value')).toHaveTextContent('Personal');
    expect(screen.getAllByText(/1,600/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('November 16, 2026').length).toBeGreaterThan(0);
  });

  it('shows nothing for an account that was never given details of its own', () => {
    const withoutOwnValues: SubscriptionRow = {
      ...twoAccounts,
      account_links: [{ id: 'link-1', label: 'Personal', url: '', email: '' }],
    };

    render(
      <SubscriptionDetailModal
        subscription={withoutOwnValues}
        isOpen
        accountId="link-1"
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDeleteRequest={vi.fn()}
      />
    );

    // The type is the account's own; the amount and the date are not worked
    // out from the subscription, because a figure nobody entered is a figure
    // nobody can check.
    expect(screen.getByTestId('account-type-value')).toHaveTextContent('Personal');
    expect(screen.queryByText(/1,600/)).not.toBeInTheDocument();
    expect(screen.queryByText('November 16, 2026')).not.toBeInTheDocument();
  });
});
