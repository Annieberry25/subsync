import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddSubscriptionModal from '@/components/subscriptions/add-subscription-modal';

let planTier = 'free';
let isAdmin = true;

vi.mock('@/lib/contexts/user-settings-context', () => ({
  usePlan: () => ({ planTier, isPlus: planTier === 'plus' }),
  useSettings: () => ({ settings: {} }),
  useAuth: () => ({ isAdmin }),
}));

const toastMock = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
};

vi.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
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

/** Loads the modal module fresh, so env-stubbed flags are read at eval time. */
const loadModal = (): Promise<typeof AddSubscriptionModal> =>
  import('@/components/subscriptions/add-subscription-modal').then((m) => m.default);

const renderModal = async (over: Record<string, unknown> = {}) => {
  const onClose = vi.fn();
  const onSelectManual = vi.fn();
  const Modal = await loadModal();
  render(
    <Modal
      isOpen
      onClose={onClose}
      onSelectManual={onSelectManual}
      {...over}
    />
  );
  return { onClose, onSelectManual };
};

describe('AddSubscriptionModal Plus gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    planTier = 'free';
    isAdmin = false;
    // The integrations are admin-only by default; opening the render paths to
    // non-admins is what lets these tests exercise the plan gate alone. The
    // module is re-evaluated so the stubbed env is what the flags read.
    vi.stubEnv('NEXT_PUBLIC_GMAIL_CONNECT_ADMIN_ONLY', 'false');
    vi.stubEnv('NEXT_PUBLIC_EMAIL_FORWARDING_ADMIN_ONLY', 'false');
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('marks Gmail Connect and Email Forwarding as Plus for a non-admin', async () => {
    await renderModal();

    // Both Plus-only paths carry the badge.
    expect(screen.getAllByTestId('plus-badge')).toHaveLength(2);
  });

  it('leaves the basic paths unbadged for a non-admin', async () => {
    await renderModal();

    // Add Manually and Import Receipt are free, so the two badges above belong
    // to Gmail and Forwarding only.
    const manual = screen.getByRole('button', { name: /Add Manually/ });
    const receipt = screen.getByRole('button', { name: /Import Receipt/ });

    for (const option of [manual, receipt]) {
      expect(option.querySelector('[data-testid="plus-badge"]')).toBeNull();
    }
  });

  it('refuses Gmail Connect with a coming-later explanation for a non-admin', async () => {
    const user = userEvent.setup();
    const { onClose } = await renderModal();

    await user.click(screen.getByRole('button', { name: /Connect Gmail/ }));

    // No checkout exists while Plus is future-flagged: the path is explained
    // in place and the menu stays open.
    expect(toastMock.info).toHaveBeenCalledTimes(1);
    expect(toastMock.info.mock.calls[0][1]).toBe('Coming with Plus');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByText('Gmail modal')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Connect Gmail/ })).toBeInTheDocument();
  });

  it('refuses Email Forwarding with a coming-later explanation for a non-admin', async () => {
    const user = userEvent.setup();
    const { onClose } = await renderModal();

    await user.click(screen.getByRole('button', { name: /Email Forwarding/ }));

    expect(toastMock.info).toHaveBeenCalledTimes(1);
    expect(toastMock.info.mock.calls[0][1]).toBe('Coming with Plus');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByText('Forwarding modal')).not.toBeInTheDocument();
  });

  it('still lets a non-admin add manually and import a receipt', async () => {
    const user = userEvent.setup();
    const { onSelectManual } = await renderModal();

    await user.click(screen.getByRole('button', { name: /Add Manually/ }));

    expect(onSelectManual).toHaveBeenCalled();
    expect(toastMock.info).not.toHaveBeenCalled();
  });

  it('drops both badges and opens the flows once the Plus release lands', async () => {
    planTier = 'plus';
    const user = userEvent.setup();
    await renderModal();

    expect(screen.queryAllByTestId('plus-badge')).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: /Connect Gmail/ }));

    expect(toastMock.info).not.toHaveBeenCalled();
    expect(screen.getByText('Gmail modal')).toBeInTheDocument();
  });

it('saves a reviewed receipt instead of opening the manual form', async () => {
    const user = userEvent.setup();
    const onSelectManual = vi.fn();
    const onCreateFromReceipt = vi.fn();
    await renderModal({ onSelectManual, onCreateFromReceipt });

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
    await renderModal({ onSelectManual });

    await user.click(screen.getByRole('button', { name: /Import Receipt/ }));
    await user.type(screen.getByRole('textbox'), 'Netflix 15.99 monthly');
    await user.click(screen.getByRole('button', { name: 'Extract Receipt' }));

    await user.click(await screen.findByRole('button', { name: 'Add Subscription' }));

    expect(onSelectManual).toHaveBeenCalledTimes(1);
  });
});

/**
 * Gmail Connect and Email Forwarding are admin-only until they are released.
 * Everyone else sees the paths that are already public.
 */
describe('AddSubscriptionModal admin-only integrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-evaluate the module with the repo's default flags after the gating
    // suite above evaluated it with stubbed env.
    vi.resetModules();
    planTier = 'plus';
    isAdmin = false;
  });

  it('hides Gmail Connect and Email Forwarding from non-admins', async () => {
    await renderModal();

    expect(screen.queryByRole('button', { name: /Connect Gmail/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Email Forwarding/ })).toBeNull();

    // The released paths are untouched.
    expect(screen.getByRole('button', { name: /Import Receipt/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Manually/ })).toBeInTheDocument();
  });

  it('shows them to an admin', async () => {
    isAdmin = true;
    await renderModal();

    expect(screen.getByRole('button', { name: /Connect Gmail/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Email Forwarding/ })).toBeInTheDocument();
  });
});

/**
 * "Subscribe through Provider" is behind a flag until the provider catalogue
 * is worth sending anyone to. The flag is read from the environment when the
 * module is first evaluated, so the enabled case re-imports the module with
 * the variable stubbed.
 */
describe('AddSubscriptionModal provider path flag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    planTier = 'free';
    isAdmin = true;
  });

  it('hides Subscribe through Provider by default', async () => {
    await renderModal();

    expect(screen.queryByRole('button', { name: /Subscribe through Provider/ })).toBeNull();
  });

  it('shows Subscribe through Provider when the flag is on', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_PROVIDER_SUBSCRIBE_ENABLED', 'true');

    const { default: AddSubscriptionModalEnabled } = await import(
      '@/components/subscriptions/add-subscription-modal'
    );

    render(
      <AddSubscriptionModalEnabled
        isOpen
        onClose={vi.fn()}
        onSelectManual={vi.fn()}
      />
    );

    expect(
      screen.getByRole('button', { name: /Subscribe through Provider/ })
    ).toBeInTheDocument();

    vi.unstubAllEnvs();
  });
});
