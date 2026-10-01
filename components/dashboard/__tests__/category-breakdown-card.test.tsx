import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { SubscriptionRow } from '@/lib/services/subscription-service';
import { CategoryBreakdownCard } from '@/components/dashboard/category-breakdown-card';

vi.mock('@/lib/contexts/user-settings-context', () => ({
  useCurrency: () => ({
    defaultCurrency: 'USD',
    currencies: ['USD'],
    loading: false,
    updateDefaultCurrency: vi.fn(),
  }),
}));

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
    provider_url: 'https://netflix.com',
    account_links: [],
    ...over,
  }) as SubscriptionRow;

const renderCard = (subs: SubscriptionRow[], isEmbedded = false) =>
  render(<CategoryBreakdownCard subscriptions={subs} isEmbedded={isEmbedded} />);

describe('CategoryBreakdownCard', () => {
  it('shows the empty state when nothing is active', () => {
    renderCard([]);

    expect(screen.getByText('No active category spending')).toBeInTheDocument();
    expect(screen.queryByText('Total Monthly')).not.toBeInTheDocument();
  });

  it('renders the total inside the donut hole, capped to the inner diameter', () => {
    const { container } = renderCard([sub()]);

    expect(screen.getByText('Total Monthly')).toBeInTheDocument();
    expect(screen.getByText('1 category')).toBeInTheDocument();

    // The centre block is limited to 62% of the 180-unit box, which sits inside
    // the 118-unit inner diameter left by r=68 with an 18px stroke. Scoped to
    // the centre because the same total also appears in the breakdown list.
    const center = screen.getByText('Total Monthly').parentElement as HTMLElement;
    expect(
      Array.from(center.children).some((el) => el.textContent === '$25.99')
    ).toBe(true);
    expect(center.className).toContain('w-[62%]');

    // The three lines truncate rather than wrapping out through the ring.
    for (const line of center.children) {
      expect(line.className).toContain('truncate');
    }

    // Nothing in the centre is allowed to swallow pointer events.
    const overlay = center.parentElement as HTMLElement;
    expect(overlay.className).toContain('pointer-events-none');
    expect(container.querySelectorAll('svg circle').length).toBeGreaterThan(0);
  });

  it('steps the amount down in size as the figure gets longer', () => {
    /* The same formatted total also appears in the breakdown list, so scope the
       lookup to the donut centre. */
    const centerAmount = (label: string) => {
      const center = screen.getByText('Total Monthly').parentElement as HTMLElement;
      const match = Array.from(center.children).find((el) => el.textContent === label);
      expect(match).toBeDefined();
      return match as HTMLElement;
    };

    const { unmount } = renderCard([sub({ price: 9, category: 'A' })]);
    expect(centerAmount('$9.00').className).toContain('text-lg');
    unmount();

    renderCard([
      sub({ id: 'a', price: 9, category: 'A' }),
      sub({ id: 'b', price: 40000, category: 'B' }),
    ]);
    const long = centerAmount('$40,009.00').className;

    // Ten characters is past the first threshold, so the long figure drops a
    // step and still truncates rather than wrapping out through the ring.
    expect(long).toContain('text-base');
    expect(long).toContain('truncate');
  });

  it('keeps the total readable in the embedded dashboard layout', () => {
    renderCard([sub(), sub({ id: 'sub-2', name: 'Spotify', price: 11, category: 'Audio' })], true);

    const center = screen.getByText('Total Monthly').parentElement as HTMLElement;
    expect(
      Array.from(center.children).some((el) => el.textContent === '$36.99')
    ).toBe(true);
    expect(
      Array.from(center.children).some((el) => el.textContent === '2 categories')
    ).toBe(true);
  });
});
