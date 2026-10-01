import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SubscriptionRow } from '@/lib/services/subscription-service';
import { MostExpensivePlanCard } from '@/components/dashboard/most-expensive-plan-card';

vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
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
    next_billing_date: '2026-10-14',
    notes: '',
    provider_url: 'https://netflix.com',
    account_links: [],
    ...over,
  }) as SubscriptionRow;

describe('MostExpensivePlanCard', () => {
  it('shows only the name and the amount, with no category or renewal date', () => {
    // The container used to render "Streaming • Renews 2026-10-14" under the
    // name, duplicating what the Subscriptions page already shows.
    render(<MostExpensivePlanCard subscriptions={[sub()]} />);

    expect(screen.getByText('Netflix')).toBeInTheDocument();
    expect(screen.getByText(/\$15\.99/)).toBeInTheDocument();
    expect(screen.queryByText('Streaming')).not.toBeInTheDocument();
    expect(screen.queryByText(/Renews/)).not.toBeInTheDocument();
    expect(screen.queryByText(/2026-10-14/)).not.toBeInTheDocument();
  });

  it('does not show a percentage-of-spend badge', () => {
    render(<MostExpensivePlanCard subscriptions={[sub()]} />);

    expect(screen.queryByText(/% of monthly spend/)).not.toBeInTheDocument();
    expect(screen.queryByText(/% of spend/)).not.toBeInTheDocument();
  });

  it('renders Manage Plan as a plain highlight link rather than a filled button', () => {
    render(<MostExpensivePlanCard subscriptions={[sub()]} />);

    const link = screen.getByRole('link', { name: 'Manage Plan' });
    expect(link).toHaveAttribute('href', '/subscriptions?highlight=sub-1');
    // A button look comes from a solid fill and a border; the inline highlight
    // must not carry either.
    expect(link.className).not.toContain('bg-[#14B8A6]');
    expect(link.className).not.toMatch(/\bborder\b/);
    expect(link.className).toContain('text-[#14B8A6]');
  });

  it('keeps name, amount and the manage link on a single line', () => {
    render(<MostExpensivePlanCard subscriptions={[sub()]} />);

    const link = screen.getByRole('link', { name: 'Manage Plan' });
    const row = link.parentElement as HTMLElement;
    expect(row).not.toBeNull();
    // A single flex row, and nothing wrapping to a second line.
    expect(row.className).toContain('flex');
    expect(row.className).toContain('items-center');
    expect(row.className).not.toContain('flex-wrap');
    expect(row.className).not.toContain('flex-col');
  });

  it('lists every tied plan the same way', () => {
    render(
      <MostExpensivePlanCard
        subscriptions={[sub(), sub({ id: 'sub-2', name: 'Spotify' })]}
      />
    );

    expect(screen.getByText('Most Expensive Plans')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Manage Plan' })).toHaveLength(2);
    expect(screen.queryByText(/% of spend/)).not.toBeInTheDocument();
  });

  it('shows the normalized monthly amount only when it differs from the price', () => {
    const { unmount } = render(
      <MostExpensivePlanCard subscriptions={[sub({ price: 120, billing_cycle: 'yearly' })]} />
    );
    expect(screen.getByText(/\$120/)).toBeInTheDocument();
    expect(screen.getByText(/\$10\.00 mo/)).toBeInTheDocument();
    unmount();

    // A monthly plan whose price already is the monthly figure: no duplicate.
    render(<MostExpensivePlanCard subscriptions={[sub()]} />);
    expect(screen.queryByText(/ mo$/)).not.toBeInTheDocument();
  });

  it('keeps the list view horizontally scrollable but hides the scrollbar chrome', () => {
    // Regression: the mobile list view showed a horizontal scrollbar under the
    // rows. It must still scroll, so `overflow-x: auto` has to stay.
    const css = readFileSync(join(process.cwd(), 'app', 'globals.css'), 'utf8');
    const at = css.indexOf('.table-scroll {');
    expect(at).toBeGreaterThan(-1);

    const block = css.slice(at, css.indexOf('}', at));
    expect(block).toContain('overflow-x: auto');
    expect(block).toContain('scrollbar-width: none');
    expect(css).toContain('.table-scroll::-webkit-scrollbar');
  });
});
