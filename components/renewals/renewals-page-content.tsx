'use client';

import { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, AlertCircle, Trash2 } from 'lucide-react';
import {
  fetchSubscriptions,
  getCachedSubscriptions,
  filterActiveSubscriptions,
  softDeleteSubscription,
  type SubscriptionRow,
} from '@/lib/services/subscription-service';
import { formatCurrency } from '@/lib/utils/metrics-utils';
import { ServiceIcon } from '@/components/ui/service-icon';
import { RenewalsTable, getPlanName, getCycleSuffix } from '@/components/subscriptions/renewals-table';
import { useToast } from '@/lib/hooks/use-toast';
import { SubscriptionCardSkeleton } from '@/components/ui/skeleton';

/**
 * Overdue is capped at 60 days.
 *
 * Without a ceiling the list grew without bound: a subscription left unpaid for
 * a year sorts to the top by oldest-first and buries everything actionable. A
 * row past the cap is simply not surfaced here; the subscription is untouched
 * and still exists in the main list.
 */
const OVERDUE_WINDOW_DAYS = 60;

/**
 * One compact overdue row: service, plan, days overdue, amount. Flat and flush,
 * matching the upcoming table, rather than the bordered card it used to be.
 * Plan is dropped below `sm` so the whole row stays on a single line on a phone.
 */
function OverdueRow({ sub, diffDays }: { sub: SubscriptionRow; diffDays: number }) {
  const price = Number(sub.price) || 0;
  const cycleSuffix = getCycleSuffix(sub.billing_cycle);
  const planName = getPlanName(sub);

  return (
    <div className="flex items-center gap-3 sm:grid sm:grid-cols-[minmax(180px,1.5fr)_minmax(120px,1fr)_minmax(90px,auto)_minmax(90px,auto)] sm:gap-4 px-4 sm:px-5 py-3.5 w-full bg-[#0B0D0D]">
      <div className="flex items-center gap-3 min-w-0 flex-1 sm:flex-none">
        <ServiceIcon
          name={sub.name}
          category={sub.category}
          providerUrl={sub.provider_url}
          className="w-9 h-9 rounded-xl shrink-0 border border-[#1A1D1D]"
        />
        <span className="text-sm sm:text-base font-semibold text-[#F5F7F6] truncate">
          {sub.name}
        </span>
      </div>

      <span
        title={planName}
        className="hidden sm:block truncate text-xs sm:text-sm text-[#94A3B8]"
      >
        {planName}
      </span>

      <span className="text-xs sm:text-sm font-bold text-[#D9363E] whitespace-nowrap">
        Overdue ({Math.abs(diffDays)}d)
      </span>

      <span className="text-right text-sm sm:text-base font-bold text-[#F5F7F6] whitespace-nowrap">
        {formatCurrency(price, sub.currency || 'USD')}
        <span className="text-xs font-normal text-[#94A3B8]">{cycleSuffix}</span>
      </span>
    </div>
  );
}

/** How far the row travels to expose the delete action. */
const SWIPE_REVEAL_PX = 96;
/** How far it must be dragged before the gesture counts. */
const SWIPE_TRIGGER_PX = 56;

/**
 * Swipe-left-to-delete wrapper.
 *
 * Used only on the overdue list, per the product decision: an overdue row is
 * something the user may want to clear away, whereas an upcoming renewal is not
 * theirs to dismiss, so the upcoming table keeps no gesture at all.
 *
 * Deletion is a two-step gesture on purpose. The swipe only reveals the action;
 * removing data takes a deliberate tap on it, so a stray horizontal scroll on a
 * phone cannot delete a subscription. A pointer/keyboard path is provided
 * alongside because a swipe gesture has no keyboard equivalent and the row is
 * reachable by assistive tech.
 */
