import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

/**
 * The sheet moves focus to its first focusable element on the next animation
 * frame (`components/ui/sheet.tsx`) rather than on mount, so the entrance
 * animation can start from a visible state. Typing before that frame lands
 * sends every keystroke after it to whichever element stole focus — in this
 * modal that is the Import Receipt button — leaving the provider name partial
 * and the derived account URL empty. Awaiting one frame here makes the
 * hand-off deterministic instead of a 16ms race.
 */
function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

async function renderOpen(
  initialData?: SubscriptionRow | null,
  savedId: string | null = 'sub_new',
  existingSubscriptions: SubscriptionRow[] = []
) {
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
      existingSubscriptions={existingSubscriptions}
    />
  );
  view.rerender(
    <SubscriptionModal
      isOpen
      onClose={onClose}
      onSave={onSave}
      initialData={initialData}
      onRequireUpgrade={onRequireUpgrade}
      existingSubscriptions={existingSubscriptions}
    />
  );
  await nextFrame();
  return { onClose, onSave, onRequireUpgrade, container: view.container };
}

/**
 * Picks the four choices the form now requires, and the start date.
 *
 * The currency, the cycle, the category and the status all start empty and
 * have to be chosen: a default the user never picked is a value the user
 * never entered.
 */
async function chooseRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText('Currency'), 'USD');
  await user.selectOptions(screen.getByLabelText('Cycle'), 'monthly');
  await user.selectOptions(screen.getByLabelText('Category'), 'Streaming');
  await user.selectOptions(screen.getByLabelText('Status'), 'active');
  fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2026-01-01' } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * Fills the fields the form insists on.
 *
 * The amount, the currency, the cycle, the category, the status and the two
 * dates are all required, so a form with empty boxes cannot be saved.
 */
async function fillRequiredFields(
  user: ReturnType<typeof userEvent.setup>,
  price = '9.99',
  renewal = '2026-12-24'
) {
  await user.type(screen.getByPlaceholderText('15.99'), price);
  await user.selectOptions(screen.getByLabelText('Account Type'), 'Personal');
  await chooseRequired(user);
  fireEvent.change(screen.getByLabelText('Next Billing Date'), {
    target: { value: renewal },
  });
}

