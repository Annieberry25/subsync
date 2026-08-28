import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  toBillPaymentInsert,
  updateBillPayment,
  deleteBillPayment,
  type BillPaymentRow,
} from '@/lib/services/bills-service';
import type { BillPayment } from '@/lib/types/bills.types';
import { getVerifiedProvider } from '@/lib/constants/verified-providers';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://placeholder.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';

const mocks = vi.hoisted(() => {
  let queue: unknown[] = [];

  const chain = {
    then: (resolve: (value: unknown) => void, reject: (reason?: unknown) => void) => {
      const next = queue.shift();
      if (next === undefined) {
        resolve({ data: null, error: null });
      } else if (next instanceof Error) {
        reject(next);
      } else {
        resolve(next);
      }
    },
    eq: vi.fn(function (...args: unknown[]) {
      void args;
      return chain;
    }),
    order: vi.fn(function (...args: unknown[]) {
      void args;
      return chain;
    }),
    single: vi.fn(function (...args: unknown[]) {
      void args;
      return chain;
    }),
    select: vi.fn(function (...args: unknown[]) {
      void args;
      return chain;
    }),
    insert: vi.fn(function (...args: unknown[]) {
      void args;
      return chain;
    }),
    update: vi.fn(function (...args: unknown[]) {
      void args;
      return chain;
    }),
    delete: vi.fn(function (...args: unknown[]) {
      void args;
      return chain;
    }),
  };

  const client = {
    from: vi.fn(function (table: unknown) {
      void table;
      return chain;
    }),
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user_1' } } })),
    },
  };

  return {
    chain,
    client,
    setResult(value: unknown) {
      queue = [value];
    },
    setResults(values: unknown[]) {
      queue = [...values];
    },
  };
});

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mocks.client,
}));

function makeBillRow(overrides: Partial<BillPaymentRow> = {}): BillPaymentRow {
  return {
    id: 'bp_1',
    user_id: 'user_1',
    category: 'Electricity',
    custom_category: null,
    provider_name: 'Ikeja Electric (IKEDC)',
    amount: 30000,
    currency: 'NGN',
    payment_date: '2026-08-26',
    country: 'Nigeria',
    region: 'Lagos',
    city: 'Ikeja',
    payment_frequency: 'monthly',
    is_recurring: true,
    notes: null,
    receipts: [],
    source: 'manual',
    provider_reference: 'IKEDC-123',
    official_provider_url: 'https://www.ikejaelectric.com/pay',
    status: 'paid',
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-26T00:00:00.000Z',
    ...overrides,
  };
}

function makeLocalBill(overrides: Partial<BillPayment> = {}): BillPayment {
  return {
    id: 'bp_local',
    userId: 'user_1',
    category: 'Electricity',
    customCategory: null,
    providerName: 'Ikeja Electric (IKEDC)',
    amount: 25000,
    currency: 'NGN',
    paymentDate: '2026-08-01',
    country: 'Nigeria',
    region: 'Lagos',
    city: 'Ikeja',
    paymentFrequency: 'monthly',
    isRecurring: true,
    notes: null,
    receipts: [],
    source: 'manual',
    providerReference: 'IKEDC-123',
    officialProviderUrl: 'https://www.ikejaelectric.com/pay',
    status: 'paid',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe('toBillPaymentInsert', () => {
  it('maps camelCase fields to snake_case fields', () => {
    const out = toBillPaymentInsert({
      category: 'Electricity',
      providerName: 'IKEDC Light',
      amount: 2500,
      customCategory: null,
      status: 'paid',
    });

    expect(out).toEqual({
      category: 'Electricity',
      provider_name: 'IKEDC Light',
      amount: 2500,
      custom_category: null,
      status: 'paid',
    });
  });

  it('omits fields that are undefined', () => {
    const out = toBillPaymentInsert({ category: 'Internet' });

    expect(out).toEqual({ category: 'Internet' });
  });
});

describe('updateBillPayment', () => {
  it('returns the transformed row on success', async () => {
    mocks.setResult({ data: makeBillRow(), error: null });

    const result = await updateBillPayment('bp_1', { amount: 30000 });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe('bp_1');
    expect(result.data?.amount).toBe(30000);
    expect(result.data?.providerName).toBe('Ikeja Electric (IKEDC)');
    expect(result.data?.category).toBe('Electricity');
    expect(mocks.chain.update).toHaveBeenCalled();
  });

  it('falls back to local storage when the DB returns an error', async () => {
    const local = makeLocalBill();
    window.localStorage.setItem('subsync_bill_payments', JSON.stringify([local]));
    mocks.setResult({ data: null, error: { message: 'update fail' } });

    const result = await updateBillPayment('bp_local', { amount: 123 });

    expect(mocks.chain.update).toHaveBeenCalled();
    expect(result.error).toBeNull();
    expect(result.data?.id).toBe('bp_local');
    expect(result.data?.amount).toBe(123);
  });
});

describe('deleteBillPayment', () => {
  it('surfaces the DB error', async () => {
    mocks.setResult({ error: { message: 'nope' } });

    const result = await deleteBillPayment('bp_1');

    expect(result.error?.message).toContain('nope');
  });

  it('returns a null error on success', async () => {
    mocks.setResult({ error: null });

    const result = await deleteBillPayment('bp_1');

    expect(result.error).toBeNull();
  });
});

describe('getVerifiedProvider', () => {
  it('returns a matching verified provider from the constants table', () => {
    const provider = getVerifiedProvider('Ikeja Electric (IKEDC)');

    expect(provider).not.toBeNull();
    expect(provider?.name).toBe('Ikeja Electric (IKEDC)');
    expect(provider?.category).toBe('Electricity');
    expect(provider?.verificationStatus).toBe('verified');
  });

  it('returns null for an unknown provider', () => {
    expect(getVerifiedProvider('zzzz nonexistent provider')).toBeNull();
  });
});