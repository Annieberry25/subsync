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
});
