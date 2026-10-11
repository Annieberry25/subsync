import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HOME_TITLE, HOME_DESCRIPTION, HOME_H1 } from '@/lib/seo/home-copy';

/**
 * The session lookup is mocked so both branches of `/` can be exercised without
 * Supabase. `getUser` is the only thing the page asks of it.
 */
const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser } })),
}));

// The dashboard pulls in charts and data hooks that have nothing to do with
// this page's branching, so it is stubbed to keep the test about routing.
vi.mock('@/components/dashboard/dashboard-v2', () => ({
  default: () => <div data-testid="dashboard" />,
}));

import { generateMetadata, default as RootPage } from '@/app/page';

beforeEach(() => {
  getUser.mockReset();
});

describe('homepage /', () => {
  it('signed out: metadata carries the exact indexed title and description', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    const meta = await generateMetadata();

    expect(meta.title).toBe(HOME_TITLE);
    expect(meta.description).toBe(HOME_DESCRIPTION);
  });

  it('signed out: renders the public page with the indexed H1', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    render(await RootPage());

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(HOME_H1);
    expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();
  });

  it('signed in: renders the dashboard, not the public page', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });

    render(await RootPage());

    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: HOME_H1 })).not.toBeInTheDocument();
  });

  it('signed in: keeps dashboard metadata off the public title', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });

    const meta = await generateMetadata();

    expect(meta.title).toBe('Dashboard');
  });

  it('a Supabase failure still serves the public page rather than a 500', async () => {
    getUser.mockRejectedValue(new Error('env missing'));

    render(await RootPage());

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(HOME_H1);
  });
});
