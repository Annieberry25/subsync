import { describe, it, expect } from 'vitest';
import { buildAiUserContext, renderUserContext } from '@/lib/ai/context';
import type { Database } from '@/lib/types/database.types';

type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row'];
type BillPaymentRow = Database['public']['Tables']['bill_payments']['Row'];

const profile = {
  id: 'user_1',
  email: 'jane@example.com',
  full_name: 'Jane',
  avatar_url: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
} satisfies Database['public']['Tables']['profiles']['Row'];

const subscription: SubscriptionRow = {
  id: 'sub_1',
  user_id: 'user_1',
  name: 'Netflix',
  price: 15.99,
  currency: 'USD',
  billing_cycle: 'monthly',
  category: 'Streaming',
  status: 'active',
  start_date: '2026-01-01',
  next_billing_date: '2026-09-15',
  payment_method: 'Card',
  provider_url: 'https://www.netflix.com/youraccount',
  notes: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const bill: BillPaymentRow = {
  id: 'bill_1',
  user_id: 'user_1',
  category: 'Electricity',
  custom_category: null,
  provider_name: 'Ikeja Electric (IKEDC)',
  amount: 25000,
  currency: 'NGN',
  payment_date: '2026-08-20',
  country: 'Nigeria',
  region: 'Lagos',
  city: 'Ikeja',
  payment_frequency: 'monthly',
  is_recurring: true,
  notes: null,
  receipts: [],
  source: 'manual',
  provider_reference: null,
  official_provider_url: 'https://www.ikejaelectric.com/pay',
  status: 'paid',
  created_at: '2026-08-20T00:00:00Z',
  updated_at: '2026-08-20T00:00:00Z',
};

describe('buildAiUserContext', () => {
  it('flags no data when lists are empty', () => {
    const ctx = buildAiUserContext({ profile, subscriptions: [], bills: [] });
    expect(ctx.hasData).toBe(false);
    expect(ctx.subscriptions).toHaveLength(0);
    expect(ctx.bills).toHaveLength(0);
    expect(ctx.summaryText).toBe('');
  });

  it('summarizes subscriptions and bills into a compact snapshot', () => {
    const ctx = buildAiUserContext({ profile, subscriptions: [subscription], bills: [bill] });

    expect(ctx.hasData).toBe(true);
    expect(ctx.profile?.email).toBe('jane@example.com');
    expect(ctx.subscriptions[0]).toMatchObject({
      name: 'Netflix',
      price: 15.99,
      currency: 'USD',
      billingCycle: 'monthly',
      status: 'active',
    });
    expect(ctx.bills[0]).toMatchObject({
      providerName: 'Ikeja Electric (IKEDC)',
      amount: 25000,
      currency: 'NGN',
      isRecurring: true,
      country: 'Nigeria',
    });
    expect(ctx.summaryText).toContain('1 active subscription');
    expect(ctx.summaryText).toContain('1 bill payment');
    expect(ctx.summaryText).toContain('1 recurring bill');
  });

  it('computes monthly commitment only for active subscriptions', () => {
    const yearly = { ...subscription, id: 'sub_2', name: 'Office 365', price: 240, currency: 'USD', billing_cycle: 'yearly' as const };
    const canceled = { ...subscription, id: 'sub_3', name: 'Spotify', status: 'canceled' as const };
    const ctx = buildAiUserContext({ profile, subscriptions: [subscription, yearly, canceled], bills: [] });

    // 15.99 + (240/12) = 35.99
    expect(ctx.summaryText).toContain('35.99');
    expect(ctx.subscriptions).toHaveLength(3);
  });
});

describe('renderUserContext', () => {
  it('returns empty string when nothing is tracked', () => {
    const ctx = buildAiUserContext({ profile, subscriptions: [], bills: [] });
    expect(renderUserContext(ctx)).toBe('');
  });

  it('renders readable lines for prompt consumption', () => {
    const ctx = buildAiUserContext({ profile, subscriptions: [subscription], bills: [bill] });
    const rendered = renderUserContext(ctx);

    expect(rendered).toContain('Subscriptions (1):');
    expect(rendered).toContain('Netflix | 15.99 USD/monthly');
    expect(rendered).toContain('Bills & payments (1 most recent):');
    expect(rendered).toContain('Ikeja Electric (IKEDC) | 25000 NGN');
    expect(rendered).toContain('https://www.ikejaelectric.com/pay');
  });
});