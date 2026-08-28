import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SubscriptionModal from '@/components/subscriptions/subscription-modal';
import type { SubscriptionRow } from '@/lib/services/subscription-service';

const mocks = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}));

function makeSubscription(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
  return {
    id: 'sub_1',
    user_id: 'user_1',
    name: 'Netflix',
    price: 15.99,
    currency: 'USD',
    billing_cycle: 'monthly',
    category: 'Streaming',
    status: 'active',
    start_date: '2026-01-01',
    end_date: null,
    next_billing_date: '2026-09-28',
    payment_method: null,
    provider_url: null,
    notes: null,
    account_links: null,
    receipts: null,
    is_synced: false,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderOpen(initialData?: SubscriptionRow | null) {
  const onClose = vi.fn();
  const onSave = vi.fn(async () => {});
  const view = render(
    <SubscriptionModal isOpen={false} onClose={onClose} onSave={onSave} initialData={initialData} />
  );
  view.rerender(<SubscriptionModal isOpen onClose={onClose} onSave={onSave} initialData={initialData} />);
  return { onClose, onSave, container: view.container };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SubscriptionModal', () => {
  it('renders create mode with empty fields and a disabled submit button', () => {
    const { onSave } = renderOpen();

    expect(screen.getByRole('heading', { name: 'Add New Subscription' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Netflix, Spotify, GitHub Pro')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('15.99')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Subscription' })).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('calls onSave with the entered values when submitting create mode', async () => {
    const user = userEvent.setup();
    const { onSave } = renderOpen();

    await user.type(screen.getByPlaceholderText('e.g. Netflix, Spotify, GitHub Pro'), 'Netflix');
    await user.type(screen.getByPlaceholderText('15.99'), '15.99');
    await user.click(screen.getByRole('button', { name: 'Create Subscription' }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Netflix',
          price: 15.99,
          currency: 'USD',
          billing_cycle: 'monthly',
          category: 'Streaming',
          status: 'active',
          next_billing_date: expect.any(String),
          start_date: null,
          end_date: null,
          payment_method: null,
          provider_url: null,
          account_links: [],
        }),
        undefined
      )
    );
    expect(mocks.toast.success).toHaveBeenCalledWith('Added "Netflix" subscription!', 'Subscription Created');
  });

  it('does not call onSave when required fields are empty', async () => {
    const user = userEvent.setup();
    const { onSave } = renderOpen();

    await user.click(screen.getByRole('button', { name: 'Create Subscription' }));

    expect(onSave).not.toHaveBeenCalled();
  });

  it('prefills edit mode and calls onSave with the subscription id', async () => {
    const user = userEvent.setup();
    const initialData = makeSubscription();
    const { onSave } = renderOpen(initialData);

    expect(screen.getByRole('heading', { name: 'Edit Subscription' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Netflix')).toBeInTheDocument();
    expect(screen.getByDisplayValue('15.99')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Update Subscription' }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Netflix', price: 15.99, currency: 'USD' }),
        'sub_1'
      )
    );
    expect(mocks.toast.success).toHaveBeenCalledWith('Updated "Netflix" successfully.', 'Subscription Updated');
  });
});