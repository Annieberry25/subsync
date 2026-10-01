import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SubscriptionRow } from '@/lib/services/subscription-service';
import { CancellationIntelligenceModal } from '@/components/ai/cancellation-intelligence-modal';

const updateSubscription = vi.fn();

vi.mock('@/lib/services/subscription-service', async (orig) => {
  const actual = await orig<typeof import('@/lib/services/subscription-service')>();
  return {
    ...actual,
    updateSubscription: (...args: unknown[]) => updateSubscription(...args),
  };
});

vi.mock('@/lib/supabase/client', () => ({
  supabase: { auth: { getUser: vi.fn() }, from: vi.fn(() => ({ select: vi.fn() })) },
  default: { auth: { getUser: vi.fn() }, from: vi.fn(() => ({ select: vi.fn() })) },
}));

vi.mock('@/lib/contexts/user-settings-context', () => ({
  useCurrency: () => ({
    defaultCurrency: 'USD',
    currencies: ['USD'],
    exchangeRates: {},
    loading: false,
    updateDefaultCurrency: vi.fn(),
  }),
}));

vi.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }),
}));

const sub = (over: Partial<SubscriptionRow> = {}): SubscriptionRow =>
  ({
    id: 'sub-1',
    name: 'Netflix',
    price: 30,
    currency: 'USD',
    billing_cycle: 'monthly',
    category: 'Streaming',
    status: 'active',
    start_date: null,
    end_date: null,
    next_billing_date: '2026-12-15',
    payment_method: null,
    provider_url: 'https://netflix.com/cancel',
    notes: null,
    cheaper_plan_name: null,
    cheaper_plan_price: null,
    account_links: [],
    receipts: [],
    is_synced: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...over,
  }) as SubscriptionRow;

const renderModal = (over: Partial<SubscriptionRow> = {}, onClose = vi.fn()) => {
  const onStatusUpdated = vi.fn();
  const onReviewSubscription = vi.fn();
  render(
    <CancellationIntelligenceModal
      isOpen={true}
      onClose={onClose}
      subscription={sub(over)}
      onStatusUpdated={onStatusUpdated}
      onReviewSubscription={onReviewSubscription}
    />
  );
  return { onStatusUpdated, onClose, onReviewSubscription };
};

/* The status buttons are gated behind the provider link, so anything that needs
   them clicks the link first. */
const revealStatusButtons = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('link', { name: /Cancel on provider site/ }));
};

