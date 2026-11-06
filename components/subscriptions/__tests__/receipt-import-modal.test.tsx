import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReceiptImportModal from '@/components/subscriptions/receipt-import-modal';
import type { ReceiptExtraction } from '@/lib/services/receipt-parser';

let mockExtraction: ReceiptExtraction;

vi.mock('@/lib/hooks/use-receipt-scan', () => ({
  ACCEPT_ATTRIBUTE: '.pdf,.png,.jpg,.txt',
  TEXT_SOURCE_LABEL: { 'pasted-text': 'Pasted text' },
  useReceiptScan: () => ({
    isScanning: false,
    error: null,
    result: {
      kind: 'subscription',
      textSource: 'pasted-text',
      pageCount: 1,
      text: 'Receipt text',
      extraction: mockExtraction,
      fileName: null,
      truncated: false,
    },
    run: vi.fn(async () => ({
      kind: 'subscription' as const,
      textSource: 'pasted-text' as const,
      pageCount: 1,
      text: 'Receipt text',
      extraction: mockExtraction,
      fileName: null,
      truncated: false,
    })),
    reset: vi.fn(),
    clearError: vi.fn(),
  }),
}));

function buildExtraction(overrides: Partial<ReceiptExtraction> = {}): ReceiptExtraction {
  return {
    kind: 'subscription',
    providerName: { value: 'Netflix', confidence: 'high', evidence: 'brand "netflix"' },
    amount: { value: 15.99, confidence: 'high', evidence: 'label "total"' },
    currency: { value: 'USD', confidence: 'high', evidence: 'amount prefix' },
    paymentDate: { value: '2026-11-12', confidence: 'high', evidence: 'label "start date"' },
    nextBillingDate: { value: null, confidence: 'none', evidence: '' },
    billingCycle: { value: 'monthly', confidence: 'medium', evidence: 'keyword "monthly"' },
    category: { value: 'Streaming', confidence: 'high', evidence: 'provider registry' },
    accountType: { value: 'Individual', confidence: 'medium', evidence: 'keyword "individual"' },
    providerReference: { value: null, confidence: 'none', evidence: '' },
    plan: { value: 'Standard', confidence: 'medium', evidence: 'plan label' },
    region: { value: null, confidence: 'none', evidence: '' },
    providerUrl: { value: null, confidence: 'none', evidence: '' },
    warnings: [],
    ...overrides,
  };
}

