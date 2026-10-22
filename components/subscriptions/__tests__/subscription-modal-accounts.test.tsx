import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SubscriptionModal from '@/components/subscriptions/subscription-modal';
import type { SubscriptionRow } from '@/lib/services/subscription-service';

vi.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }),
}));
vi.mock('@/lib/contexts/user-settings-context', () => ({
  usePlan: () => ({ planTier: 'plus', isPlus: true }),
}));
vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }));

const rowWithTwoAccounts: SubscriptionRow = {
  id: 'sub_1',
  user_id: 'u1',
  name: 'Spotify',
  price: 2600,
  currency: 'NGN',
  billing_cycle: 'monthly',
  category: 'Streaming',
  status: 'active',
  start_date: '2026-09-13',
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
      billing_cycle: 'monthly',
      category: 'Streaming',
      status: 'active',
      start_date: '2026-09-13',
      next_billing_date: '2026-11-16',
    },
    {
      id: 'link-2',
      label: 'Work',
      url: '',
      email: '',
    },
  ],
  receipts: null,
  is_synced: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('editing a subscription with two accounts', () => {
  it('shows each account its own amount and date, and leaves the unknown one empty', async () => {
    await renderOpen(rowWithTwoAccounts);
    console.log('account1 amount:', (screen.getByLabelText('Amount for account 1') as HTMLInputElement).value);
    console.log('account2 amount:', (screen.getByLabelText('Amount for account 2') as HTMLInputElement).value);
    console.log('account2 date:', (screen.getByLabelText('Renewal date for account 2') as HTMLInputElement).value);

    // The personal account carries its own details.
    expect(screen.getByLabelText('Amount for account 1')).toHaveValue(1600);
    expect(screen.getByLabelText('Renewal date for account 1')).toHaveValue('2026-11-16');

    // The work account has none yet, so its boxes are empty rather than
    // showing the other account's details. A number input with nothing in it
    // reports its value as null.
    expect(screen.getByLabelText('Amount for account 2')).toHaveValue(null);
    expect(screen.getByLabelText('Renewal date for account 2')).toHaveValue('');
  });

  it('keeps the subscription total and the renewal date when the work account is still empty', async () => {
    const user = userEvent.setup();
    const { onSave } = await renderOpen(rowWithTwoAccounts);

    await user.click(screen.getByRole('button', { name: 'Update Subscription' }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const payload = onSave.mock.calls[0][0];
    // The total the user typed is kept: an account with no amount of its own
    // must not quietly take money out of the subscription.
    expect(payload.price).toBe(2600);
    // The renewal date is the soonest of the accounts that have one.
    expect(payload.next_billing_date).toBe('2026-11-16');
  });

  it('keeps each account its own details when the other one is edited', async () => {
    const user = userEvent.setup();
    const { onSave } = await renderOpen(rowWithTwoAccounts);

    // Edit the work account.
    await user.type(screen.getByLabelText('Amount for account 2'), '1000');
    fireEvent.change(screen.getByLabelText('Renewal date for account 2'), {
      target: { value: '2026-11-22' },
    });

    await user.click(screen.getByRole('button', { name: 'Update Subscription' }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const links = onSave.mock.calls[0][0].account_links as {
      label: string;
      price?: number;
      next_billing_date?: string;
    }[];

    // The personal account is untouched, and the work account has what was
    // typed into it. The main fields are the subscription's, and they are not
    // copied onto either account.
    expect(links[0]).toMatchObject({
      label: 'Personal',
      price: 1600,
      next_billing_date: '2026-11-16',
    });
    expect(links[1]).toMatchObject({
      label: 'Work',
      price: 1000,
      next_billing_date: '2026-11-22',
    });
  });

  it('adds up the accounts once each of them says what it costs', async () => {
    const user = userEvent.setup();
    const { onSave } = await renderOpen(rowWithTwoAccounts);

    const workAmount = screen.getByLabelText('Amount for account 2');
    await user.type(workAmount, '1000');
    fireEvent.change(screen.getByLabelText('Renewal date for account 2'), {
      target: { value: '2026-11-22' },
    });

    await user.click(screen.getByRole('button', { name: 'Update Subscription' }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const payload = onSave.mock.calls[0][0];
    expect(payload.price).toBe(2600);
    expect(payload.next_billing_date).toBe('2026-11-16');
    const links = payload.account_links as { label: string; price?: number }[];
    expect(links[1]).toMatchObject({ label: 'Work', price: 1000 });
  });
});

async function renderOpen(initialData: SubscriptionRow) {
  const onSave = vi.fn(async () => 'sub_1');
  const view = render(
    <SubscriptionModal isOpen={false} onClose={vi.fn()} onSave={onSave} initialData={null} />
  );
  view.rerender(
    <SubscriptionModal
      isOpen
      onClose={vi.fn()}
      onSave={onSave}
      initialData={initialData}
      existingSubscriptions={[initialData]}
    />
  );
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  return { onSave };
}