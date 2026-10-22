import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SubscriptionDetailModal from '@/components/subscriptions/subscription-detail-modal';
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
  provider_url: 'https://spotify.com',
  notes: null,
  account_links: [
    { id: 'link-1', label: 'Personal', url: 'https://spotify.com/personal', email: '' },
    { id: 'link-2', label: 'Family', url: 'https://spotify.com/family', email: '' },
  ],
  receipts: null,
  is_synced: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('detail modal with two accounts', () => {
  it('offers both accounts and shows the selected one', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(
      <SubscriptionDetailModal
        subscription={twoAccounts}
        isOpen
        onClose={vi.fn()}
        onEdit={onEdit}
        onDeleteRequest={vi.fn()}
      />
    );

    // The small chooser lists every account on the subscription.
    const chooser = await screen.findByTestId('account-chooser');
    expect(chooser).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Personal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Family' })).toBeInTheDocument();

    // The first one is what the sheet opens on.
    expect(screen.getByText('Account Type')).toBeInTheDocument();
    expect(screen.getByTestId('account-type-value')).toHaveTextContent('Personal');

    // Choosing the other one shows that one instead.
    await user.click(screen.getByRole('button', { name: 'Family' }));
    await waitFor(() =>
      expect(screen.getByTestId('account-type-value')).toHaveTextContent('Family')
    );

    // And the edit action opens on the account that was in view.
    await user.click(screen.getByRole('button', { name: 'Edit Subscription' }));
    expect(onEdit).toHaveBeenCalledWith(twoAccounts, 'link-2');
  });

  it('does not offer a chooser when there is only one account', async () => {
    render(
      <SubscriptionDetailModal
        subscription={{ ...twoAccounts, account_links: [twoAccounts.account_links![0]] }}
        isOpen
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDeleteRequest={vi.fn()}
      />
    );

    expect(screen.queryByTestId('account-chooser')).not.toBeInTheDocument();
    expect(screen.getByText('Account Type')).toBeInTheDocument();
  });
});