describe('ReceiptImportModal — automatic next billing date from start date and cycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExtraction = buildExtraction();
  });

  it('auto-populates Next Billing Date as 12/12/2026 (2026-12-12) when Start Date is 12/11/2026 and receipt is monthly', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <ReceiptImportModal
        isOpen
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Netflix monthly Start date: 12/11/2026' },
    });
    await user.click(screen.getByRole('button', { name: 'Extract Receipt' }));

    await user.click(await screen.findByRole('button', { name: 'Add Subscription' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0]).toMatchObject({
      name: 'Netflix',
      billingCycle: 'monthly',
      startDate: '2026-11-12',
      nextBillingDate: '2026-12-12',
    });
  });

  it('auto-populates Next Billing Date as 12/11/2027 (2027-11-12) when Start Date is 12/11/2026 and receipt is yearly', async () => {
    mockExtraction = buildExtraction({
      billingCycle: { value: 'yearly', confidence: 'medium', evidence: 'keyword "yearly"' },
    });
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <ReceiptImportModal
        isOpen
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Netflix yearly Start date: 12/11/2026' },
    });
    await user.click(screen.getByRole('button', { name: 'Extract Receipt' }));

    await user.click(await screen.findByRole('button', { name: 'Add Subscription' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0]).toMatchObject({
      name: 'Netflix',
      billingCycle: 'yearly',
      startDate: '2026-11-12',
      nextBillingDate: '2027-11-12',
    });
  });

  it('recalculates Next Billing Date when the user switches Billing Cycle from monthly to yearly in review', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <ReceiptImportModal
        isOpen
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Netflix Start date: 12/11/2026' },
    });
    await user.click(screen.getByRole('button', { name: 'Extract Receipt' }));

    const cycleSelect = await screen.findByLabelText('Billing cycle');
    await user.selectOptions(cycleSelect, 'yearly');

    await user.click(screen.getByRole('button', { name: 'Add Subscription' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0]).toMatchObject({
      billingCycle: 'yearly',
      startDate: '2026-11-12',
      nextBillingDate: '2027-11-12',
    });
  });

  it('does not show the blank-fields warning when all review fields are populated even if parser confidence is low', async () => {
    mockExtraction = buildExtraction({
      providerName: { value: 'Netflix', confidence: 'low', evidence: 'line 2' },
      amount: { value: 15.99, confidence: 'low', evidence: 'tier-2 label' },
    });
    const user = userEvent.setup();

    render(
      <ReceiptImportModal
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Netflix 15.99 Start date: 12/11/2026' },
    });
    await user.click(screen.getByRole('button', { name: 'Extract Receipt' }));

    await screen.findByRole('button', { name: 'Add Subscription' });
    expect(
      screen.queryByText(/We could not read all the information clearly, so they are blank/i)
    ).toBeNull();
    expect(screen.getByLabelText('Account type')).toBeInTheDocument();
  });

  it('defaults Category and Account Type to Other and shows the warning when category cannot be accurately determined', async () => {
    mockExtraction = buildExtraction({
      providerName: { value: 'Unknown Service', confidence: 'low', evidence: 'line 1' },
      category: { value: null, confidence: 'none', evidence: '' },
      accountType: { value: 'Other', confidence: 'none', evidence: '' },
    });
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <ReceiptImportModal
        isOpen
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Unknown Service $15.99 Start date: 12/11/2026' },
    });
    await user.click(screen.getByRole('button', { name: 'Extract Receipt' }));

    const categorySelect = (await screen.findByLabelText('Category')) as HTMLSelectElement;
    const accountTypeSelect = screen.getByLabelText('Account type') as HTMLSelectElement;
    expect(categorySelect.value).toBe('Other');
    expect(accountTypeSelect.value).toBe('Other');
    expect(
      screen.getByText(
        'We could not read all the information clearly, so they are blank. Please check to fill it out.'
      )
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add Subscription' }));
    expect(onConfirm.mock.calls[0][0]).toMatchObject({
      category: 'Other',
      accountType: 'Other',
    });
  });

  it('shows the warning when Account Type is left as Other even if provider and category are detected (e.g. Google One)', async () => {
    mockExtraction = buildExtraction({
      providerName: { value: 'Google One', confidence: 'high', evidence: 'brand "google one"' },
      category: { value: 'Software', confidence: 'high', evidence: 'subscription brand' },
      accountType: { value: 'Other', confidence: 'none', evidence: '' },
    });
    const user = userEvent.setup();

    render(
      <ReceiptImportModal
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Google One $1.99 Start date: 12/11/2026' },
    });
    await user.click(screen.getByRole('button', { name: 'Extract Receipt' }));

    const categorySelect = (await screen.findByLabelText('Category')) as HTMLSelectElement;
    const accountTypeSelect = screen.getByLabelText('Account type') as HTMLSelectElement;
    expect(categorySelect.value).toBe('Software');
    expect(accountTypeSelect.value).toBe('Other');
    expect(
      screen.getByText(
        'We could not read all the information clearly, so they are blank. Please check to fill it out.'
      )
    ).toBeInTheDocument();
  });

  it('shows the blank-fields warning only when a required review field is actually blank', async () => {
    mockExtraction = buildExtraction({
      paymentDate: { value: null, confidence: 'none', evidence: '' },
      nextBillingDate: { value: null, confidence: 'none', evidence: '' },
    });
    const user = userEvent.setup();

    render(
      <ReceiptImportModal
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Netflix 15.99 monthly' },
    });
    await user.click(screen.getByRole('button', { name: 'Extract Receipt' }));

    await screen.findByRole('button', { name: 'Add Subscription' });
    expect(
      screen.getByText(/We could not read all the information clearly, so they are blank/i)
    ).toBeInTheDocument();
  });
});
