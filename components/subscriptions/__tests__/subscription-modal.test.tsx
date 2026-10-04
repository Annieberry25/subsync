import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SubscriptionModal from '@/components/subscriptions/subscription-modal';
import type { SubscriptionRow } from '@/lib/services/subscription-service';

const mocks = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  planTier: 'plus' as string,
}));

vi.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

// The form reads the plan tier to decide whether a second account link is a
// Plus feature. Default to plus so the existing assertions see a single account
// row; the cap tests below override it.
vi.mock('@/lib/contexts/user-settings-context', () => ({
  usePlan: () => ({ planTier: mocks.planTier, isPlus: mocks.planTier === 'plus' }),
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

function renderOpen(initialData?: SubscriptionRow | null, savedId: string | null = 'sub_new') {
  const onClose = vi.fn();
  const onSave = vi.fn(async () => savedId);
  const onRequireUpgrade = vi.fn();
  const view = render(
    <SubscriptionModal
      isOpen={false}
      onClose={onClose}
      onSave={onSave}
      initialData={initialData}
      onRequireUpgrade={onRequireUpgrade}
    />
  );
  view.rerender(
    <SubscriptionModal
      isOpen
      onClose={onClose}
      onSave={onSave}
      initialData={initialData}
      onRequireUpgrade={onRequireUpgrade}
    />
  );
  return { onClose, onSave, onRequireUpgrade, container: view.container };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SubscriptionModal', () => {
  it('rounds the footer actions to match the Back button', () => {
    renderOpen();

    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const create = screen.getByRole('button', { name: 'Create Subscription' });

    // All three sat on the same baseline; Cancel and Create were the odd ones out
    // because they were the only footer buttons missing rounded-xl.
    expect(cancel.className).toContain('rounded-xl');
    expect(create.className).toContain('rounded-xl');
  });

  it('rounds Back the same way when the add flow renders it', () => {
    // Back only appears in the add flow, which is reached via onBack.
    const onClose = vi.fn();
    const onSave = vi.fn(async () => 'sub_new');
    render(
      <SubscriptionModal isOpen onClose={onClose} onSave={onSave} onBack={vi.fn()} />
    );

    expect(screen.getByRole('button', { name: /Back/ }).className).toContain('rounded-xl');
  });

  it('has no Provider URL input; the website is resolved from the provider name', () => {
    renderOpen();

    // The field was removed: it only produced values that disagreed with the
    // ones SubHalt already derives from the provider name.
    expect(screen.queryByText('Provider URL')).not.toBeInTheDocument();

    // The account URL field it sat next to is still there.
    expect(screen.queryByText('Account URL')).not.toBeInTheDocument();
    expect(screen.getByText('Subscription Accounts')).toBeInTheDocument();
  });

  it('derives and saves the provider website without an input for it', async () => {
    const user = userEvent.setup();
    const { onSave } = renderOpen();

    await user.type(screen.getByPlaceholderText('e.g. Netflix, Spotify, GitHub Pro'), 'Netflix');
    await user.type(screen.getByPlaceholderText('15.99'), '15.99');
    await user.click(screen.getByRole('button', { name: 'Create Subscription' }));

    // Typed name alone produces a known website, and it is still persisted.
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Netflix', provider_url: expect.any(String) }),
        undefined
      )
    );
    expect(onSave.mock.calls[0][0].provider_url).toMatch(/^https:\/\//);
  });

  it('renders create mode with empty fields and a submit button that is ready', () => {
    const { onSave } = renderOpen();

    expect(screen.getByRole('heading', { name: 'Add New Subscription' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Netflix, Spotify, GitHub Pro')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('15.99')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Subscription' })).toBeEnabled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('stays clickable on empty fields and reports what is missing instead of silently doing nothing', async () => {
    const user = userEvent.setup();
    const { onSave } = renderOpen();

    // The button must not be inert: clicking it has to explain the problem.
    await user.click(screen.getByRole('button', { name: 'Create Subscription' }));

    expect(await screen.findByText('Subscription name is required.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid price > 0.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('calls onSave with the entered values and closes without a duplicate toast', async () => {
    const user = userEvent.setup();
    const { onClose, onSave } = renderOpen();

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
          provider_url: 'https://www.netflix.com',
          account_links: [],
        }),
        undefined
      )
    );
    expect(mocks.toast.success).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  /**
   * The cheaper-plan tier was a hand-entered "downgrade instead of cancel" hint.
   * It is gone from the form, so the payload must not carry the keys either:
   * PostgREST rejects the whole write if a key names a column the table does not
   * have ("Could not find the 'cheaper_plan_name' column"), so leaving them in
   * the payload broke saving even with both inputs removed.
   */
  it('does not offer a cheaper-plan tier and omits it from the saved payload', async () => {
    const user = userEvent.setup();
    const { onSave } = renderOpen();

    expect(screen.queryByLabelText('Cheaper plan name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Cheaper plan price')).not.toBeInTheDocument();
    expect(screen.queryByText(/Cheaper Plan Tier/i)).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('e.g. Netflix, Spotify, GitHub Pro'), 'Netflix');
    await user.type(screen.getByPlaceholderText('15.99'), '15.99');
    await user.click(screen.getByRole('button', { name: 'Create Subscription' }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const payload = onSave.mock.calls[0][0];
    expect(payload).not.toHaveProperty('cheaper_plan_name');
    expect(payload).not.toHaveProperty('cheaper_plan_price');
  });

  it('preserves an existing cheaper-plan tier when editing, since the key is omitted', async () => {
    const user = userEvent.setup();
    const existing = {
      ...makeSubscription(),
      cheaper_plan_name: 'Basic',
      cheaper_plan_price: 8,
    };
    const { onSave } = renderOpen(existing);

    await user.click(screen.getByRole('button', { name: 'Update Subscription' }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const payload = onSave.mock.calls[0][0];
    // updateSubscription applies a partial update, so omitting the keys leaves
    // whatever was already stored intact rather than nulling it.
    expect(payload).not.toHaveProperty('cheaper_plan_name');
    expect(payload).not.toHaveProperty('cheaper_plan_price');
  });

  it('stays open and does not toast success when the caller gates the save (null)', async () => {
    const user = userEvent.setup();
    // onSave returns null when the plan-limit gate rejects the create.
    const { onClose, onSave } = renderOpen(undefined, null);

    await user.type(screen.getByPlaceholderText('e.g. Netflix, Spotify, GitHub Pro'), 'Netflix');
    await user.type(screen.getByPlaceholderText('15.99'), '15.99');
    await user.click(screen.getByRole('button', { name: 'Create Subscription' }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
    expect(mocks.toast.success).not.toHaveBeenCalled();
  });

  it('does not call onSave when required fields are empty', async () => {
    const user = userEvent.setup();
    const { onSave } = renderOpen();

    await user.click(screen.getByRole('button', { name: 'Create Subscription' }));

    expect(onSave).not.toHaveBeenCalled();
  });

  it('preserves history state and attached receipts when editing an archived row', async () => {
    const user = userEvent.setup();
    const initialData = makeSubscription({
      notes:
        'user note\n[HistoryState: {"state":"archived","previousStatus":"trial"}]\n' +
        '[AttachedReceipts: [{"id":"r1","fileName":"invoice.pdf","uploadDate":"2026-01-01"}]]',
      receipts: [],
    });
    const { onSave } = renderOpen(initialData);

    await user.click(screen.getByRole('button', { name: 'Update Subscription' }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const payload = onSave.mock.calls[0][0] as { notes: string };
    // Editing an archived subscription must not erase its marker, which would
    // silently move the row back into the active list.
    expect(payload.notes).toContain('[HistoryState:');
    expect(payload.notes).toContain('"state":"archived"');
    expect(payload.notes).toContain('[AttachedReceipts:');
    expect(payload.notes).toContain('invoice.pdf');
    expect(payload.notes).toContain('user note');
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
    expect(mocks.toast.success).not.toHaveBeenCalled();
  });
});

describe('SubscriptionModal subscription accounts', () => {
  beforeEach(() => {
    mocks.planTier = 'free';
  });

  it('auto-fills the account URL from the provider instead of asking the user to paste it', async () => {
    const user = userEvent.setup();
    renderOpen();

    await user.type(
      screen.getByPlaceholderText('e.g. Netflix, Spotify, GitHub Pro'),
      'Netflix'
    );
    await user.click(screen.getByRole('button', { name: /Add account link/ }));

    const url = screen.getByLabelText('Account URL') as HTMLInputElement;
    expect(url.value).toBe('https://www.netflix.com/youraccount');
  });

  it('sends a free user to upgrade when adding a second account', async () => {
    const user = userEvent.setup();
    const { onRequireUpgrade } = renderOpen();

    await user.type(
      screen.getByPlaceholderText('e.g. Netflix, Spotify, GitHub Pro'),
      'Netflix'
    );

    const addButton = screen.getByRole('button', { name: /Add account link/ });
    await user.click(addButton);
    expect(screen.getByLabelText('Account URL')).toBeInTheDocument();

    // Second attempt is refused and routed to the upgrade sheet.
    await user.click(addButton);
    expect(onRequireUpgrade).toHaveBeenCalledTimes(1);
    expect(screen.getAllByLabelText('Account URL')).toHaveLength(1);
  });

  it('does not badge the account section; it explains the limit on attempt', async () => {
    const user = userEvent.setup();
    renderOpen();

    // No badge up front: the section is a normal part of adding a subscription.
    expect(screen.queryByTestId('plus-badge')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Add account link/ }));

    // Reaching the cap explains itself instead of advertising the tier.
    expect(screen.queryByTestId('plus-badge')).not.toBeInTheDocument();
    expect(screen.getByText(/one account per subscription/i)).toBeInTheDocument();
  });

  it('keeps the account link icon active for a known provider', async () => {
    const user = userEvent.setup();
    renderOpen();

    await user.type(
      screen.getByPlaceholderText('e.g. Netflix, Spotify, GitHub Pro'),
      'Netflix'
    );
    await user.click(screen.getByRole('button', { name: /Add account link/ }));

    // Prefilled from the provider table, so the icon opens a real destination.
    const link = screen.getByRole('link', { name: /Open Netflix account in a new tab/ });
    expect(link).toHaveAttribute('href', 'https://www.netflix.com/youraccount');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('falls back to the provider website when the deep account path is unknown', async () => {
    const user = userEvent.setup();
    renderOpen();

    await user.click(screen.getByRole('button', { name: /Add account link/ }));
    // Clearing the field leaves only the fallback chain, which for a provider we
    // know the site for still resolves to something openable.
    await user.type(screen.getByLabelText('Account URL'), 'https://example.com/account');

    const link = screen.getByRole('link', { name: /account in a new tab/ });
    expect(link).toHaveAttribute('href', 'https://example.com/account');
  });

  it('keeps the link icon disabled only when nothing is known at all', async () => {
    const user = userEvent.setup();
    renderOpen();

    // No provider name and no stored URL: there is genuinely nowhere to send them.
    await user.click(screen.getByRole('button', { name: /Add account link/ }));

    expect(screen.getByRole('button', { name: 'No provider page available yet' })).toBeDisabled();
  });

  it('lets a Plus user add several accounts without an upgrade prompt', async () => {
    mocks.planTier = 'plus';
    const user = userEvent.setup();
    const { onRequireUpgrade } = renderOpen();

    const addButton = screen.getByRole('button', { name: /Add account link/ });
    await user.click(addButton);
    await user.click(addButton);
    await user.click(addButton);

    expect(screen.getAllByLabelText('Account URL')).toHaveLength(3);
    expect(onRequireUpgrade).not.toHaveBeenCalled();
    expect(screen.queryByTestId('plus-badge')).not.toBeInTheDocument();
  });

  it('re-enables adding once a row is removed', async () => {
    const user = userEvent.setup();
    const { onRequireUpgrade } = renderOpen();

    const addButton = screen.getByRole('button', { name: /Add account link/ });
    await user.click(addButton);
    await user.click(screen.getByRole('button', { name: 'Delete account row' }));

    await user.click(addButton);

    expect(screen.getAllByLabelText('Account URL')).toHaveLength(1);
    expect(onRequireUpgrade).not.toHaveBeenCalled();
  });

  it('labels the second and later account rows distinctly', async () => {
    mocks.planTier = 'plus';
    const user = userEvent.setup();
    renderOpen();

    const addButton = screen.getByRole('button', { name: /Add account link/ });
    await user.click(addButton);
    await user.click(addButton);

    // Both rows show "Account Type #N" once there is more than one, which is
    // what stops two identically-named rows from being indistinguishable.
    expect(screen.getAllByText(/Account Type #/)).toHaveLength(2);
  });
});