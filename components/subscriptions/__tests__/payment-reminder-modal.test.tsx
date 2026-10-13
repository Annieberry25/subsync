import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PaymentReminderModal from '@/components/subscriptions/payment-reminder-modal';

const mocks = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

function renderSheet(
  props: Partial<React.ComponentProps<typeof PaymentReminderModal>> = {}
) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(
    <PaymentReminderModal
      isOpen
      onClose={onClose}
      onSave={onSave}
      subscriptionName="Netflix"
      nextBillingDate="2026-03-11"
      {...props}
    />
  );
  return { onSave, onClose };
}

const save = () => userEvent.click(screen.getByRole('button', { name: 'Save Reminder' }));

describe('PaymentReminderModal (Timing radio + Method checkboxes)', () => {
  it('defaults to push on, email off, at the default 12 hours', async () => {
    const { onSave } = renderSheet();
    await save();

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ emailLeadMinutes: null, pushLeadMinutes: 720 })
    );
  });

  it('offers 12 hours, 3 hours and a custom offset', () => {
    renderSheet();
    expect(screen.getByRole('radio', { name: '12 Hours Before' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '3 Hours Before' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Custom' })).toBeInTheDocument();
  });

  it('checking Email adds the email channel at the same offset', async () => {
    const { onSave } = renderSheet();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Email' }));
    await save();

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ emailLeadMinutes: 720, pushLeadMinutes: 720 })
    );
  });

  it('carries the chosen offset to both channels', async () => {
    const { onSave } = renderSheet();
    await userEvent.click(screen.getByRole('radio', { name: '3 Hours Before' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Email' }));
    await save();

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ emailLeadMinutes: 180, pushLeadMinutes: 180 })
    );
  });

  it('re-seeds the controls from saved lead offsets', async () => {
    const { onSave } = renderSheet({ initialEmailLeadMinutes: 180, initialPushLeadMinutes: 180 });
    expect(screen.getByRole('radio', { name: '3 Hours Before' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Email' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Push Notification' })).toBeChecked();

    await save();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ emailLeadMinutes: 180, pushLeadMinutes: 180 })
    );
  });

  it('turns a custom number of hours into minutes', async () => {
    const { onSave } = renderSheet();
    await userEvent.click(screen.getByRole('radio', { name: 'Custom' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Hours before renewal' }), {
      target: { value: '5' },
    });
    await save();

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ pushLeadMinutes: 300 }));
  });

  it('refuses a custom offset that is not in the future', async () => {
    const { onSave } = renderSheet();
    await userEvent.click(screen.getByRole('radio', { name: 'Custom' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Hours before renewal' }), {
      target: { value: '0' },
    });
    await save();

    expect(onSave).not.toHaveBeenCalled();
  });

  it('requires at least one method', async () => {
    const { onSave } = renderSheet();
    // Default: push on, email off. Turn push off so neither is selected.
    await userEvent.click(screen.getByRole('checkbox', { name: 'Push Notification' }));
    await save();

    expect(onSave).not.toHaveBeenCalled();
    expect(mocks.toast.error).toHaveBeenCalled();
  });

  it('passes an optional note through', async () => {
    const { onSave } = renderSheet();
    await userEvent.type(screen.getByRole('textbox'), 'Cancel before it renews');
    await save();

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ note: 'Cancel before it renews' })
    );
  });
});