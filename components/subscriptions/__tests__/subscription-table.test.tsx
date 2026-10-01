import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SubscriptionRow } from '@/lib/services/subscription-service';
import SubscriptionTable from '@/components/subscriptions/subscription-table';

vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

// The table pulls in the service layer, which reaches Supabase and validates
// env vars at import time. This suite is about markup, not persistence.
vi.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: { auth: { getUser: vi.fn() }, from: vi.fn(() => ({ select: vi.fn() })) },
  default: { auth: { getUser: vi.fn() }, from: vi.fn(() => ({ select: vi.fn() })) },
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
    notes: 'Standard plan',
    provider_url: 'https://netflix.com',
    account_links: [],
    ...over,
  }) as SubscriptionRow;

function renderTable(rows: SubscriptionRow[] = [sub()]) {
  return render(
    <SubscriptionTable
      subscriptions={rows}
      onSelectSubscription={vi.fn()}
      onEdit={vi.fn()}
      onDeleteRequest={vi.fn()}
      onPaymentReminderRequest={vi.fn()}
    />
  );
}

describe('SubscriptionTable', () => {
  it('renders a row for every subscription', () => {
    renderTable([sub(), sub({ id: 'sub-2', name: 'Spotify' }), sub({ id: 'sub-3', name: 'GitHub Pro' })]);

    const body = screen.getAllByRole('rowgroup')[1];
    expect(within(body).getAllByRole('row')).toHaveLength(3);
    expect(within(body).getByText('Netflix')).toBeInTheDocument();
    expect(within(body).getByText('Spotify')).toBeInTheDocument();
    expect(within(body).getByText('GitHub Pro')).toBeInTheDocument();
  });

  it('renders the header and body in the same table', () => {
    // Regression guard: the header and rows must live in one table so the
    // header can never be visually separated from the data it labels.
    const { container } = renderTable();
    expect(container.querySelectorAll('table')).toHaveLength(1);
    expect(screen.getByRole('columnheader', { name: 'Provider' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: /Netflix/ })).toBeInTheDocument();
  });

  it('does not offset the sticky header by the app header height', () => {
    // Regression: the thead was `sticky top-(--spacing-header)`. The table
    // lives inside `.table-scroll` (overflow-x: auto), which is itself a
    // scroll container, so that 56/64px offset was applied inside the table
    // and pushed the header down over the body rows — the header stayed
    // visible while every subscription underneath it was hidden.
    const { container } = renderTable();
    const thead = container.querySelector('thead');
    const className = thead?.getAttribute('class') ?? '';
    expect(className).toContain('sticky');
    expect(className).toContain('top-0');
    expect(className).not.toContain('spacing-header');
  });

  it('pins the provider column in both the header and the body', () => {
    const { container } = renderTable();
    const headerCell = container.querySelector('thead .table-sticky-col');
    const bodyCell = container.querySelector('tbody .table-sticky-col');
    expect(headerCell).not.toBeNull();
    expect(bodyCell).not.toBeNull();
  });

  it('shows the subscription content the user added', () => {
    renderTable([sub({ name: 'Spotify', price: 11.99, notes: 'Duo plan', category: 'Music' })]);

    const body = screen.getAllByRole('rowgroup')[1];
    const row = within(body).getByRole('row');
    expect(within(row).getByText('Spotify')).toBeInTheDocument();
    expect(within(row).getByText('Duo plan')).toBeInTheDocument();
    expect(within(row).getByText('Music')).toBeInTheDocument();
    expect(within(row).getByText(/\$11\.99/)).toBeInTheDocument();
  });

  it('does not draw a divider between the provider column and the rest', () => {
    // `.table-sticky-col::after` used to paint a 1px vertical rule down the
    // right edge of the pinned column. The styling lives in globals.css, and
    // jsdom does not apply the cascade, so assert on the source itself.
    const css = readFileSync(join(process.cwd(), 'app', 'globals.css'), 'utf8');
    expect(css).not.toContain('.table-sticky-col::after');
  });

  it('pins the provider column at every width, not just >=768px', () => {
    // The mobile list view scrolls horizontally and depends on the name staying
    // anchored, so the sticky rule must not sit inside a min-width media query.
    const css = readFileSync(join(process.cwd(), 'app', 'globals.css'), 'utf8');
    const at = css.indexOf('.table-sticky-col {');
    expect(at).toBeGreaterThan(-1);

    const preceding = css.slice(Math.max(0, at - 400), at);
    const lastOpenBrace = preceding.lastIndexOf('@media');
    const lastCloseBrace = preceding.lastIndexOf('}');
    expect(lastOpenBrace).toBeLessThanOrEqual(lastCloseBrace);
  });
});
