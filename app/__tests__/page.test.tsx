import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HOME_TITLE, HOME_DESCRIPTION, HOME_H1 } from '@/lib/seo/home-copy';

/**
 * `/` branches on the session: the public homepage when signed out, the dashboard
 * when signed in. The decision is made on the server, before any HTML is sent.
 *
 * It used to be made by fetching the user, with every failure caught and read as
 * "nobody is signed in". That conflated two different things, and a transient
 * blip served the marketing page to someone holding a live session — inside an app
 * they could not get out of. The page now verifies claims from the cookie, and a
 * failed verification is checked authoritatively rather than answered with the
 * landing page.
 *
 * The tests below keep the original contract (SEO metadata per branch, indexed H1,
 * never a 500) and pin the new one.
 */
const { getClaims, getUser } = vi.hoisted(() => ({ getClaims: vi.fn(), getUser: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getClaims, getUser } })),
}));

// The dashboard pulls in charts and data hooks that have nothing to do with
// this page's branching, so it is stubbed to keep the test about routing.
vi.mock('@/components/dashboard/dashboard-v2', () => ({
  default: () => <div data-testid="dashboard" />,
}));

// getClaims() resolves to `{ data: { claims, header, signature }, error }`, so the
// verified payload is nested under `claims`. A bare object here would read as an
// absent claim.
const signedInClaims = { data: { claims: { sub: 'u1' } }, error: null };
const signedOutClaims = { data: null, error: null };
const signedInUser = { data: { user: { id: 'u1' } }, error: null };

/*
 * The page memoises its session check with React cache(). Outside a request scope
 * that memo is still shared, so a check made in one test would answer the next one
 * and the branches could not be exercised independently. Resetting the module
 * registry gives each test its own cache.
 */
const loadPage = async () => {
  const mod = await import('@/app/page');
  return { RootPage: mod.default, generateMetadata: mod.generateMetadata };
};

beforeEach(async () => {
  vi.resetModules();
  getClaims.mockReset();
  getUser.mockReset();
  // Absent claims is the ambiguous case, so it is the default here: the page must
  // confirm it against the Auth server before calling anybody signed out.
  getClaims.mockResolvedValue(signedOutClaims);
  getUser.mockResolvedValue({ data: { user: null }, error: null });
});

describe('homepage /', () => {
  it('signed out: metadata carries the exact indexed title and description', async () => {
    const { generateMetadata } = await loadPage();

    const meta = await generateMetadata();

    expect(meta.title).toBe(HOME_TITLE);
    expect(meta.description).toBe(HOME_DESCRIPTION);
  });

  it('signed out: renders the public page with the indexed H1', async () => {
    const { RootPage } = await loadPage();

    render(await RootPage());

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(HOME_H1);
    expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();
  });

  it('signed in: renders the dashboard, not the public page', async () => {
    getClaims.mockResolvedValue(signedInClaims);
    const { RootPage } = await loadPage();

    render(await RootPage());

    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: HOME_H1 })).not.toBeInTheDocument();
  });

  it('signed in: keeps dashboard metadata off the public title', async () => {
    getClaims.mockResolvedValue(signedInClaims);
    const { generateMetadata } = await loadPage();

    const meta = await generateMetadata();

    expect(meta.title).toBe('Dashboard');
  });

  /**
   * A verified claim answers from the cookie against the cached signing keys, so
   * the common path must not reach for the Auth server. That was a round trip on
   * every load of the homepage.
   */
  it('does not call the Auth server when the claims verify', async () => {
    getClaims.mockResolvedValue(signedInClaims);
    const { RootPage } = await loadPage();

    render(await RootPage());

    expect(getUser).not.toHaveBeenCalled();
  });

  /**
   * The regression. Verification failing is not evidence that nobody is signed in,
   * so it must be settled against the Auth server rather than answered with the
   * marketing page.
   */
  it('does not show the public page to a signed-in user when verification fails', async () => {
    getClaims.mockResolvedValue({ data: null, error: new Error('jwks unavailable') });
    getUser.mockResolvedValue(signedInUser);
    const { RootPage } = await loadPage();

    render(await RootPage());

    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: HOME_H1 })).not.toBeInTheDocument();
  });

  /**
   * A regression that followed a Google sign-in. `getClaims()` came back with no
   * claims and no error when it could not verify the token, which is
   * indistinguishable from signed out from here, and the marketing page was served
   * to people holding a live session.
   */
  it('does not show the landing page when claims are absent but the session is live', async () => {
    getClaims.mockResolvedValue({ data: null, error: null });
    getUser.mockResolvedValue(signedInUser);
    const { RootPage } = await loadPage();

    render(await RootPage());

    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: HOME_H1 })).not.toBeInTheDocument();
  });

  it('a Supabase failure still serves the public page rather than a 500', async () => {
    getClaims.mockRejectedValue(new Error('env missing'));
    getUser.mockRejectedValue(new Error('unreachable'));
    const { RootPage } = await loadPage();

    render(await RootPage());

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(HOME_H1);
  });
});