function SwipeToDelete({
  children,
  onDelete,
  label,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  label: string;
}) {
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(false);
  // State, not a ref: the transition style below reads it during render.
  const [dragging, setDragging] = useState(false);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const axisLocked = useRef<'none' | 'x' | 'y'>('none');
  // Set on touch, consumed by the click a tap synthesises. See handleRowClick.
  const touchSeen = useRef(false);

  const close = useCallback(() => {
    setOpen(false);
    setOffset(0);
  }, []);

  const toggle = useCallback(() => {
    setOpen((wasOpen) => {
      const next = !wasOpen;
      setOffset(next ? -SWIPE_REVEAL_PX : 0);
      return next;
    });
  }, []);

  /**
   * Click-to-toggle is the pointer/desktop affordance; touch keeps the swipe.
   *
   * A tap on a phone synthesises the same click event, so without a guard every
   * tap would flip the row open on top of the swipe gesture. `touchSeen` is set
   * during the touch sequence and consumed by the click that follows it.
   */
  const handleRowClick = useCallback(() => {
    if (touchSeen.current) {
      touchSeen.current = false;
      return;
    }
    toggle();
  }, [toggle]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchSeen.current = true;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    setDragging(false);
    axisLocked.current = 'none';
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX.current === null || startY.current === null) return;

    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    // Lock to an axis once the intent is clear, so a vertical scroll is never
    // read as a swipe and a swipe never blocks scrolling.
    if (axisLocked.current === 'none') {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        axisLocked.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      } else {
        return;
      }
    }
    if (axisLocked.current !== 'x') return;

    setDragging(true);
    // Only leftwards, and only as far as the action needs.
    const base = open ? -SWIPE_REVEAL_PX : 0;
    const next = Math.min(0, Math.max(-SWIPE_REVEAL_PX, base + dx));
    setOffset(next);
  };

  const handleTouchEnd = () => {
    if (!dragging) {
      startX.current = null;
      startY.current = null;
      return;
    }

    const shouldOpen = offset <= -SWIPE_TRIGGER_PX;
    setOpen(shouldOpen);
    setOffset(shouldOpen ? -SWIPE_REVEAL_PX : 0);
    setDragging(false);

    startX.current = null;
    startY.current = null;
  };

  return (
    <div className="relative overflow-hidden">
      {/* Destructive action, revealed underneath. */}
      <div className="absolute inset-y-0 right-0 flex items-stretch" aria-hidden={!open}>
        <button
          type="button"
          onClick={() => {
            close();
            onDelete();
          }}
          tabIndex={open ? 0 : -1}
          aria-label={label}
          className="min-w-[96px] min-h-[44px] px-4 flex items-center justify-center gap-1.5 bg-[#D9363E] hover:bg-[#B91C1C] text-white text-xs font-bold transition-colors cursor-pointer"
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
          <span>Remove</span>
        </button>
      </div>

      <div
        className="relative touch-pan-y sm:cursor-pointer"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={open ? 'Hide remove action' : label}
        style={{ transform: `translateX(${offset}px)`, transition: dragging ? 'none' : 'transform 200ms ease-out' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onClick={handleRowClick}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          toggle();
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default function RenewalsPageContent() {
  const { toast } = useToast();
  const initialCache = getCachedSubscriptions();
  /**
   * True when this page was opened from the dashboard's overdue banner
   * (`/renewals?from=alert`). That arrival keeps the "Back to Dashboard" control
   * and leads with the overdue list; arriving from the nav menu drops the back
   * control and leads with the upcoming list.
   */
  const searchParams = useSearchParams();
  const fromAlert = searchParams.get('from') === 'alert';
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>(initialCache || []);
  const [loading, setLoading] = useState(!initialCache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchSubscriptions().then(({ data, error: err }) => {
      if (!active) return;
      if (err && subscriptions.length === 0) {
        setError(err.message || 'Failed to load subscriptions.');
      } else if (data) {
        setSubscriptions(data);
      }
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      setLoading(false);
    });
    return () => {
      active = false;
    };
    // Run once on mount; refresh is triggered explicitly elsewhere.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { overdueList, upcomingRenewals } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allMapped = filterActiveSubscriptions(subscriptions)
      .filter((sub) => sub.status === 'active' || sub.status === 'trial')
      .map((sub) => {
        const nextDate = new Date(sub.next_billing_date);
        nextDate.setHours(0, 0, 0, 0);
        const diffTime = nextDate.getTime() - today.getTime();
        const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
        return { sub, diffDays };
      });

    const overdue = allMapped
      .filter(({ diffDays }) => diffDays < 0 && diffDays >= -OVERDUE_WINDOW_DAYS)
      .sort((a, b) => a.diffDays - b.diffDays);

    const upcoming = allMapped
      .filter(({ diffDays }) => diffDays >= 0 && diffDays <= 30)
      .sort((a, b) => a.diffDays - b.diffDays);

    return { overdueList: overdue, upcomingRenewals: upcoming };
  }, [subscriptions]);

  /**
   * Removes an overdue subscription from the list with a soft delete, so it moves
   * to the Deleted section of Past Activities and stays restorable. Reached by a
   * deliberate tap on the action a swipe reveals, never by the swipe itself.
   */
  const handleDeleteOverdue = useCallback(
    async (sub: SubscriptionRow) => {
      const { error: err } = await softDeleteSubscription(sub.id);
      if (err) {
        toast.error(err.message || `Could not remove "${sub.name}".`, 'Remove Failed');
        return;
      }
      setSubscriptions((current) => current.filter((row) => row.id !== sub.id));
      toast.success(
        `"${sub.name}" moved to Deleted. You can restore it from Past Activity.`,
        'Subscription Removed'
      );
    },
    [toast]
  );

  return (
    <div className="animate-page-transition space-y-4 sm:space-y-5 bg-ambient-grid pb-8 sm:pb-12 overflow-x-clip">
      {/* Top-left Back Button.
          Only for the deep link out of the dashboard's overdue banner. Arriving
          from the nav menu means Renewals is a top-level destination, and a Back
          to Dashboard there is a dead end; the menu item is the way back. */}
      {fromAlert && (
        <div>
          <Link
            href="/"
            prefetch={true}
            className="inline-flex items-center gap-1.5 min-h-[44px] sm:min-h-0 text-xs font-semibold text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            <span>Back to Dashboard</span>
          </Link>
        </div>
      )}

      {/* Accessible DOM Heading */}
      <h1 className="sr-only">Upcoming Renewals</h1>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-[#D9363E]/10 border border-[#D9363E]/20 flex items-center gap-3 text-[#D9363E] text-xs">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Overdue & Renewal Rows Container */}
      {loading && subscriptions.length === 0 ? (
        <div className="space-y-4">
          <SubscriptionCardSkeleton />
          <SubscriptionCardSkeleton />
          <SubscriptionCardSkeleton />
        </div>
      ) : (
        <div className="flex flex-col gap-14 sm:gap-12">
          {/* Overdue Subscriptions Section.
              `order-*` sets the section sequence without duplicating the markup,
              so the two lists cannot drift apart. Arriving from the dashboard's
              overdue banner leads with overdue; arriving from the nav menu leads
              with what is coming up. */}
          {overdueList.length > 0 && (
            <div
              className={`bg-[#0B0D0D] border border-[#D9363E]/30 rounded-[20px] overflow-hidden shadow-sm ${fromAlert ? 'order-1' : 'order-2'}`}
            >
              <div className="flex items-center gap-2 border-b border-[#D9363E]/20 py-3.5 px-4 sm:px-5">
                <AlertCircle className="w-5 h-5 text-[#D9363E]" />
                <h2 className="text-base sm:text-lg font-bold text-[#D9363E]">
                  Overdue Subscriptions ({overdueList.length})
                </h2>
              </div>
              <div className="divide-y divide-[#1A1D1D]">
                {overdueList.map(({ sub, diffDays }) => (
                  <SwipeToDelete
                    key={sub.id}
                    label={`Remove ${sub.name} from overdue`}
                    onDelete={() => handleDeleteOverdue(sub)}
                  >
                    <OverdueRow sub={sub} diffDays={diffDays} />
                  </SwipeToDelete>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Renewals Section */}
          <div
            className={`bg-[#0B0D0D] border border-[#1A1D1D] rounded-[20px] overflow-hidden ${fromAlert ? 'order-2' : 'order-1'}`}
          >
            <h2 className="text-base sm:text-lg font-bold text-[#F5F7F6] tracking-tight border-b border-[#1A1D1D] py-3.5 px-4 sm:px-5">
              Upcoming Renewals (Next 30 Days)
            </h2>
            {upcomingRenewals.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center gap-1 px-4 py-10">
                <p className="text-sm font-medium text-[#F5F7F6]/80">
                  No upcoming renewals in the next 30 days.
                </p>
                <p className="text-xs text-[#94A3B8]/60">
                  You&apos;re all caught up.
                </p>
              </div>
            ) : (
              <RenewalsTable items={upcomingRenewals} pinFirstColumn={false} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