describe('CancellationIntelligenceModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateSubscription.mockResolvedValue({ data: null, error: null });
  });

  it('is titled Savings Intelligence with only the service name in bold beneath it', () => {
    renderModal({ name: 'Spotify' });

    expect(screen.getByText('Savings Intelligence')).toBeInTheDocument();
    expect(screen.queryByText('Cancellation Intelligence')).not.toBeInTheDocument();

    const name = screen.getByText('Spotify');
    expect(name.className).toContain('font-semibold');
    expect(screen.queryByText(/Guidance & Route/)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('Guidance & Route');
  });

  it('reads as information: name, savings, and plain links', () => {
    renderModal({ next_billing_date: '2026-12-15', name: 'ChatGPT', price: 20 });

    expect(screen.getByText('Savings Intelligence')).toBeInTheDocument();
    expect(screen.getByText('ChatGPT')).toBeInTheDocument();

    // Savings come from the row, not hardcoded.
    expect(screen.getByText('Potential Monthly Savings')).toBeInTheDocument();
    expect(screen.getByText('$20.00')).toBeInTheDocument();
    expect(screen.getByText('Projected Annual Savings')).toBeInTheDocument();
    expect(screen.getByText('$240.00')).toBeInTheDocument();

    // Both actions are links, not buttons.
    const review = screen.getByRole('button', { name: 'Review subscription' });
    expect(review.className).not.toContain('underline');
    expect(screen.getByRole('link', { name: /Cancel on provider site/ })).toBeInTheDocument();

    // The rest stays out.
    expect(screen.queryByText(/Renews on/)).not.toBeInTheDocument();
    expect(screen.queryByText('Official Cancellation Route')).not.toBeInTheDocument();
    expect(screen.queryByText(/SubHalt identified the verified management route/)).not.toBeInTheDocument();
    expect(screen.queryByText('Track Status in SubHalt')).not.toBeInTheDocument();
  });

  it('stacks the sheet as information: label above figure, links last', () => {
    renderModal({ name: 'ChatGPT', price: 20 });

    const body = document.body.textContent || '';
    const order = [
      'Potential Monthly Savings',
      '$20.00',
      'Projected Annual Savings',
      '$240.00',
      'Recommended Action:',
      'Review subscription',
      'Cancel on provider site',
    ].map((needle) => body.indexOf(needle));

    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);

    // Each label owns the figure directly beneath it, so the figure is a block
    // sibling rather than a second grid column.
    const monthlyLabel = screen.getByText('Potential Monthly Savings');
    const monthlyFigure = screen.getByText('$20.00');
    expect(monthlyLabel.parentElement).toBe(monthlyFigure.parentElement);
    expect(monthlyLabel.className).toContain('block');
    expect(monthlyFigure.className).toContain('block');
    // The figure is medium weight at the same size as its label.
    expect(monthlyFigure.className).toContain('text-[11px]');
    expect(monthlyFigure.className).toContain('font-medium');
    expect(monthlyFigure.className).not.toContain('font-bold');

    // The savings figures are no longer inside the boxed card.
    const savingsGroup = monthlyLabel.parentElement as HTMLElement;
    expect(savingsGroup.className).not.toContain('rounded-xl');
    expect(savingsGroup.className).not.toContain('bg-[#121414]');
    expect(savingsGroup.className).not.toContain('border');
  });

  it('renders Recommended Action only when a cheaper tier is stored', () => {
    renderModal();
    expect(screen.queryByText('Recommended Action')).not.toBeInTheDocument();

    renderModal({ cheaper_plan_name: 'Basic Plan', cheaper_plan_price: 12 });
    expect(screen.getAllByText('Recommended Action:').length).toBeGreaterThan(0);
    expect(screen.getByText(/Downgrade to Basic Plan/)).toBeInTheDocument();
    expect(screen.getByText(/save \$18\.00\/mo/)).toBeInTheDocument();
  });

  it('Review subscription opens the detail sheet and closes this one', async () => {
    const user = userEvent.setup();
    const { onReviewSubscription, onClose } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Review subscription' }));

    expect(onReviewSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sub-1' })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('hides the status buttons until the provider link has been opened', async () => {
    const user = userEvent.setup();
    renderModal();

    expect(screen.queryByRole('button', { name: 'Keep it' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirm Canceled/ })).not.toBeInTheDocument();

    await revealStatusButtons(user);

    expect(screen.getByRole('button', { name: 'Keep it' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm Canceled/ })).toBeInTheDocument();
  });

  it('shows the status buttons immediately when there is no provider link', () => {
    // Nothing to visit means nothing to gate on; the row must not be stranded.
    renderModal({ provider_url: null, name: 'Mystery Service' });

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(/We don't have a management link for Mystery Service yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep it' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm Canceled/ })).toBeInTheDocument();
  });

  it('has no Mark as Paused button and offers a ghost Keep it button', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    expect(screen.queryByRole('button', { name: /Mark as Paused/i })).not.toBeInTheDocument();

    await revealStatusButtons(user);
    const keep = screen.getByRole('button', { name: 'Keep it' });
    // Ghost: transparent background, visible border.
    expect(keep.className).toContain('bg-transparent');
    expect(keep.className).toContain('border');

    await user.click(keep);
    // Dismisses the recommendation without touching the row.
    expect(onClose).toHaveBeenCalled();
    expect(updateSubscription).not.toHaveBeenCalled();
  });

  it('reads Confirm Downgraded when a cheaper tier is stored', async () => {
    const user = userEvent.setup();
    renderModal({ cheaper_plan_name: 'Basic Plan', cheaper_plan_price: 12 });

    await revealStatusButtons(user);

    expect(screen.getByRole('button', { name: /Confirm Downgraded/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirm Canceled/ })).not.toBeInTheDocument();
  });

  it('reads Confirm Canceled when the cheaper tier is incomplete', async () => {
    const user = userEvent.setup();
    renderModal({ cheaper_plan_name: 'Basic Plan', cheaper_plan_price: null });

    await revealStatusButtons(user);

    expect(screen.getByRole('button', { name: /Confirm Canceled/ })).toBeInTheDocument();
  });

  it('keeps the provider link identical in the downgrade branch', () => {
    const { unmount } = render(
      <CancellationIntelligenceModal isOpen onClose={vi.fn()} subscription={sub()} />
    );
    const cancelHref = screen.getByRole('link').getAttribute('href');
    unmount();

    render(
      <CancellationIntelligenceModal
        isOpen
        onClose={vi.fn()}
        subscription={sub({ cheaper_plan_name: 'Basic Plan', cheaper_plan_price: 12 })}
      />
    );
    expect(screen.getByRole('link').getAttribute('href')).toBe(cancelHref);
  });

  it('asks for confirmation on the provider site before marking canceled', async () => {
    const user = userEvent.setup();
    renderModal({ name: 'Spotify' });

    await revealStatusButtons(user);
    await user.click(screen.getByRole('button', { name: /Confirm Canceled/ }));

    expect(
      screen.getByText("Did you complete cancellation on Spotify's site?")
    ).toBeInTheDocument();
    expect(updateSubscription).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Yes, I canceled' }));

    await waitFor(() => expect(updateSubscription).toHaveBeenCalledTimes(1));
    const [id, patch] = updateSubscription.mock.calls[0];
    expect(id).toBe('sub-1');
    expect(patch.status).toBe('canceled');
    // end_date is today, in YYYY-MM-DD.
    expect(patch.end_date).toBe(new Date().toISOString().split('T')[0]);
  });

  it('can back out of the confirmation dialog without changing anything', async () => {
    const user = userEvent.setup();
    renderModal();

    await revealStatusButtons(user);
    await user.click(screen.getByRole('button', { name: /Confirm Canceled/ }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(updateSubscription).not.toHaveBeenCalled();
  });

  it('marks a downgrade as canceled and refreshes the parent list', async () => {
    const user = userEvent.setup();
    const { onStatusUpdated } = renderModal({
      cheaper_plan_name: 'Basic Plan',
      cheaper_plan_price: 12,
    });

    await revealStatusButtons(user);
    await user.click(screen.getByRole('button', { name: /Confirm Downgraded/ }));
    await user.click(screen.getByRole('button', { name: 'Yes, I canceled' }));

    await waitFor(() => expect(updateSubscription).toHaveBeenCalledTimes(1));
    expect(updateSubscription.mock.calls[0][1].status).toBe('canceled');
    expect(onStatusUpdated).toHaveBeenCalled();
  });

  it('shows an undo that reverts the status and end date', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { onStatusUpdated } = renderModal();

      await revealStatusButtons(user);
      await user.click(screen.getByRole('button', { name: /Confirm Canceled/ }));
      await user.click(screen.getByRole('button', { name: 'Yes, I canceled' }));

      await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument());
      expect(screen.getByText(/marked as done/)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Undo' }));

      await waitFor(() => expect(updateSubscription).toHaveBeenCalledTimes(2));
      const [, undoPatch] = updateSubscription.mock.calls[1];
      expect(undoPatch.status).toBe('active');
      expect(undoPatch.end_date).toBeNull();
      expect(onStatusUpdated).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('closes itself once the undo window expires', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { onClose } = renderModal();

      await revealStatusButtons(user);
      await user.click(screen.getByRole('button', { name: /Confirm Canceled/ }));
      await user.click(screen.getByRole('button', { name: 'Yes, I canceled' }));

      await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument());
      expect(onClose).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(9000);
      });

      await waitFor(() => expect(onClose).toHaveBeenCalled());
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the dialog open and reports an error when the update fails', async () => {
    const user = userEvent.setup();
    updateSubscription.mockResolvedValue({ data: null, error: { message: 'nope' } });
    const { onClose, onStatusUpdated } = renderModal();

    await revealStatusButtons(user);
    await user.click(screen.getByRole('button', { name: /Confirm Canceled/ }));
    await user.click(screen.getByRole('button', { name: 'Yes, I canceled' }));

    await waitFor(() => expect(updateSubscription).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(onStatusUpdated).not.toHaveBeenCalled();
  });
});
