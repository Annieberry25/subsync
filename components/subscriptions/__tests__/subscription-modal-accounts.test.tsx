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
  start_date: '2026-10-16',
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
      start_date: '2026-10-16',
      status: 'active',
    },
    {
      id: 'link-2',
      label: 'Work',
      url: 'https://spotify.com/work',
      email: '',
      price: 2600,
      currency: 'NGN',
      category: 'Streaming',
      billing_cycle: 'monthly',
      next_billing_date: '2026-11-22',
      start_date: '2026-10-22',
      status: 'active',
    },
  ],
  receipts: null,
  is_synced: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

async function renderOpen(initialData: SubscriptionRow, focusAccountId?: string) {
  const onSave = vi.fn(async () => 'sub_1');
  const view = render(
    <SubscriptionModal
      isOpen={false}
      onClose={vi.fn()}
      onSave={onSave}
      initialData={null}
      focusAccountId={focusAccountId}
    />
  );
  view.rerender(
    <SubscriptionModal
      isOpen
      onClose={vi.fn()}
      onSave={onSave}
      initialData={initialData}
      existingSubscriptions={[initialData]}
      focusAccountId={focusAccountId}
    />
  );
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  return { onSave };
}

describe('a subscription with two accounts', () => {
  it('opens on the account in view, with that account own details in the form', async () => {
    await renderOpen(rowWithTwoAccounts, 'link-2');

    // The work account: its type, its amount and its date.
    expect(screen.getByLabelText('Account Type')).toHaveValue('Work');
    expect(screen.getByPlaceholderText('15.99')).toHaveValue(2600);
    expect(screen.getByLabelText('Next Billing Date')).toHaveValue('2026-11-22');
    expect(screen.getByLabelText('Start Date')).toHaveValue('2026-10-22');

    // And the link box is that account's link.
    expect(screen.getByLabelText('Account URL')).toHaveValue('https://spotify.com/work');
  });

  it('opens on the first account when no account was chosen', async () => {
    await renderOpen(rowWithTwoAccounts);

    expect(screen.getByLabelText('Account Type')).toHaveValue('Personal');
    expect(screen.getByPlaceholderText('15.99')).toHaveValue(1600);
    expect(screen.getByLabelText('Account URL')).toHaveValue('https://spotify.com/personal');
  });

  it('saves the account in view without touching the other one', async () => {
    const user = userEvent.setup();
    const { onSave } = await renderOpen(rowWithTwoAccounts, 'link-2');

    await user.clear(screen.getByPlaceholderText('15.99'));
    await user.type(screen.getByPlaceholderText('15.99'), '3000');
    fireEvent.change(screen.getByLabelText('Next Billing Date'), {
      target: { value: '2026-12-01' },
    });

    await user.click(screen.getByRole('button', { name: 'Update Subscription' }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const payload = onSave.mock.calls[0][0];
    const links = payload.account_links as {
      label: string;
      price?: number;
      next_billing_date?: string;
    }[];

    // The work account has what was typed into it, and the personal one is
    // untouched.
    expect(links[1]).toMatchObject({
      label: 'Work',
      price: 3000,
      next_billing_date: '2026-12-01',
    });
    expect(links[0]).toMatchObject({ label: 'Personal', price: 1600 });
  });

  it('adds the accounts up for the subscription', async () => {
    const { onSave } = await renderOpen(rowWithTwoAccounts, 'link-2');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Update Subscription' }));

    await waitFor(() => expect(onSave).toHaveBeenCalled(), { timeout: 3000 }).catch(() => {
      const errors = [...document.querySelectorAll('[id$="-error"]')].map((n) => n.textContent);
      console.log('ERRORS:', JSON.stringify(errors));
      console.log('price:', (screen.getByPlaceholderText('15.99') as HTMLInputElement).value);
      console.log('type:', (screen.getByLabelText('Account Type') as HTMLSelectElement).value);
      console.log('start:', (screen.getByLabelText('Start Date') as HTMLInputElement).value);
      console.log('renew:', (screen.getByLabelText('Next Billing Date') as HTMLInputElement).value);
      console.log('currency:', (screen.getByLabelText('Currency') as HTMLSelectElement).value);
      console.log('cycle:', (screen.getByLabelText('Cycle') as HTMLSelectElement).value);
      console.log('category:', (screen.getByLabelText('Category') as HTMLSelectElement).value);
      console.log('status:', (screen.getByLabelText('Status') as HTMLSelectElement).value);
      console.log('name:', (screen.getByPlaceholderText('e.g. Netflix, Spotify, GitHub Pro') as HTMLInputElement).value);
    });
    const payload = onSave.mock.calls[0][0];
    // 1,600 personal and 2,600 work.
    expect(payload.price).toBe(4200);
    // The soonest of them is the 16th.
    expect(payload.next_billing_date).toBe('2026-11-16');
  });

  it('keeps the account that is already there when another is added', async () => {
    const user = userEvent.setup();
    const { onSave } = await renderOpen(rowWithTwoAccounts, 'link-2');

    await user.click(screen.getByRole('button', { name: 'Add account link' }));
    await user.click(screen.getByRole('button', { name: 'Update Subscription' }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const links = onSave.mock.calls[0][0].account_links as { id: string }[];
    expect(links).toHaveLength(3);
    expect(links[0].id).toBe('link-1');
    expect(links[1].id).toBe('link-2');
  });

  it('saves the renewal date in the renewal date, not in the start date', async () => {
    const user = userEvent.setup();
    const { onSave } = await renderOpen(rowWithTwoAccounts, 'link-2');

    // Regression: the renewal date input once wrote to the start date, so
    // changing when the subscription renews moved when it started instead and
    // nothing the user changed about the renewal was kept.
    fireEvent.change(screen.getByLabelText('Next Billing Date'), {
      target: { value: '2026-12-20' },
    });

    expect(screen.getByLabelText('Start Date')).toHaveValue('2026-10-22');

    await user.click(screen.getByRole('button', { name: 'Update Subscription' }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const payload = onSave.mock.calls[0][0];
    const links = payload.account_links as { label: string; next_billing_date?: string }[];

    // The account in view has the date that was typed into it.
    expect(links[1]).toMatchObject({ label: 'Work', next_billing_date: '2026-12-20' });
    // And the subscription renews on the soonest of its accounts.
    expect(payload.next_billing_date).toBe('2026-11-16');
    expect(payload.start_date).toBe('2026-10-16');
  });
});
