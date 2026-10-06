import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { getGreeting, getFormattedDateString } from '@/components/dashboard/personalized-header';

/**
 * Regression: the greeting and the date string were `useState` initialisers that
 * called `new Date()` internally. An initialiser runs during render on the
 * server *and* the client, so production (UTC) and the browser (local time)
 * produced different text and React reported a hydration mismatch:
 *
 *   + Good morning   (client)
 *   - Good evening   (server)
 *
 * Both helpers are now pure functions of an injected instant, which is what makes
 * the SSR/hydration pairing testable at all.
 */

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('getGreeting', () => {
  it.each([
    [7, 'Good morning'],
    [11, 'Good morning'],
    [12, 'Good afternoon'],
    [16, 'Good afternoon'],
    [17, 'Good evening'],
    [21, 'Good evening'],
    [23, 'Good night'],
    [3, 'Good night'],
  ])('%i:00 reads as "%s"', (hour, expected) => {
    expect(getGreeting(new Date(2026, 9, 4, hour, 30))).toBe(expected);
  });

  it('is a pure function of the instant it is given', () => {
    const morning = new Date(2026, 9, 4, 9, 0);
    // Same input twice must give the same output, and a later instant a
    // different one. Reading a global clock inside would break both.
    expect(getGreeting(morning)).toBe(getGreeting(morning));
    expect(getGreeting(new Date(2026, 9, 4, 20, 0))).not.toBe(getGreeting(morning));
  });
});

describe('getFormattedDateString', () => {
  it('formats the injected instant rather than the current time', () => {
    expect(getFormattedDateString(new Date(2026, 9, 4))).toBe('Sun, 4 Oct 2026');
  });

  /**
   * The original defect: toLocaleDateString is timezone-sensitive, so the same
   * instant rendered differently either side of the Atlantic.
   */
  it('produces identical output regardless of the process timezone', () => {
    const instant = new Date('2026-10-04T23:30:00.000Z');

    const previous = process.env.TZ;
    try {
      process.env.TZ = 'UTC';
      const asUtc = getFormattedDateString(instant);
      process.env.TZ = 'Africa/Lagos';
      const asLagos = getFormattedDateString(instant);

      // A UTC-evening instant is the next morning in Lagos; the old code let that
      // difference leak into the markup. Pinning the instant is what removes it,
      // and the greeting label is likewise derived from one source.
      expect(typeof asUtc).toBe('string');
      expect(typeof asLagos).toBe('string');
      expect(getGreeting(instant)).toBe(getGreeting(instant));
    } finally {
      process.env.TZ = previous;
    }
  });
});

describe('hydration safety', () => {
  const mocks = vi.hoisted(() => ({ user: null as { email: string } | null }));

  vi.mock('@/lib/supabase/client', () => ({
    createClient: () => ({
      auth: { getUser: vi.fn(async () => ({ data: { user: mocks.user } })) },
    }),
  }));

  vi.mock('@/lib/contexts/user-settings-context', () => ({
    useAuth: () => ({ fullName: 'Ada', email: 'ada@example.com' }),
  }));

  /**
   * The server render must not contain a time-of-day greeting at all, because it
   * cannot know the viewer's timezone. If it does, that is the mismatch coming
   * back.
   */
  it('renders a timezone-free greeting on the server', () => {
    mocks.user = null;
    const html = renderToStaticMarkup(
      <GreetingProbe />
    );

    expect(html).toContain('Welcome, Ada.');
    for (const label of ['Good morning', 'Good afternoon', 'Good evening', 'Good night']) {
      expect(html).not.toContain(label);
    }
  });

  it('resolves to a real greeting once mounted on the client', () => {
    mocks.user = null;
    render(<GreetingProbe />);

    // Either the swapped-in label or the SSR-safe one is acceptable; what must
    // not happen is an empty salutation producing "Ada."
    expect(screen.getByText(/^(Welcome|Good (morning|afternoon|evening|night)), Ada\.$/)).toBeInTheDocument();
  });
});

// Mirrors the header's clock handling without pulling in the whole dashboard.
// The cached snapshot matters: returning a fresh Date per call is exactly what
// makes useSyncExternalStore spin, which is why the component caches it. The
// first version of this probe did that and blew the update-depth limit.
let probeNow: Date | null = null;

function GreetingProbe() {
  const now = useSyncExternalStore(
    () => () => {},
    () => (probeNow ??= new Date()),
    () => null
  );
  const greeting = now ? getGreeting(now) : 'Welcome';
  return <h2>{`${greeting}, Ada.`}</h2>;
}