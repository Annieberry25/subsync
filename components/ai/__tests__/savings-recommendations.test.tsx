import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SubscriptionRow } from '@/lib/services/subscription-service';
import { SavingsRecommendationsSection } from '@/components/ai/savings-recommendations';

vi.mock('@/lib/supabase/client', () => ({
  supabase: { auth: { getUser: vi.fn() }, from: vi.fn(() => ({ select: vi.fn() })) },
  default: { auth: { getUser: vi.fn() }, from: vi.fn(() => ({ select: vi.fn() })) },
}));

vi.mock('@/lib/contexts/user-settings-context', () => ({
  useCurrency: () => ({
    defaultCurrency: 'USD',
    currencies: ['USD'],
    loading: false,
    updateDefaultCurrency: vi.fn(),
  }),
}));

// $25.99/mo clears the $20 "high-cost" threshold, and the far-out renewal date
// stays clear of the 7-day window, so exactly one recommendation is generated.
const sub = (over: Partial<SubscriptionRow> = {}): SubscriptionRow =>
  ({
    id: 'sub-1',
    name: 'Netflix',
    price: 25.99,
    currency: 'USD',
    billing_cycle: 'monthly',
    category: 'Streaming',
    status: 'active',
    next_billing_date: '2026-12-15',
    notes: '',
    provider_url: 'https://netflix.com',
    account_links: [],
    ...over,
  }) as SubscriptionRow;

const handlers = () => ({
  onReviewSubscription: vi.fn(),
  onSeeSavings: vi.fn(),
  onAskSubHalt: vi.fn(),
});

const toggle = () => screen.getByRole('button', { name: /savings recommendations/i });

const renderSection = (subs: SubscriptionRow[], h = handlers()) => {
  render(
    <SavingsRecommendationsSection
      subscriptions={subs}
      activeSubscriptions={subs}
      {...h}
    />
  );
  // The section now starts collapsed; most specs below assert on its contents.
  fireEvent.click(toggle());
  return h;
};

