'use client';

import { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChevronLeft, AlertCircle, Trash2, RefreshCw } from 'lucide-react';
import {
  fetchSubscriptions,
  getCachedSubscriptions,
  filterActiveSubscriptions,
  softDeleteSubscription,
  renewOverdueSubscription,
  type SubscriptionRow,
} from '@/lib/services/subscription-service';
import { formatCurrency } from '@/lib/utils/metrics-utils';
import { resolveRenewalDate } from '@/lib/utils/billing-dates';
import { ServiceIcon } from '@/components/ui/service-icon';
import { RenewalsTable, getPlanName, getCycleSuffix } from '@/components/subscriptions/renewals-table';
import { useToast } from '@/lib/hooks/use-toast';
import { SubscriptionCardSkeleton } from '@/components/ui/skeleton';
import { useInbox } from '@/lib/contexts/inbox-context';

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
 * Swipe-left actions wrapper for overdue rows.
 */
function SwipeToDelete({
  children,
  onDelete,
  onRenew,
  deleteLabel,
  renewLabel,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  onRenew?: () => void;
  deleteLabel: string;
  renewLabel?: string;
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

  const revealWidth = onRenew ? SWIPE_REVEAL_PX * 2 : SWIPE_REVEAL_PX;
  const trigger = onRenew ? SWIPE_TRIGGER_PX * 1.6 : SWIPE_TRIGGER_PX;

  const close = useCallback(() => {
    setOpen(false);
    setOffset(0);
  }, []);

  const toggle = useCallback(() => {
    setOpen((wasOpen) => {
      const next = !wasOpen;
      setOffset(next ? -revealWidth : 0);
      return next;
    });
  }, [revealWidth]);

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

    if (axisLocked.current === 'none') {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        axisLocked.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      } else {
        return;
      }
    }
    if (axisLocked.current !== 'x') return;

    setDragging(true);
    const base = open ? -revealWidth : 0;
    const next = Math.min(0, Math.max(-revealWidth, base + dx));
    setOffset(next);
  };

  const handleTouchEnd = () => {
    if (!dragging) {
      startX.current = null;
      startY.current = null;
      return;
    }

    const shouldOpen = offset <= -trigger;
    setOpen(shouldOpen);
    setOffset(shouldOpen ? -revealWidth : 0);
    setDragging(false);

    startX.current = null;
    startY.current = null;
  };

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 flex items-stretch" aria-hidden={!open}>
        {onRenew && (
          <button
            type="button"
            onClick={() => {
              close();
              onRenew();
            }}
            tabIndex={open ? 0 : -1}
            aria-label={renewLabel || 'Renew subscription'}
            className="min-w-[96px] min-h-[44px] px-4 flex items-center justify-center gap-1.5 bg-[#14B8A6] hover:bg-[#0F9F8E] text-[#091512] text-xs font-bold transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Renew</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            close();
            onDelete();
          }}
          tabIndex={open ? 0 : -1}
          aria-label={deleteLabel}
          className="min-w-[96px] min-h-[44px] px-4 flex items-center justify-center gap-1.5 bg-[#D9363E] hover:bg-[#B91C1C] text-white text-xs font-bold transition-colors cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
          <span>Remove</span>
        </button>
      </div>

      <div
        className="relative touch-pan-y sm:cursor-pointer"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={open ? 'Hide actions' : (deleteLabel || 'Show actions')}
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
  const { addInboxItem } = useInbox();
  const initialCache = getCachedSubscriptions();
  /**
   * True when this page was opened from the dashboard's overdue banner
   * (`/renewals?from=alert`). That arrival keeps the "Back to Dashboard" control
   * and leads with the overdue list; arriving from the nav menu drops the back
   * control and leads with the upcoming list.
   */
  const searchParams = useSearchParams();
  const router = useRouter();
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
        /* The automatic date — a cycle after the start — matching what the
           detail sheet and the edit form answer from, so a row whose stored
           day was moved by auto-renewal does not show up on the wrong day
           here. */
        const nextDate = new Date(resolveRenewalDate(sub));
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
      toast.success('Removed', undefined, {
        label: 'View',
        ariaLabel: 'View deleted subscriptions',
        onClick: () => router.push('/history/deleted'),
      });
    },
    [toast, router]
  );

  const handleRenewOverdue = useCallback(
    async (sub: SubscriptionRow) => {
      try {
        const { error } = await renewOverdueSubscription(sub.id);
        if (error) {
          toast.error(error.message, 'Failed to renew');
          return;
        }
        addInboxItem({
          type: 'renewal',
          title: `${sub.name} renewed`,
          description: `${sub.name} has been renewed and is back on your active subscriptions list.`,
          actionType: 'view',
          actionLabel: 'View subscription',
          subscriptionName: sub.name,
          subscriptionPrice: sub.price,
          currency: sub.currency || 'USD',
        });
        toast.success(`${sub.name} renewed`, 'Overdue cleared');
        const { data } = await fetchSubscriptions();
        if (data) setSubscriptions(data);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to renew', 'Failed to renew');
      }
    },
    [toast, addInboxItem]
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
              className={`overflow-hidden md:rounded-[20px] md:bg-[#0B0D0D] md:border md:border-[#D9363E]/30 ${fromAlert ? 'order-1' : 'order-2'}`}
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
                    deleteLabel={`Remove ${sub.name} from overdue`}
                    renewLabel={`Renew ${sub.name}`}
                    onDelete={() => handleDeleteOverdue(sub)}
                    onRenew={() => handleRenewOverdue(sub)}
                  >
                    <OverdueRow sub={sub} diffDays={diffDays} />
                  </SwipeToDelete>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Renewals Section */}
          <div
            className={`overflow-hidden md:rounded-[20px] md:bg-[#0B0D0D] md:border md:border-[#1A1D1D] ${fromAlert ? 'order-2' : 'order-1'}`}
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
