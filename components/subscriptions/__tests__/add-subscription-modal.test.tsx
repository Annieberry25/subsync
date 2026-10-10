import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddSubscriptionModal from '@/components/subscriptions/add-subscription-modal';

let planTier = 'free';

vi.mock('@/lib/contexts/user-settings-context', () => ({
  usePlan: () => ({ planTier, isPlus: planTier === 'plus' }),
  useSettings: () => ({ settings: {} }),
}));

vi.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }),
}));

// The add-flow modals reach the Supabase client, which validates env vars at
// import time. Stub it so this suite does not need real credentials.
vi.mock('@/lib/supabase/client', () => ({
  supabase: { auth: { getUser: vi.fn() }, from: vi.fn(() => ({ select: vi.fn() })) },
  default: { auth: { getUser: vi.fn() }, from: vi.fn(() => ({ select: vi.fn() })) },
}));

vi.mock('@/components/integrations/gmail-connect-modal', () => ({
  GmailConnectModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div>Gmail modal</div> : null,
}));

vi.mock('@/components/integrations/email-forwarding-modal', () => ({
  EmailForwardingModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div>Forwarding modal</div> : null,
}));

/**
 * The receipt flow is asserted through the real modal, so the scan itself is
 * stubbed: only the values the parser would return matter here, not the parse.
 */
const scanResult = {
  textSource: 'pdf-text-layer',
  text: 'Netflix 15.99 monthly',
  extraction: {
    providerName: { value: 'Netflix', confidence: 'high' },
    amount: { value: 15.99, confidence: 'high' },
    currency: { value: 'USD', confidence: 'high' },
    billingCycle: { value: 'monthly', confidence: 'high' },
    category: { value: 'Streaming', confidence: 'high' },
    nextBillingDate: { value: '2026-01-01', confidence: 'high' },
    providerUrl: { value: null, confidence: 'none' },
    plan: { value: 'Premium', confidence: 'high' },
  },
};

vi.mock('@/lib/hooks/use-receipt-scan', () => ({
  ACCEPT_ATTRIBUTE: '.pdf,.png,.jpg,.txt',
  TEXT_SOURCE_LABEL: { 'pdf-text-layer': 'PDF invoice text' },
  useReceiptScan: () => ({
    isScanning: false,
    error: null,
    result: scanResult,
    // Must resolve with the result: the review step only appears once the
    // analysis call hands one back.
    run: vi.fn(async () => scanResult),
    reset: vi.fn(),
    clearError: vi.fn(),
  }),
}));

const renderModal = (over: Record<string, unknown> = {}) => {
  const onClose = vi.fn();
  const onRequireUpgrade = vi.fn();
  const onSelectManual = vi.fn();
  render(
    <AddSubscriptionModal
      isOpen
      onClose={onClose}
      onSelectManual={onSelectManual}
      onRequireUpgrade={onRequireUpgrade}
      {...over}
    />
  );
  return { onClose, onRequireUpgrade, onSelectManual };
};

describe('AddSubscriptionModal Plus gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    planTier = 'free';
  });

  it('marks Gmail Connect and Email Forwarding as Plus for a free user', () => {
    renderModal();

    // Both Plus-only paths carry the badge.
    expect(screen.getAllByTestId('plus-badge')).toHaveLength(2);
  });

  it('leaves the basic paths unbadged for a free user', () => {
    renderModal();

    // Add Manually, Import Receipt, and Subscribe through Provider are free, so
    // the two badges above belong to Gmail and Forwarding only.
    const manual = screen.getByRole('button', { name: /Add Manually/ });
    const receipt = screen.getByRole('button', { name: /Import Receipt/ });
    const provider = screen.getByRole('button', { name: /Subscribe through Provider/ });

    for (const option of [manual, receipt, provider]) {
      expect(option.querySelector('[data-testid="plus-badge"]')).toBeNull();
    }
  });

  it('sends a free user to upgrade instead of the Gmail OAuth flow', async () => {
    const user = userEvent.setup();
    const { onRequireUpgrade, onClose } = renderModal();

    await user.click(screen.getByRole('button', { name: /Connect Gmail/ }));

    expect(onRequireUpgrade).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByText('Gmail modal')).not.toBeInTheDocument();
  });

  it('sends a free user to upgrade instead of the forwarding address', async () => {
    const user = userEvent.setup();
    const { onRequireUpgrade } = renderModal();

    await user.click(screen.getByRole('button', { name: /Email Forwarding/ }));

    expect(onRequireUpgrade).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Forwarding modal')).not.toBeInTheDocument();
  });

  it('still lets a free user add manually and import a receipt', async () => {
    const user = userEvent.setup();
    const { onSelectManual, onRequireUpgrade } = renderModal();

    await user.click(screen.getByRole('button', { name: /Add Manually/ }));

    expect(onSelectManual).toHaveBeenCalled();
    expect(onRequireUpgrade).not.toHaveBeenCalled();
  });

  it('drops both badges and opens the flows for a Plus user', async () => {
    planTier = 'plus';
    const user = userEvent.setup();
    const { onRequireUpgrade } = renderModal();

    expect(screen.queryAllByTestId('plus-badge')).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: /Connect Gmail/ }));

    expect(onRequireUpgrade).not.toHaveBeenCalled();
    expect(screen.getByText('Gmail modal')).toBeInTheDocument();
  });

it('saves a reviewed receipt instead of opening the manual form', async () => {
    const user = userEvent.setup();
    const onSelectManual = vi.fn();
    const onCreateFromReceipt = vi.fn();
    renderModal({ onSelectManual, onCreateFromReceipt });

    await user.click(screen.getByRole('button', { name: /Import Receipt/ }));
    await user.type(screen.getByRole('textbox'), 'Netflix 15.99 monthly');
    await user.click(screen.getByRole('button', { name: 'Extract Receipt' }));

    const add = await screen.findByRole('button', { name: 'Add Subscription' });
    await user.click(add);

    // Confirming the review must create the subscription. Falling back to
    // onSelectManual opens the pre-filled manual form, which reads as though
    // nothing was added yet.
    expect(onCreateFromReceipt).toHaveBeenCalledTimes(1);
    expect(onCreateFromReceipt.mock.calls[0][0]).toMatchObject({ name: 'Netflix' });
    expect(onSelectManual).not.toHaveBeenCalled();
  });

  it('falls back to the manual form when no direct-create path is given', async () => {
    const user = userEvent.setup();
    const onSelectManual = vi.fn();
    renderModal({ onSelectManual });

    await user.click(screen.getByRole('button', { name: /Import Receipt/ }));
    await user.type(screen.getByRole('textbox'), 'Netflix 15.99 monthly');
    await user.click(screen.getByRole('button', { name: 'Extract Receipt' }));

    await user.click(await screen.findByRole('button', { name: 'Add Subscription' }));

    expect(onSelectManual).toHaveBeenCalledTimes(1);
  });
});