describe('SavingsRecommendationsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has no Ask SubHalt button in the section header', () => {
    const { container } = render(
      <SavingsRecommendationsSection
        subscriptions={[sub()]}
        activeSubscriptions={[sub()]}
        {...handlers()}
      />
    );

    const header = container.firstElementChild?.firstElementChild as HTMLElement;
    expect(header.textContent).toContain('Savings Recommendations');
    // The header now only carries the dropdown, not an ask button.
    expect(header.textContent).not.toContain('Ask SubHalt');
  });

  it('has no horizontal rule under the title', () => {
    const { container } = render(
      <SavingsRecommendationsSection
        subscriptions={[sub()]}
        activeSubscriptions={[sub()]}
        {...handlers()}
      />
    );

    const header = container.firstElementChild?.firstElementChild as HTMLElement;
    expect(header.className).not.toContain('border-b');
  });

  it('stacks the amount pill between the title and the description', () => {
    // The white "Save $X/mo" pill has been replaced by a large bold headline.
    render(
      <SavingsRecommendationsSection
        subscriptions={[sub()]}
        activeSubscriptions={[sub()]}
        {...handlers()}
      />
    );
    fireEvent.click(toggle());

    expect(screen.queryByText('Save $25.99/mo')).not.toBeInTheDocument();
    expect(screen.getByText('Save up to $25.99/mo')).toBeInTheDocument();
  });

  it('drops the "High-Cost Subscription:" prefix and labels the service from data', () => {
    render(
      <SavingsRecommendationsSection
        subscriptions={[sub({ name: 'ChatGPT' })]}
        activeSubscriptions={[sub({ name: 'ChatGPT' })]}
        {...handlers()}
      />
    );
    fireEvent.click(toggle());

    expect(screen.queryByText(/High-Cost Subscription/)).not.toBeInTheDocument();
    expect(screen.getByText('ChatGPT')).toBeInTheDocument();

    // The service label sits next to the provider icon, and is small/muted.
    const label = screen.getByText('ChatGPT');
    const row = label.parentElement as HTMLElement;
    expect(row.querySelector('img')).toBeInTheDocument();
    expect(label.className).toContain('text-xs');
    expect(label.className).toContain('text-[#94A3B8]');

    // The headline is large and bold, and comes from the data.
    const headline = screen.getByText('Save up to $25.99/mo');
    expect(headline.className).toContain('text-xl');
    expect(headline.className).toContain('font-bold');
  });

  it('derives the headline from the billed price, not a hardcoded amount', () => {
    // Yearly $300 => $25/mo normalized, so the headline must not read $300.
    render(
      <SavingsRecommendationsSection
        subscriptions={[sub({ price: 300, billing_cycle: 'yearly' })]}
        activeSubscriptions={[sub({ price: 300, billing_cycle: 'yearly' })]}
        {...handlers()}
      />
    );
    fireEvent.click(toggle());

    expect(screen.getByText('Save up to $25.00/mo')).toBeInTheDocument();
    expect(screen.queryByText(/Save up to \$300/)).not.toBeInTheDocument();
  });

  it('makes Ask SubHalt the white primary action', () => {
    render(
      <SavingsRecommendationsSection
        subscriptions={[sub()]}
        activeSubscriptions={[sub()]}
        {...handlers()}
      />
    );
    fireEvent.click(toggle());

    const ask = screen.getByRole('button', { name: 'Ask SubHalt' });
    expect(ask.className).toContain('bg-[#F5F7F6]');
    expect(ask.className).toContain('text-[#091512]');
  });

  it('no longer carries a Review subscription button', () => {
    // Review moved into the Savings Intelligence sheet as a plain link.
    renderSection([sub()]);

    expect(screen.queryByRole('button', { name: 'Review subscription' })).not.toBeInTheDocument();
  });

  it('starts collapsed and the borderless chevron toggles the list', async () => {
    const user = userEvent.setup();
    render(
      <SavingsRecommendationsSection
        subscriptions={[sub()]}
        activeSubscriptions={[sub()]}
        {...handlers()}
      />
    );

    const button = toggle();
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-controls', 'savings-recommendations-list');
    expect(screen.queryByText('Save up to $25.99/mo')).not.toBeInTheDocument();

    await user.click(button);

    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(toggle()).toHaveAttribute('aria-controls', 'savings-recommendations-list');
    expect(screen.getByText('Save up to $25.99/mo')).toBeInTheDocument();

    await user.click(toggle());

    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Save up to $25.99/mo')).not.toBeInTheDocument();
  });

  it('replaces See savings with an eye icon button labelled for assistive tech', async () => {
    const user = userEvent.setup();
    const h = renderSection([sub()]);

    // The label is exposed via aria-label and a hover tooltip rather than as
    // visible button text.
    expect(screen.queryByRole('button', { name: 'See savings' })).toBeInTheDocument();
    expect(screen.queryByText('See savings')).toBeInTheDocument();
    expect(screen.getByRole('tooltip')).toHaveTextContent('See savings');

    await user.click(screen.getByRole('button', { name: 'See savings' }));
    expect(h.onSeeSavings).toHaveBeenCalledTimes(1);
  });

  it('hides the service name until the card is hovered or focused', () => {
    renderSection([sub({ name: 'ChatGPT' })]);

    const label = screen.getByText('ChatGPT');
    const labelRow = label.parentElement as HTMLElement;
    expect(labelRow.className).toContain('opacity-0');
    expect(labelRow.className).toContain('group-hover/item:opacity-100');
    expect(labelRow.className).toContain('group-focus-within/item:opacity-100');

    // The card itself is the hover target.
    const card = label.closest('[class*="group/item"]') as HTMLElement;
    expect(card).toBeInTheDocument();

    // The headline and description are always visible, not gated on hover.
    expect(screen.getByText('Save up to $25.99/mo')).toBeVisible();
  });

  it('always shows the eye button and reveals only its label on hover', async () => {
    const user = userEvent.setup();
    renderSection([sub()]);

    // The icon is a resting affordance, not a hover reveal — hiding it made the
    // action undiscoverable. Only the tooltip hides.
    const eye = screen.getByRole('button', { name: 'See savings' });
    const wrapper = eye.parentElement as HTMLElement;
    expect(wrapper.className).not.toContain('opacity-0');
    expect(wrapper.className).toContain('group');

    const tooltip = screen.getByRole('tooltip');
    // `invisible` as well as `opacity-0`: a transparent-only label can still
    // paint over the headline, which is what made it look permanently shown.
    expect(tooltip.className).toContain('opacity-0');
    expect(tooltip.className).toContain('invisible');
    expect(tooltip.className).toContain('group-hover:opacity-100');
    expect(tooltip.className).toContain('group-hover:visible');
    expect(tooltip.className).toContain('group-focus-within:opacity-100');
    expect(tooltip.className).toContain('group-focus-within:visible');

    await user.hover(eye);
    expect(tooltip.className).toContain('group-hover:visible');
  });

  it('keeps the eye button and Ask SubHalt in the action row', async () => {
    const user = userEvent.setup();
    const h = renderSection([sub()]);

    const askButtons = screen.getAllByRole('button', { name: 'Ask SubHalt' });
    expect(askButtons).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'See savings' }));
    expect(h.onSeeSavings).toHaveBeenCalledTimes(1);

    await user.click(askButtons[0]);
    expect(h.onAskSubHalt).toHaveBeenCalledTimes(1);
  });
});
