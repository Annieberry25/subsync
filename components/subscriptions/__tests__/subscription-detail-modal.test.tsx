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
      start_date: '2026-10-16',
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
      start_date: '2026-02-01',
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

/**
 * The auto-renewal icon on the detail sheet.
 *
 * It has two states and both are readable: the primary green while
 * auto-renewal is on, grey while it is off. Clicking it flips the flag from
 * the sheet itself, and the auto-renewal information — two rows under the
 * account type, "Auto renewal On" and under it "Auto renewal date" with the
 * day the flag renews the row next — is there while it is on and taken away
 * the moment it is off. The billing renewal line above stays the actual
 * repayment date either way.
 */
describe('the auto-renewal icon on the detail sheet', () => {
  it('shows auto renewal on, and the month after the billing date while it is on', () => {
    render(
      <SubscriptionDetailModal
        subscription={{ ...twoAccounts, auto_renew: true }}
        isOpen
        accountId="link-1"
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onToggleAutoRenew={vi.fn()}
        onDeleteRequest={vi.fn()}
      />
    );

    const icon = screen.getByRole('button', { name: 'Turn auto renewal off' });
    expect(icon.className).toContain('text-[#14B8A6]');

    expect(screen.getByTestId('auto-renew-state')).toHaveTextContent('On');
    // The day the flag carries the repayment to: the billing date plus one
    // cycle, from the account's own date and cycle — not the repayment date,
    // which stays on the Billing renewal row (November 16, 2026).
    expect(screen.getByTestId('auto-renew-date')).toHaveTextContent('December 16, 2026');
    expect(screen.getByText('Billing renewal').nextElementSibling).toHaveTextContent('November 16, 2026');
  });

  it('is grey, with neither auto renewal row, while it is off', () => {
    render(
      <SubscriptionDetailModal
        subscription={{ ...twoAccounts, auto_renew: false }}
        isOpen
        accountId="link-1"
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onToggleAutoRenew={vi.fn()}
        onDeleteRequest={vi.fn()}
      />
    );

    const icon = screen.getByRole('button', { name: 'Turn auto renewal on' });
    expect(icon.className).toContain('text-[#94A3B8]');
    // The whole pair disappears with the flag: an extinct auto-renewal
    // leaves nothing that looks like a date behind.
    expect(screen.queryByTestId('auto-renew-state')).not.toBeInTheDocument();
    expect(screen.queryByTestId('auto-renew-date')).not.toBeInTheDocument();
  });

  it('measures the auto renewal date the cycle in view is billed in', () => {
    render(
      <SubscriptionDetailModal
        subscription={{ ...twoAccounts, auto_renew: true }}
        isOpen
        accountId="link-2"
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onToggleAutoRenew={vi.fn()}
        onDeleteRequest={vi.fn()}
      />
    );

    expect(screen.getByTestId('auto-renew-date')).toHaveTextContent('February 1, 2028');
  });

  it('still shows the auto renewal date when the account never carried one of its own', () => {
    // Rows created outside the form (Gmail, receipt import) often have no
    // account-level values at all. The repayment is automatic anyway — one
    // cycle after the start date on the row — and the auto renewal date is
    // one cycle after the repayment: made on 23/10/2026, November 23, 2026
    // is the repayment and December 23, 2026 is the auto renewal, whatever
    // day the stored record has been carrying.
    const withoutAccountValues: SubscriptionRow = {
      ...twoAccounts,
      start_date: '2026-10-23',
      next_billing_date: '2026-11-23',
      auto_renew: true,
      account_links: [{ id: 'link-1', label: 'Personal', url: '', email: '' }],
    };

    render(
      <SubscriptionDetailModal
        subscription={withoutAccountValues}
        isOpen
        accountId="link-1"
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onToggleAutoRenew={vi.fn()}
        onDeleteRequest={vi.fn()}
      />
    );

    expect(screen.getByTestId('auto-renew-state')).toHaveTextContent('On');
    expect(screen.getByText('Billing renewal').nextElementSibling).toHaveTextContent('November 23, 2026');
    expect(screen.getByTestId('auto-renew-date')).toHaveTextContent('December 23, 2026');
  });

  it('toggles in place: the sheet stays open and hands the flipped flag back', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onToggleAutoRenew = vi.fn();

    render(
      <SubscriptionDetailModal
        subscription={{ ...twoAccounts, auto_renew: true }}
        isOpen
        accountId="link-1"
        onClose={onClose}
        onEdit={vi.fn()}
        onToggleAutoRenew={onToggleAutoRenew}
        onDeleteRequest={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Turn auto renewal off' }));

    expect(onToggleAutoRenew).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sub_two' }),
      false,
      'link-1'
    );
    // Turning it off happens on the sheet the user is looking at.
    expect(onClose).not.toHaveBeenCalled();
  });
});
