import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SubscriptionTable from '@/components/subscriptions/subscription-table';
import type { SubscriptionRow } from '@/lib/services/subscription-service';

vi.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }),
}));
vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }));
vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

const base: SubscriptionRow = {
  id: 'sub-1',
  user_id: 'u1',
  name: 'Spotify',
  price: 1600,
  currency: 'NGN',
  billing_cycle: 'monthly',
  category: 'Streaming',
  status: 'active',
  start_date: '2026-01-01',
  end_date: null,
  next_billing_date: '2026-12-24',
  payment_method: null,
  provider_url: null,
  notes: null,
  account_links: null,
  receipts: null,
  is_synced: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const twoAccounts: SubscriptionRow = {
  ...base,
  account_links: [
    { id: 'link-1', label: 'Personal', url: '', email: '' },
    { id: 'link-2', label: 'Family', url: '', email: '' },
  ],
};

describe('subscription list with more than one account', () => {
  it('shows a dash for the plan, category, amount and date', () => {
    render(
      <SubscriptionTable
        subscriptions={[twoAccounts]}
        highlightedSubId={null}
        onSelectSubscription={vi.fn()}
        onEdit={vi.fn()}
        onDeleteRequest={vi.fn()}
        onArchiveRequest={vi.fn()}
        onPaymentReminderRequest={vi.fn()}
      />
    );

    const row = screen.getByText('Spotify').closest('tr')!;
    const cells = [...row.querySelectorAll('td')].map((td) => td.textContent?.trim());

    // Provider, Plan, Category, Amount, Next Billing, Actions.
    expect(cells[0]).toContain('Spotify');
    expect(cells[1]).toBe('-');
    expect(cells[2]).toBe('-');
    expect(cells[3]).toBe('-');
    expect(cells[4]).toBe('-');
  });

  it('shows the real values for a subscription with one account', () => {
    render(
      <SubscriptionTable
        subscriptions={[{ ...base, account_links: [twoAccounts.account_links![0]] }]}
        highlightedSubId={null}
        onSelectSubscription={vi.fn()}
        onEdit={vi.fn()}
        onDeleteRequest={vi.fn()}
        onArchiveRequest={vi.fn()}
        onPaymentReminderRequest={vi.fn()}
      />
    );

    const row = screen.getByText('Spotify').closest('tr')!;
    const cells = [...row.querySelectorAll('td')].map((td) => td.textContent?.trim());

    expect(cells[2]).toBe('Streaming');
    expect(cells[3]).toContain('1,600');
    expect(cells[4]).not.toBe('-');
  });
});
