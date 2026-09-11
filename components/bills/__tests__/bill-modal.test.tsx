import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BillModal from '@/components/bills/bill-modal';
import type { BillPayment } from '@/lib/types/bills.types';

const mocks = vi.hoisted(() => ({
  updateDefaultCurrency: vi.fn(),
}));

vi.mock('@/lib/contexts/user-settings-context', () => ({
  useCurrency: () => ({ defaultCurrency: 'NGN', exchangeRates: {}, updateDefaultCurrency: mocks.updateDefaultCurrency }),
}));

function makeBill(overrides: Partial<BillPayment> = {}): BillPayment {
  return {
    id: 'bp_1',
    userId: 'user_1',
    category: 'Electricity',
    customCategory: null,
    providerName: 'Ikeja Electric (IKEDC)',
    amount: 25000,
    currency: 'NGN',
    paymentDate: '2026-08-26',
    country: 'Nigeria',
    region: 'Lagos',
    city: 'Ikeja',
    paymentFrequency: 'one_time',
    isRecurring: false,
    notes: null,
    receipts: [],
    source: 'manual',
    providerReference: null,
    officialProviderUrl: null,
    status: 'paid',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('BillModal', () => {
  it('renders create mode with a save button', () => {
    render(<BillModal isOpen onClose={vi.fn()} onSave={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Record New Bill or Payment' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Ikeja Electric, Spectranet, MTN, Landlord Rent...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Payment' })).toBeInTheDocument();
  });

  it('shows a validation error and does not call onSave when provider name is missing', () => {
    const onSave = vi.fn();
    const { container } = render(<BillModal isOpen onClose={vi.fn()} onSave={onSave} />);

    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    expect(screen.getByText('Please enter a provider or merchant name.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('calls onSave with the entered values when submitting create mode', async () => {
    const onSave = vi.fn(async () => {});
    const onClose = vi.fn();
    render(<BillModal isOpen onClose={onClose} onSave={onSave} />);

    fireEvent.change(screen.getByPlaceholderText('e.g. Ikeja Electric, Spectranet, MTN, Landlord Rent...'), {
      target: { value: 'Landlord Rent' },
    });
    fireEvent.change(screen.getByPlaceholderText('25000.00'), {
      target: { value: '25000' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Save Payment' }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          providerName: 'Landlord Rent',
          amount: 25000,
          currency: 'NGN',
          category: 'Electricity',
          paymentDate: new Date().toISOString().split('T')[0],
          country: 'Nigeria',
          region: null,
          city: null,
          paymentFrequency: 'one_time',
          isRecurring: false,
          notes: null,
          providerReference: null,
          officialProviderUrl: null,
          status: 'paid',
          source: 'manual',
        })
      )
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('prefills edit mode and calls onSave with updated values', async () => {
    const user = userEvent.setup();
    const initialData = makeBill();
    const onSave = vi.fn(async () => {});
    render(<BillModal isOpen onClose={vi.fn()} onSave={onSave} initialData={initialData} />);

    expect(screen.getByRole('heading', { name: 'Edit Bill / Payment' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Ikeja Electric (IKEDC)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update Record' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Update Record' }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ providerName: 'Ikeja Electric (IKEDC)', amount: 25000, source: 'manual' })
      )
    );
  });
});