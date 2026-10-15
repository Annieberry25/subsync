import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEffect } from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InboxProvider, useInbox } from '@/lib/contexts/inbox-context';

/**
 * Regression cover for the loop that made the whole app unresponsive.
 *
 * Opening the Inbox ran `useEffect(() => markAllAsRead(), [markAllAsRead])`.
 * Calling it persisted to localStorage and dispatched `subhalt_inbox_updated`,
 * whose listener called `refreshFromStorage`. That used to set fresh arrays parsed
 * straight out of JSON, so the state identities changed on every pass, rebuilding
 * `persistCache` and `markAllAsRead` and re-firing the effect. No floor, no exit.
 *
 * It presents as the entire product freezing the moment Inbox is opened: no menu
 * opens and Sign Out does nothing. These tests guard the cause, the identity of
 * the callback, rather than the symptoms.
 */

vi.mock('@/lib/supabase/client', () => {
  const chainable: Record<string, unknown> = {};
  for (const m of ['select', 'update', 'upsert', 'delete', 'eq', 'neq', 'in', 'order', 'limit']) {
    chainable[m] = () => chainable;
  }
  Object.assign(chainable, { error: null, data: [] });

  return {
    createClient: () => ({
      auth: { getUser: async () => ({ data: { user: null }, error: null }) },
      from: () => chainable,
    }),
  };
});

/**
 * Recorded from an effect rather than during render: the value is what that render
 * committed, and writing to it mid-render is the side effect the lint rule is
 * there to stop.
 */
const identities: unknown[] = [];

function IdentityProbe() {
  const { markAllAsRead, items } = useInbox();

  useEffect(() => {
    identities.push(markAllAsRead);
  });

  return <div>items: {items.length}</div>;
}

function Caller() {
  const { markAllAsRead } = useInbox();
  return (
    <button type="button" onClick={() => markAllAsRead()}>
      mark all read
    </button>
  );
}

describe('InboxProvider does not loop when the Inbox marks everything read', () => {
  beforeEach(() => {
    identities.length = 0;
    window.localStorage.clear();
  });

  it('keeps one identity for markAllAsRead across the persist and re-read cycle', async () => {
    const user = userEvent.setup();

    render(
      <InboxProvider>
        <IdentityProbe />
        <Caller />
      </InboxProvider>
    );

    await waitFor(() => expect(screen.getByText(/items:/)).toBeInTheDocument());

    // What the Inbox page does on mount, twice over.
    await user.click(screen.getByRole('button', { name: 'mark all read' }));
    await user.click(screen.getByRole('button', { name: 'mark all read' }));

    expect(identities.length).toBeGreaterThan(0);
    expect(new Set(identities).size).toBe(1);
  });

  /**
   * The same cycle as it actually ran: a consumer whose effect fires on identity
   * change. The render count has to settle rather than climb without bound.
   */
  it('settles instead of re-rendering forever', async () => {
    let committed = 0;

    function EffectConsumer() {
      const { markAllAsRead, items } = useInbox();

      useEffect(() => {
        committed += 1;
      });

      useEffect(() => {
        markAllAsRead();
      }, [markAllAsRead]);

      return <div>effect items: {items.length}</div>;
    }

    render(
      <InboxProvider>
        <EffectConsumer />
      </InboxProvider>
    );

    await waitFor(() => expect(screen.getByText(/effect items:/)).toBeInTheDocument());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });
    const settled = committed;

    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });

    // A few settles are fine. Before the fix this never returned at all.
    expect(committed - settled).toBeLessThanOrEqual(2);
  });
});
