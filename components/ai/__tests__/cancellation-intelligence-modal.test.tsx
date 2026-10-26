import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SubscriptionRow } from '@/lib/services/subscription-service';
import {
  CancellationIntelligenceModal,
  buildSavingRecommendations,
} from '@/components/ai/cancellation-intelligence-modal';

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

describe('CancellationIntelligenceModal (savings detail)', () => {
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
  });

  it('suggests switching to annual billing for a monthly service', () => {
    renderModal();

    expect(screen.getByText('Savings Intelligence')).toBeInTheDocument();
    expect(screen.getByText(/Save up to \$4\.50\/mo/)).toBeInTheDocument();
    expect(
      screen.getByText(/discount annual plans by 15–20%/)
    ).toBeInTheDocument();
  });

  it('links straight to the provider site to switch plans instead of leading with cancellation', () => {
    renderModal();

    const link = screen.getByRole('link', { name: /Switch on provider site/i });
    expect(link).toHaveAttribute('href', 'https://www.netflix.com/youraccount');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('recommends downgrading to a stored cheaper tier with real figures', () => {
    renderModal({ cheaper_plan_name: 'Basic Plan', cheaper_plan_price: 12 });

    expect(screen.getByText(/Save \$18\.00\/mo/)).toBeInTheDocument(); // 30 - 12
    expect(screen.getByText(/switch.*Netflix.*to the “Basic Plan” plan/i)).toBeInTheDocument();
    expect(screen.queryByText(/Estimated saving/)).not.toBeInTheDocument();  });

  it('shows nothing rather than a cancel pitch when no saving recommendation applies', () => {
    // $9.99/mo is below the annual-suggestion floor and no cheaper tier is stored.
    renderModal({ price: 9.99, name: 'Cheap Service' });

    expect(screen.getByText('No saving recommendation right now')).toBeInTheDocument();
    expect(screen.queryByText(/Potential Monthly Savings/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Switch on provider site/i })).not.toBeInTheDocument();
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

    await user.click(screen.getByRole('link', { name: /Switch on provider site/i }));

    expect(screen.getByRole('button', { name: 'Keep it' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm Canceled/ })).toBeInTheDocument();
  });
});

describe('buildSavingRecommendations', () => {
  it('produces an annual-swap estimate for a monthly sub above the floor', () => {
    const items = buildSavingRecommendations(sub(), 'USD');
    expect(items[0].type).toBe('annual-swap');
    expect(items[0].estimate).toBe(true);
    expect(items[0].monthlySavings).toBeCloseTo(30 * 0.15);
    expect(items[0].actionUrl).toBe('https://www.netflix.com/youraccount');
  });

  it('does not recommend annual swap below the floor or for yearly billing', () => {
    expect(
      buildSavingRecommendations(sub({ price: 9.99 }), 'USD')
    ).toHaveLength(0);
    expect(
      buildSavingRecommendations(sub({ price: 300, billing_cycle: 'yearly' }), 'USD')
    ).toHaveLength(0);
  });

  it('produces an exact downgrade recommendation only when both halves are stored', () => {
    const withPlan = buildSavingRecommendations(
      sub({ cheaper_plan_name: 'Basic', cheaper_plan_price: 12 }),
      'USD'
    );
    expect(withPlan[0].type).toBe('downgrade');
    expect(withPlan[0].estimate).toBe(false);
    expect(withPlan[0].monthlySavings).toBeCloseTo(30 - 12);

    const withoutPlan = buildSavingRecommendations(sub({ price: 30 }), 'USD');
    const downgrade = withoutPlan.find((i) => i.type === 'downgrade');
    expect(downgrade).toBeUndefined();
  });

  it('sorts by savings, biggest first', () => {
    const items = buildSavingRecommendations(
      sub({ cheaper_plan_name: 'Basic', cheaper_plan_price: 5 }),
      'USD'
    );
    // downgrade saving $25/mo beats annual-swap $4.50/mo
    expect(items[0].type).toBe('downgrade');
    expect(items[0].monthlySavings).toBeCloseTo(25);
  });
});
