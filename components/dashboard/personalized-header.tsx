'use client';

import { useEffect, useState, memo, useSyncExternalStore } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

import { useAuth } from '@/lib/contexts/user-settings-context';

interface PersonalizedHeaderProps {
  onRefresh?: () => void;
  onAddSubscription?: () => void;
  loading?: boolean;
  renewingThisWeekCount?: number;
  onAskSubHalt?: () => void;
}

/**
 * Both helpers take the instant rather than reading the clock themselves.
 *
 * They used to call `new Date()` internally and be passed to useState as an
 * initialiser, which runs during render on the server *and* the client. The two
 * sides then disagreed — production runs in UTC, the browser in local time — and
 * React reported:
 *
 *   Warning: Text content did not match.
 *   + Good morning        (client)
 *   - Good evening        (server)
 *
 * The date string had the same defect via toLocaleDateString, which is
 * timezone-sensitive for the same reason.
 *
 * Making them pure means the caller decides which instant to render, so the
 * value can be pinned to one that both sides agree on.
 */
export function getGreeting(now: Date): string {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 22) return 'Good evening';
  return 'Good night';
}

export function getFormattedDateString(now: Date): string {
  const weekday = now.toLocaleDateString('en-US', { weekday: 'short' });
  const day = now.getDate();
  const month = now.toLocaleDateString('en-US', { month: 'short' });
  const year = now.getFullYear();
  return `${weekday}, ${day} ${month} ${year}`;
}

/**
 * The clock, read as an external store.
 *
 * `useSyncExternalStore` is used rather than a `mounted` flag set in an effect
 * for two reasons: the hydration render is then guaranteed to use the server
 * snapshot, so the first client render matches the server byte for byte; and it
 * does not need setState inside an effect, which this repo treats as an error.
 *
 * There is deliberately no subscription. The greeting is a coarse label, not a
 * countdown — leaving a tab open across noon would otherwise re-render the
 * header for no visible benefit.
 */
const NO_SUBSCRIBE = () => () => {};

/**
 * Cached so the reference is stable. useSyncExternalStore compares snapshots
 * with Object.is, so returning a fresh Date on every call would spin React in an
 * infinite loop.
 */
let nowSnapshot: Date | null = null;

function getNowSnapshot(): Date | null {
  if (typeof window === 'undefined') return null;
  if (!nowSnapshot) nowSnapshot = new Date();
  return nowSnapshot;
}

/** Server, and the hydration render. Null means "no clock yet". */
function getServerNowSnapshot(): Date | null {
  return null;
}

export const PersonalizedHeader = memo(function PersonalizedHeader({
  renewingThisWeekCount = 0,
  onAskSubHalt: _onAskSubHalt,
}: PersonalizedHeaderProps) {
  const { fullName: contextFullName, email: contextEmail } = useAuth();
  const [user, setUser] = useState<User | null>(null);

  const now = useSyncExternalStore(NO_SUBSCRIBE, getNowSnapshot, getServerNowSnapshot);

  const supabase = createClient();

  useEffect(() => {
    async function loadUser() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
    }
    loadUser();
  }, [supabase]);

  /* Resolves the best available identity. Deliberately returns '' rather than a
     generic "User" placeholder: a bare "User" reads as though the account name
     were literally "user", which is worse than showing the greeting alone. */
  const getDisplayName = () => {
    if (contextFullName?.trim()) {
      return contextFullName.trim();
    }
    if (user?.user_metadata?.full_name?.trim()) {
      return user.user_metadata.full_name.trim();
    }
    if (user?.user_metadata?.name?.trim()) {
      return user.user_metadata.name.trim();
    }
    const currentEmail = contextEmail || user?.email;
    if (currentEmail) {
      const emailName = currentEmail.split('@')[0];
      return emailName.charAt(0).toUpperCase() + emailName.slice(1);
    }
    return '';
  };

  const displayName = getDisplayName();

  /**
   * Before the clock resolves — during SSR and the hydration render — fall back
   * to a timezone-free greeting. It has to render as a complete sentence, because
   * an empty greeting would briefly read "Ada." with no salutation, and it must
   * be identical on both sides of hydration, which is the entire point.
   */
  const greeting = now ? getGreeting(now) : 'Welcome';
  const formattedDate = now ? getFormattedDateString(now) : '';

  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
      <h1 className="sr-only">Dashboard</h1>
      {/* Left: Greeting + Subtitle */}
      <div className="min-w-0 break-words">
        <h2 className="text-base sm:text-lg font-semibold text-[#F5F7F6] tracking-tight">
          {greeting}{displayName ? `, ${displayName}` : ''}.
        </h2>
        <p className="text-xs sm:text-sm text-[#94A3B8] font-normal leading-relaxed mt-0.5 block">
          {renewingThisWeekCount > 0
            ? `You have ${renewingThisWeekCount} renewal${renewingThisWeekCount > 1 ? 's' : ''} this week.`
            : 'All subscription renewals are up to date for this week.'}
        </p>
      </div>

      {/* Right: Date */}
      <div className="text-left sm:text-right shrink-0">
        {formattedDate && (
          <span className="text-xs sm:text-sm font-medium text-[#94A3B8] block">
            {formattedDate}
          </span>
        )}
      </div>
    </div>
  );
});
