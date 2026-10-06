import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PaymentReminderModal from '@/components/subscriptions/payment-reminder-modal';

const mocks = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock('@/lib/push/client', () => ({
  getPushPermissionState: () => 'default',
  isPushSupported: () => true,
}));

function renderSheet(
  props: Partial<React.ComponentProps<typeof PaymentReminderModal>> = {}
) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(
    <PaymentReminderModal
      isOpen={true}
      onClose={onClose}
      onSave={onSave}
      subscriptionName="Netflix"
      nextBillingDate="2026-12-01"
      {...props}
    />
  );
  return { onSave, onClose };
}

function state(label: string): boolean {
  return screen.getByRole('switch', { name: label }).getAttribute('aria-checked') === 'true';
}

/**
 * The three states are the point of this sheet. Two of them are easy to confuse:
 * `undefined` means no preference row exists yet, `null` means the user turned the
 * channel off. Collapsing them made the sheet show push OFF for a subscription
 * whose reminder the cron would send anyway, and email ON for one nobody asked for.
 */
describe('PaymentReminderModal defaults', () => {
  it('shows push on and email off when nothing is saved', () => {
    renderSheet();
    expect(state('Push notification reminder')).toBe(true);
    expect(state('Email reminder')).toBe(false);
  });

  it('keeps a channel off only when it was explicitly saved as null', () => {
    renderSheet({ initialPushLeadDays: null, initialEmailLeadDays: null });
    expect(state('Push notification reminder')).toBe(false);
    expect(state('Email reminder')).toBe(false);
  });

  it('turns a channel off when its saved value is null but not the other', () => {
    renderSheet({ initialPushLeadDays: null, initialEmailLeadDays: 5 });
    expect(state('Push notification reminder')).toBe(false);
    expect(state('Email reminder')).toBe(true);
    expect(screen.getByRole('button', { name: /5 days before/ })).toBeTruthy();
  });

  it('sends explicit nulls rather than dropping channels from the payload', async () => {
    const { onSave } = renderSheet();
    await userEvent.click(screen.getByRole('button', { name: 'Save Reminder' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ emailLeadDays: null, pushLeadDays: 10 })
    );
  });

  it('persists both chosen lead times when email is switched on', async () => {
    const { onSave } = renderSheet({ initialEmailLeadDays: 7, initialPushLeadDays: 3 });
    await userEvent.click(screen.getByRole('button', { name: 'Save Reminder' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ emailLeadDays: 7, pushLeadDays: 3 })
    );
  });

  it('refuses to save when neither channel is on', async () => {
    const { onSave } = renderSheet({ initialPushLeadDays: null });
    await userEvent.click(screen.getByRole('button', { name: 'Save Reminder' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(mocks.toast.error).toHaveBeenCalled();
  });
});