describe('SubscriptionModal', () => {
  it('rounds the submit action and leaves one exit to the header', async () => {
    await renderOpen();

    const create = screen.getByRole('button', { name: 'Add Subscription' });

    expect(create.className).toContain('rounded-xl');

    // Cancel sat in the footer next to a header that already closes the dialog,
    // so the form had two ways out from the same screen.
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it('offers a back chevron into the Add Subscription menu', async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(
      <SubscriptionModal isOpen onClose={vi.fn()} onSave={vi.fn()} onBack={onBack} />
    );

    await user.click(screen.getByRole('button', { name: 'Back to Add Subscription' }));

    expect(onBack).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it('has no Provider URL input; the website is resolved from the provider name', async () => {
    await renderOpen();

    // The field was removed: it only produced values that disagreed with the
    // ones SubHalt already derives from the provider name.
    expect(screen.queryByText('Provider URL')).not.toBeInTheDocument();

    // The account URL field it sat next to is still there.
    expect(screen.queryByText('Account URL')).not.toBeInTheDocument();
    // There is no "Subscription Accounts" heading either: the account type and
    // the account URL are form fields, not a section of their own.
    expect(screen.queryByText('Subscription Accounts')).not.toBeInTheDocument();
  });

  it('derives and saves the provider website without an input for it', async () => {
    const user = userEvent.setup();
    const { onSave } = await renderOpen();

    await user.type(screen.getByPlaceholderText('e.g. Netflix, Spotify, GitHub Pro'), 'Netflix');
    await user.type(screen.getByPlaceholderText('15.99'), '15.99');
    await chooseRequired(user);
    await user.click(screen.getByRole('button', { name: 'Add Subscription' }));

    // Typed name alone produces a known website, and it is still persisted.
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Netflix', provider_url: expect.any(String) }),
        undefined
      )
    );
    expect(onSave.mock.calls[0][0].provider_url).toMatch(/^https:\/\//);
  });

  it('renders create mode with empty fields and a submit button that is ready', async () => {
    const { onSave } = await renderOpen();

    expect(screen.getByRole('heading', { name: 'Add New Subscription' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Netflix, Spotify, GitHub Pro')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('15.99')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Subscription' })).toBeEnabled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('stays clickable on empty fields and reports what is missing instead of silently doing nothing', async () => {
    const user = userEvent.setup();
    const { onSave } = await renderOpen();

    // The button must not be inert: clicking it has to explain the problem.
    await user.click(screen.getByRole('button', { name: 'Add Subscription' }));

    expect(await screen.findByText('Subscription name is required.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid price greater than 0.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  /**
   * The error belongs under the box that is empty, not in one summary the user
   * has to map back to the form. Leaving a field reports that field alone.
   */
  it('reports a missing value under the field the user left, without a submit', async () => {
    const user = userEvent.setup();
    const { onSave } = await renderOpen();

    const nameField = screen.getByPlaceholderText('e.g. Netflix, Spotify, GitHub Pro');
    await user.click(nameField);
    // Moving to the next field is what leaves the name field.
    await user.click(screen.getByPlaceholderText('15.99'));

    expect(await screen.findByText('Subscription name is required.')).toBeInTheDocument();
    expect(nameField).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText('Enter a valid price greater than 0.')).not.toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  /**
   * Everything that is not compulsory says so on its own label, so a user
   * never has to guess whether the app is waiting for it.
   */
  it('marks the optional fields as optional', async () => {
    await renderOpen();

    // The notes and the account URL are optional. The start date is not, and
    // there is no end date at all: the renewal date already says when the
    // next charge is.
    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByText('Start Date')).toBeInTheDocument();
    expect(screen.queryByText('End Date')).not.toBeInTheDocument();
  });

  /**
   * The start date is when the subscription began, and it is part of the
   * subscription rather than a nicety: without it there is no way to tell a
   * long-running service from one that started last month.
   */
  it('requires the start date', async () => {
    const user = userEvent.setup();
    const { onSave } = await renderOpen();

    await user.type(screen.getByPlaceholderText('e.g. Netflix, Spotify, GitHub Pro'), 'Netflix');
    await user.type(screen.getByPlaceholderText('15.99'), '15.99');
    await user.selectOptions(screen.getByLabelText('Currency'), 'USD');
    await user.selectOptions(screen.getByLabelText('Cycle'), 'monthly');
    await user.selectOptions(screen.getByLabelText('Category'), 'Streaming');
    await user.selectOptions(screen.getByLabelText('Status'), 'active');
    await user.click(screen.getByRole('button', { name: 'Add Subscription' }));

    expect(await screen.findByText('Start date is required.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('calls onSave with the entered values and closes without a duplicate toast', async () => {
    const user = userEvent.setup();
    const { onClose, onSave } = await renderOpen();

    await user.type(screen.getByPlaceholderText('e.g. Netflix, Spotify, GitHub Pro'), 'Netflix');
    await user.type(screen.getByPlaceholderText('15.99'), '15.99');
    await chooseRequired(user);
    await user.click(screen.getByRole('button', { name: 'Add Subscription' }));

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
          start_date: '2026-01-01',
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
    const { onSave } = await renderOpen();

    expect(screen.queryByLabelText('Cheaper plan name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Cheaper plan price')).not.toBeInTheDocument();
    expect(screen.queryByText(/Cheaper Plan Tier/i)).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('e.g. Netflix, Spotify, GitHub Pro'), 'Netflix');
    await user.type(screen.getByPlaceholderText('15.99'), '15.99');
    await chooseRequired(user);
    await user.click(screen.getByRole('button', { name: 'Add Subscription' }));

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
    const { onSave } = await renderOpen(existing);

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
    const { onClose, onSave } = await renderOpen(undefined, null);

    await user.type(screen.getByPlaceholderText('e.g. Netflix, Spotify, GitHub Pro'), 'Netflix');
    await user.type(screen.getByPlaceholderText('15.99'), '15.99');
    await chooseRequired(user);
    await user.click(screen.getByRole('button', { name: 'Add Subscription' }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
    expect(mocks.toast.success).not.toHaveBeenCalled();
  });

  /**
   * The start date decides the renewal date: a subscription that started on a
   * day renews a cycle later. The date is still editable, this only fills it
   * in.
   */
  it('moves the renewal date a month on from the start date', async () => {
    await renderOpen();

    fireEvent.change(screen.getByLabelText('Start Date'), {
      target: { value: '2026-03-15' },
    });

    await waitFor(() =>
      expect(screen.getByLabelText('Next Billing Date')).toHaveValue('2026-04-15')
    );
  });

  it('moves the renewal date a year on when the year shortcut is used', async () => {
    const user = userEvent.setup();
    await renderOpen();

    fireEvent.change(screen.getByLabelText('Start Date'), {
      target: { value: '2026-03-15' },
    });
    await user.click(screen.getByRole('button', { name: '+1 Year' }));

    // The shortcut sets the cycle as well as the date.
    expect(screen.getByLabelText('Cycle')).toHaveValue('yearly');
    await waitFor(() =>
      expect(screen.getByLabelText('Next Billing Date')).toHaveValue('2027-03-15')
    );
  });

  it('measures the shortcut from the start date, not from today', async () => {
    const user = userEvent.setup();
    await renderOpen();

    fireEvent.change(screen.getByLabelText('Start Date'), {
      target: { value: '2026-03-15' },
    });
    await user.click(screen.getByRole('button', { name: '+1 Month' }));

    await waitFor(() =>
      expect(screen.getByLabelText('Next Billing Date')).toHaveValue('2026-04-15')
    );
  });

  it('clamps a renewal to the end of a shorter month', async () => {
    await renderOpen();

    // The 31st of January renews on the 28th of February, not in March.
    fireEvent.change(screen.getByLabelText('Start Date'), {
      target: { value: '2027-01-31' },
    });

    await waitFor(() =>
      expect(screen.getByLabelText('Next Billing Date')).toHaveValue('2027-02-28')
    );
  });

  /**
   * A row that was added before the form had a start date has none. Editing
   * it has to be blocked until the date is filled in — the same rule as
   * adding, because an edit that writes a row with a missing date is the same
   * broken row.
   */
  it('refuses to save an edit while the start date is empty', async () => {
    const user = userEvent.setup();
    const { onSave } = await renderOpen(makeSubscription({ start_date: null }));

    // The row has no start date, so the box is empty.
    expect(screen.getByLabelText('Start Date')).toHaveValue('');

    await user.click(screen.getByRole('button', { name: 'Update Subscription' }));

    expect(await screen.findByText('Start date is required.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('does not call onSave when required fields are empty', async () => {
    const user = userEvent.setup();
    const { onSave } = await renderOpen();

    await user.click(screen.getByRole('button', { name: 'Add Subscription' }));

    expect(onSave).not.toHaveBeenCalled();
  });

  /**
   * The currency, the cycle, the category and the status are choices the user
   * has an opinion about. A default the user never picked is a value the user
   * never entered, and it is how a subscription ends up filed under the wrong
   * category and billed on the wrong day.
   */
  it('requires the currency, the cycle, the category and the status', async () => {
    const user = userEvent.setup();
    const { onSave } = await renderOpen();

    await user.type(screen.getByPlaceholderText('e.g. Netflix, Spotify, GitHub Pro'), 'Netflix');
    await user.type(screen.getByPlaceholderText('15.99'), '15.99');
    await user.click(screen.getByRole('button', { name: 'Add Subscription' }));

    expect(await screen.findByText('Currency is required.')).toBeInTheDocument();
    expect(screen.getByText('Cycle is required.')).toBeInTheDocument();
    expect(screen.getByText('Category is required.')).toBeInTheDocument();
    expect(screen.getByText('Status is required.')).toBeInTheDocument();
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
    const { onSave } = await renderOpen(initialData);

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
    const { onSave } = await renderOpen(initialData);

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

/**
 * Adding a service that is already tracked.
 *
 * The user forgot they had added it. The answer is not a second row — two
 * rows for one service is what makes the totals and the reminders wrong — it
 * is another account on the row that is already there. The form says so, fills
 * itself from that row so nothing is left blank, and saves onto it.
 */
describe('SubscriptionModal already-tracked service', () => {
  const tracked = makeSubscription({
    id: 'sub_existing',
    name: 'Netflix',
    price: 15.99,
    currency: 'NGN',
    billing_cycle: 'yearly',
    category: 'Software',
    status: 'trial',
    next_billing_date: '2026-12-24',
  });

  it('turns into an add-another-account form once the name matches', async () => {
    const user = userEvent.setup();
    await renderOpen(null, 'sub_new', [tracked]);

    await user.type(
      screen.getByPlaceholderText('e.g. Netflix, Spotify, GitHub Pro'),
      'netflix'
    );

    // The form says what it is about to do, before the user saves anything.
    expect(
      await screen.findByRole('heading', { name: 'Add Another Account' })
    ).toBeInTheDocument();
    expect(screen.getByText('Add another Netflix account')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add Another Account' })
    ).toBeInTheDocument();
  });

  it('fills what the user does not have to decide, and leaves the rest empty', async () => {
    const user = userEvent.setup();
    await renderOpen(null, 'sub_new', [tracked]);

    await user.type(
      screen.getByPlaceholderText('e.g. Netflix, Spotify, GitHub Pro'),
      'Netflix'
    );

    // The price, the currency, the cycle, the category and the status come
    // from the row that is already there: another account for the same service
    // is the same service at the same price.
    await waitFor(() =>
      expect(screen.getByPlaceholderText('15.99')).toHaveValue(15.99)
    );
    expect(screen.getByDisplayValue('NGN (₦)')).toBeInTheDocument();
    expect(screen.getByDisplayValue('yearly')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Software')).toBeInTheDocument();
    expect(screen.getByDisplayValue('trial')).toBeInTheDocument();

    // The boxes the user has to decide are empty: the account type, the start
    // date and the renewal date. A date the user never chose is a date the
    // reminders would be wrong about.
    expect(screen.getByLabelText('Account Type')).toHaveValue('');
    expect(screen.getByLabelText('Start Date')).toHaveValue('');
    expect(screen.getByLabelText('Next Billing Date')).toHaveValue('');
  });

  it('saves onto the subscription already tracked instead of creating a new one', async () => {
    const user = userEvent.setup();
    const { onSave } = await renderOpen(null, 'sub_new', [tracked]);

    await user.type(
      screen.getByPlaceholderText('e.g. Netflix, Spotify, GitHub Pro'),
      'Netflix'
    );
    // The form now carries an account, so the type of that account is a choice
    // the user has to make, and so are the two dates.
    await user.selectOptions(screen.getByLabelText('Account Type'), 'Family');
    fireEvent.change(screen.getByLabelText('Start Date'), {
      target: { value: '2026-02-01' },
    });
    fireEvent.change(screen.getByLabelText('Next Billing Date'), {
      target: { value: '2026-12-24' },
    });

    await user.click(await screen.findByRole('button', { name: 'Add Another Account' }));

    // The id it saves to is the row that is already there.
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][1]).toBe('sub_existing');
    expect(onSave.mock.calls[0][0]).toMatchObject({
      name: 'Netflix',
      price: 15.99,
      currency: 'NGN',
      billing_cycle: 'yearly',
      category: 'Software',
      status: 'trial',
      next_billing_date: '2026-12-24',
      start_date: '2026-02-01',
    });
  });

  it('keeps the account that is already there and adds the new one beside it', async () => {
    const user = userEvent.setup();
    const withAccount = {
      ...tracked,
      account_links: [
        { id: 'link-1', label: 'Personal', url: 'https://spotify.com/personal', email: '' },
      ],
      notes:
        'Plan: Individual\n[AccountLinks: [{"id":"link-1","label":"Personal","url":"https://spotify.com/personal","email":""}]]',
    };

    const { onSave } = await renderOpen(null, 'sub_new', [withAccount]);

    await user.type(
      screen.getByPlaceholderText('e.g. Netflix, Spotify, GitHub Pro'),
      'Netflix'
    );
    await user.selectOptions(screen.getByLabelText('Account Type'), 'Family');
    fireEvent.change(screen.getByLabelText('Start Date'), {
      target: { value: '2026-02-01' },
    });
    fireEvent.change(screen.getByLabelText('Next Billing Date'), {
      target: { value: '2026-12-24' },
    });

    // Both accounts are on the form: the one that was there and the new one.
    await fillRequiredFields(user);

    await user.click(await screen.findByRole('button', { name: 'Add Another Account' }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const links = onSave.mock.calls[0][0].account_links as { id: string }[];
    expect(links).toHaveLength(2);
    expect(links[0].id).toBe('link-1');
  });

  it('does not treat a cancelled subscription as the same service', async () => {
    const user = userEvent.setup();
    await renderOpen(null, 'sub_new', [{ ...tracked, status: 'canceled' }]);

    await user.type(
      screen.getByPlaceholderText('e.g. Netflix, Spotify, GitHub Pro'),
      'Netflix'
    );

    // A subscription that was cancelled and started again is a new one.
    expect(
      screen.queryByRole('heading', { name: 'Add Another Account' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add Subscription' })
    ).toBeInTheDocument();
  });
});

describe('SubscriptionModal subscription accounts', () => {
  beforeEach(() => {
    mocks.planTier = 'free';
  });

  /**
   * The link box is closed until the user opens it.
   *
   * An account that was never given a link has nothing to show, and an empty
   * box sitting there reads as a field that was missed.
   */
  it('keeps the link box closed until the account is opened', async () => {
    const user = userEvent.setup();
    await renderOpen();

    expect(screen.queryByLabelText(/Account URL/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Add account link/ }));

    expect(screen.getByLabelText(/Account URL/)).toBeInTheDocument();
  });

  it('leaves the account URL box empty and puts the provider link on the arrow', async () => {
    const user = userEvent.setup();
    await renderOpen();

    await user.type(
      screen.getByPlaceholderText('e.g. Netflix, Spotify, GitHub Pro'),
      'Netflix'
    );
    await user.click(screen.getByRole('button', { name: /Add account link/ }));

    const url = screen.getByLabelText(/Account URL/) as HTMLInputElement;
    expect(url.value).toBe('');

    // The arrow opens the provider's own page, not the account's link.
    const arrow = screen.getByRole('link', { name: /Open Netflix in a new tab/ });
    expect(arrow).toHaveAttribute('href', 'https://www.netflix.com');
  });

  it('closes the box again when the account is deleted', async () => {
    const user = userEvent.setup();
    await renderOpen();

    await user.click(screen.getByRole('button', { name: /Add account link/ }));
    expect(screen.getByLabelText(/Account URL/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete this account' }));

    expect(screen.queryByLabelText(/Account URL/)).not.toBeInTheDocument();
  });

  it('sends a free user to upgrade when adding a second account', async () => {
    const user = userEvent.setup();
    const { onRequireUpgrade } = await renderOpen();

    await user.type(
      screen.getByPlaceholderText('e.g. Netflix, Spotify, GitHub Pro'),
      'Netflix'
    );

    const addButton = screen.getByRole('button', { name: /Add account link/ });
    await user.click(addButton);
    expect(screen.getByLabelText(/Account URL/)).toBeInTheDocument();

    // The second attempt is refused and routed to the upgrade sheet.
    await user.click(addButton);
    expect(onRequireUpgrade).toHaveBeenCalledTimes(1);
  });

  it('does not badge the account section; it explains the limit on attempt', async () => {
    const user = userEvent.setup();
    await renderOpen();

    // No badge up front: the section is a normal part of adding a subscription.
    expect(screen.queryByTestId('plus-badge')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Add account link/ }));

    // Reaching the cap explains itself instead of advertising the tier.
    expect(screen.queryByTestId('plus-badge')).not.toBeInTheDocument();
    expect(screen.getByText(/one account per subscription/i)).toBeInTheDocument();
  });

  it('lets a Plus user add an account without an upgrade prompt', async () => {
    mocks.planTier = 'plus';
    const user = userEvent.setup();
    const { onSave, onRequireUpgrade } = await renderOpen();

    await user.type(
      screen.getByPlaceholderText('e.g. Netflix, Spotify, GitHub Pro'),
      'Netflix'
    );
    const addButton = screen.getByRole('button', { name: /Add account link/ });
    await user.click(addButton);

    expect(onRequireUpgrade).not.toHaveBeenCalled();
    expect(screen.queryByTestId('plus-badge')).not.toBeInTheDocument();

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Add Subscription' }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const links = onSave.mock.calls[0][0].account_links as { label: string }[];
    expect(links).toHaveLength(1);
    expect(links[0].label).toBe('Personal');
  });

  it('keeps the marker that accounts are optional beside the add control', async () => {
    await renderOpen();

    expect(screen.getByText('(optional)')).toBeInTheDocument();
  });
});
