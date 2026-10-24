import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { SubscriptionRow } from '@/lib/services/subscription-service';
import { DashboardOverviewCard } from '@/components/dashboard/dashboard-overview-card';

vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

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

const sub = (over: Partial<SubscriptionRow> = {}): SubscriptionRow =>
  ({
    id: 'sub-1',
    name: 'Netflix',
    price: 15.99,
    currency: 'USD',
    billing_cycle: 'monthly',
    category: 'Streaming',
    status: 'active',
    next_billing_date: '2026-10-05',
    notes: '',
    provider_url: 'https://netflix.com',
    account_links: [],
    ...over,
  }) as SubscriptionRow;

const props = (subs: SubscriptionRow[]) => ({
  subscriptions: subs,
  activeSubscriptions: subs,
  onReviewSubscription: vi.fn(),
  onSeeSavings: vi.fn(),
  onAskSubHalt: vi.fn(),
});

const SECTION_TITLES = [
  'Upcoming Renewals',
  'Most Expensive Plan',
  'Savings Recommendations',
  'Spending by Category',
];

const surfaces = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>('[class*="rounded-[20px]"]'));

const surfaceContaining = (container: HTMLElement, title: string) => {
  const surface = surfaces(container).find((el) => el.textContent?.includes(title));
  expect(surface, `no surface contains "${title}"`).toBeTruthy();
  return surface as HTMLElement;
};

describe('DashboardOverviewCard', () => {
  it('renders all four sections', () => {
    render(<DashboardOverviewCard {...props([sub()])} />);

    for (const title of SECTION_TITLES) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
  });

  it('gives upcoming renewals its own full-width surface above the second row', () => {
    // Renewals is a standalone card spanning the full grid, not a quadrant of a
    // 2x2 — it needs the whole width for its name/status/price columns.
    const { container } = render(<DashboardOverviewCard {...props([sub()])} />);

    expect(surfaces(container)).toHaveLength(3);

    const renewals = surfaceContaining(container, 'Upcoming Renewals');
    for (const title of ['Most Expensive Plan', 'Savings Recommendations', 'Spending by Category']) {
      expect(renewals.textContent).not.toContain(title);
    }

    const parent = renewals.parentElement as HTMLElement;
    expect(parent).toBe(container.firstElementChild);
    expect(parent.className).toContain('space-y');
    // Not a grid: renewals is its own row, with the two-up row as a sibling.
    expect(parent.querySelectorAll(':scope > div')).toHaveLength(2);
  });

  it('puts most expensive plan and savings recommendations in one left-hand surface', () => {
    const { container } = render(<DashboardOverviewCard {...props([sub()])} />);

    const left = surfaceContaining(container, 'Most Expensive Plan');
    expect(left.textContent).toContain('Savings Recommendations');
    expect(left.textContent).not.toContain('Spending by Category');

    const row = left.parentElement as HTMLElement;
    expect(row.className).toContain('lg:grid-cols-2');
    // Left first, spending-by-category second.
    const cells = Array.from(row.children);
    expect(cells).toHaveLength(2);
    expect(cells[1].textContent).toContain('Spending by Category');
  });

  it('lets both cards in the two-up row stretch to the same height', () => {
    // The category card is shorter than most-expensive + savings, so the row
    // must not use items-start; without stretching they render mismatched.
    const { container } = render(<DashboardOverviewCard {...props([sub()])} />);

    const left = surfaceContaining(container, 'Most Expensive Plan');
    const row = left.parentElement as HTMLElement;

    expect(row.className).not.toContain('items-start');
    expect(row.className).not.toContain('items-stretch');
  });

  it('still shows the Most Expensive Plan heading when there are no active subscriptions', () => {
    render(<DashboardOverviewCard {...props([])} />);

    expect(screen.getByText('Most Expensive Plan')).toBeInTheDocument();
  });
});
