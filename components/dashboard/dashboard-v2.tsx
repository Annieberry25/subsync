'use client';
import { safeSetItem, safeGetItem } from '@/lib/safe-local-storage';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { FREE_SUBSCRIPTION_LIMIT } from '@/lib/constants';
import {
  fetchSubscriptions,
  getCachedSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  filterActiveSubscriptions,
  type SubscriptionRow,
  type SubscriptionInsert,
} from '@/lib/services/subscription-service';
import {
  calculateMonthlySpend,
  getActiveCount,
  getUpcomingRenewalsCount,
  calculatePotentialSavings,
  formatCurrency,
} from '@/lib/utils/metrics-utils';
import {
  saveReminderPreference,
  fetchReminderPreferences,
  type ReminderPreference,
} from '@/lib/services/reminder-preferences';
import { MetricCardSkeleton } from '@/components/ui/skeleton';
import { StatGrid } from '@/components/ui/stat-grid';
import { useToast } from '@/lib/hooks/use-toast';
import { useCurrency, usePlan } from '@/lib/contexts/user-settings-context';

import { PersonalizedHeader } from './personalized-header';
import { DashboardOverviewCard } from './dashboard-overview-card';
import { SmartInsightCard } from './smart-insight-card';
import { AdBanner } from './ad-banner';

import SubscriptionModal from '@/components/subscriptions/subscription-modal';
import PaymentReminderModal from '@/components/subscriptions/payment-reminder-modal';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import UpgradeModal from '@/components/subscriptions/upgrade-modal';


import { CancellationIntelligenceModal } from '@/components/ai/cancellation-intelligence-modal';
import SubscriptionDetailModal from '@/components/subscriptions/subscription-detail-modal';

import {
  DollarSign,
  Calendar,
  CreditCard,
  Wallet,
  AlertCircle,
} from 'lucide-react';

function renderFormattedCurrency(amount: number, currency = 'USD') {
  const formatted = formatCurrency(amount, currency);
  return (
    <span className="text-2xl sm:text-[30px] font-semibold leading-tight tracking-tight text-[#F5F7F6]">
      {formatted}
    </span>
  );
}

/* Deliberately a plain card, not a Link. These four figures are read-only
   roll-ups with no single destination — "Monthly Spend" is not one page and
   "Potential Savings" is a computed suggestion, not a record — so the previous
   hrefs sent people somewhere that did not explain the number they clicked. The
   hover chevron that advertised a link is gone with it. */
function MetricCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-3.5 sm:px-5 sm:py-4 rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] flex flex-col justify-between min-h-[96px] sm:min-h-[104px]">
      <div className="flex items-center gap-1.5 min-w-0">
        {icon}
        <span className="text-xs sm:text-sm font-medium text-[#94A3B8] leading-tight block truncate">
          {title}
        </span>
      </div>
      <div className="mt-1 sm:mt-1.5">
        {children}
      </div>
    </div>
  );
}

export default function DashboardV2() {
  const { toast } = useToast();
  const { defaultCurrency, exchangeRates } = useCurrency();
  const { isPlus } = usePlan();

  /* The localStorage cache must not seed this state. On the server
     getCachedSubscriptions() returns null (no window), but on the client it
     returns the cached rows — so seeding here would render the skeleton on the
     server and the real cards on the client. That mismatch is not confined to
     the metric icons: every `!loading` gate below (AdBanner, overdue banner,
     overview, insight) disagrees too. Both sides start identical and the cache
     is adopted after mount instead. */
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal & Dialog states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<SubscriptionRow | null>(null);

  const [cancellationSub, setCancellationSub] = useState<SubscriptionRow | null>(null);
  const [selectedDetailSub, setSelectedDetailSub] = useState<SubscriptionRow | null>(null);

  const [deletingSubscription, setDeletingSubscription] = useState<SubscriptionRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [reminderSubscription, setReminderSubscription] = useState<SubscriptionRow | null>(null);
  const [reminders, setReminders] = useState<Record<string, { timing: string; method: string; note?: string; dismissed?: boolean }>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const saved = safeGetItem('subhalt_reminders');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  /* Server-backed reminder preferences, loaded so the sheet shows what the cron
     will actually do. With no row the cron pushes at 10 days and never emails,
     which is exactly what the sheet must display by default. */
  const [reminderPrefs, setReminderPrefs] = useState<ReminderPreference[]>([]);

  const reminderPrefBySub = useMemo(() => {
    const map = new Map<string, ReminderPreference>();
    for (const pref of reminderPrefs) map.set(pref.subscriptionId, pref);
    return map;
  }, [reminderPrefs]);

  const loadData = useCallback(async (showToast = false) => {
    setLoading(true);
    const { data, error: err } = await fetchSubscriptions();
    if (err) {
      setError(err.message || 'Failed to load subscriptions.');
    } else if (data) {
      setSubscriptions(data);
      if (showToast) {
        toast.info('Subscription data synchronized with Supabase.', 'Data Refreshed');
      }
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    let active = true;
    // Deferred to a microtask rather than set synchronously here.
    //
    // Two reasons, and the second is the important one: a sync setState in an
    // effect is a cascading render (the lint rule flags it), and it would render
    // the cached list during the hydration pass — the server has no localStorage,
    // so it emits an empty dashboard and the client would immediately disagree.
    // Reading the cache in an initializer is not an option either, for the same
    // reason. A microtask lands after hydration and before paint.
    queueMicrotask(() => {
      if (!active) return;
      const cached = getCachedSubscriptions();
      if (cached) {
        setSubscriptions(cached);
      }
    });
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
    fetchReminderPreferences().then((prefs) => {
      if (!active) return;
      setReminderPrefs(prefs);
    });
    return () => {
      active = false;
    };
    // Run once on mount; refresh handled via the sync action rather than
    // re-fetching in response to subscription length changes (avoids fetch loops).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReviewSubscription = useCallback((sub: SubscriptionRow) => {
    setSelectedDetailSub(sub);
  }, []);

  const handleSeeSavings = useCallback((sub: SubscriptionRow) => {
    setCancellationSub(sub);
  }, []);

  const handleAskSubHalt = useCallback((q?: string) => {
    window.dispatchEvent(new CustomEvent('subhalt_open_ask_modal', { detail: { question: q } }));
  }, []);

const handleSave = async (
    data: Omit<SubscriptionInsert, 'user_id'>,
    id?: string
  ): Promise<string | null> => {
    if (id) {
      const { error: err, synced } = await updateSubscription(id, data);
      if (err) throw err;
      if (synced) {
        toast.success('Subscription updated successfully.', 'Changes Saved');
      } else {
        toast.warning('Saved on this device only — it will sync when you are back online.', 'Offline Save');
      }
      setIsModalOpen(false);
      void loadData();
      return id;
    }

    if (!isPlus && activeSubscriptions.length >= FREE_SUBSCRIPTION_LIMIT) {
      setIsUpgradeModalOpen(true);
      return null;
    }

    const { data: created, error: err, synced } = await createSubscription(data);
    if (err) throw err;
    if (synced) {
      toast.success('New subscription added to your portfolio.', 'Subscription Created');
    } else {
      toast.warning('Added on this device only — it will sync when you are back online.', 'Offline Save');
    }
    setIsModalOpen(false);
    void loadData();
    return created ? created.id : null;
  };

  const handleConfirmDelete = async () => {
    if (!deletingSubscription) return;
    setDeleteLoading(true);

    const { error: err } = await deleteSubscription(deletingSubscription.id);
    setDeleteLoading(false);

    if (err) {
      toast.error(err.message, 'Deletion Failed');
    } else {
      toast.success(`Removed "${deletingSubscription.name}".`, 'Subscription Deleted');
      setDeletingSubscription(null);
      await loadData();
    }
  };

  const handleSaveReminder = async (
    subId: string,
    data: { emailLeadDays: number | null; pushLeadDays: number | null; note?: string }
  ) => {
    // The localStorage copy keeps the on-screen badge working offline; the database
    // copy is the one the reminder cron reads.
    const updated = {
      ...reminders,
      [subId]: {
        timing: data.emailLeadDays ? `${data.emailLeadDays}_days` : 'push_only',
        method: data.emailLeadDays ? 'both' : 'push',
        emailLeadDays: data.emailLeadDays,
        pushLeadDays: data.pushLeadDays,
        dismissed: false,
      },
    };
    setReminders(updated);
    try {
      safeSetItem('subhalt_reminders', JSON.stringify(updated));
    } catch {
      // Ignore storage errors
    }

    const saved = await saveReminderPreference({
      subscriptionId: subId,
      emailLeadDays: data.emailLeadDays,
      pushLeadDays: data.pushLeadDays,
      note: data.note ?? null,
    });

    // Not a silent success: a preference that only reached localStorage is one the
    // server-side cron cannot see, so the reminder would never arrive.
    if (!saved) {
      toast.warning(
        'Reminder saved on this device, but not synced. It may not fire — check your connection and try again.',
        'Reminder Not Synced'
      );
      return;
    }

    // Keep the in-memory copy current so reopening the sheet shows what was just
    // saved rather than the pre-save value.
    setReminderPrefs((prev) => [
      ...prev.filter((p) => p.subscriptionId !== subId),
      {
        subscriptionId: subId,
        emailLeadDays: data.emailLeadDays,
        pushLeadDays: data.pushLeadDays,
        note: data.note ?? null,
      },
    ]);

    toast.success('Reminder saved.', 'Reminder Set');
  };

  // Metrics with User Default Currency
  const activeSubscriptions = filterActiveSubscriptions(subscriptions);

  const monthlySpend = useMemo(
    () => calculateMonthlySpend(activeSubscriptions, defaultCurrency, exchangeRates),
    [activeSubscriptions, defaultCurrency, exchangeRates]
  );
  const renewingThisWeek = useMemo(() => getUpcomingRenewalsCount(activeSubscriptions, 7), [activeSubscriptions]);
  const activeCount = useMemo(() => getActiveCount(activeSubscriptions), [activeSubscriptions]);
  const potentialSavings = useMemo(
    () => calculatePotentialSavings(activeSubscriptions, defaultCurrency, exchangeRates),
    [activeSubscriptions, defaultCurrency, exchangeRates]
  );
  const overdueCount = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return activeSubscriptions.filter((sub) => {
      if (sub.status === 'canceled') return false;
      const nextBilling = new Date(sub.next_billing_date);
      return nextBilling < now;
    }).length;
  }, [activeSubscriptions]);

  const renewalSemantic = useMemo(() => {
    if (overdueCount > 0) {
      return {
        textColor: 'text-[#D9363E]',
        label: overdueCount === 1 ? '1 overdue subscription' : `${overdueCount} overdue subscriptions`,
      };
    }
    if (renewingThisWeek > 0) {
      return {
        textColor: 'text-[#94A3B8]',
        label: renewingThisWeek === 1 ? 'Subscription due' : 'Subscriptions due',
      };
    }
    return {
      textColor: 'text-[#94A3B8]',
      label: 'Subscriptions due',
    };
  }, [overdueCount, renewingThisWeek]);

  return (
    <div className="animate-page-transition space-y-5 sm:space-y-6 bg-ambient-grid min-h-[85dvh] pb-8 sm:pb-12 overflow-x-clip">
      {/* 0. SPONSOR ADVERTISEMENT (Restrained Top Strip) */}
      {!loading && <AdBanner planTier="free" />}

      {/* 1. HEADER SECTION (Greeting) */}
      <div>
        <PersonalizedHeader
          renewingThisWeekCount={renewingThisWeek}
        />
      </div>

      {/* 3. OVERDUE SUBSCRIPTIONS ALERT BANNER (FULL-WIDTH CONTAINER WITH BREATHING ROOM) */}
      {!loading && overdueCount > 0 && (
        <div className="p-4 rounded-2xl bg-[#D9363E]/10 border border-[#D9363E]/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 text-xs sm:text-sm text-[#F5F7F6]">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <AlertCircle className="w-5 h-5 text-[#D9363E] shrink-0 mt-0.5 sm:mt-0" />
            <div className="min-w-0">
              <strong className="text-[#D9363E] font-semibold block">
                {overdueCount} {overdueCount === 1 ? 'subscription is' : 'subscriptions are'} overdue
              </strong>
              <span className="text-[#94A3B8] text-xs">
                Overdue subscriptions are separated from upcoming renewals.
              </span>
            </div>
          </div>
          <Link
            /* `from=alert` marks this as the deep link out of the overdue banner.
               The renewals page uses it to keep the Back to Dashboard control and
               lead with overdue; arriving from the nav menu it does the opposite.
               Both orders are deliberate — someone who clicked "View Overdue"
               wants the overdue rows first, someone who opened Renewals from the
               menu wants what is coming up. */
            href="/renewals?from=alert"
            className="w-full sm:w-auto text-center px-3.5 py-2.5 min-h-[44px] flex items-center justify-center rounded-xl bg-[#D9363E]/20 hover:bg-[#D9363E]/30 text-[#D9363E] font-semibold text-xs transition-colors shrink-0 cursor-pointer border border-[#D9363E]/30"
          >
            View Overdue
          </Link>
        </div>
      )}

      {/* ERROR BANNER */}
      {error && (
        <div className="p-4 rounded-2xl bg-[#D9363E]/10 border border-[#D9363E]/20 flex items-center gap-3 text-[#D9363E] text-xs">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. KPI METRICS (2x2 Grid on Mobile for compact ergonomics) */}
      {loading && subscriptions.length === 0 ? (
        <StatGrid>
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
        </StatGrid>
      ) : (
        <StatGrid>
          {/* Card 1: Monthly Spend */}
          <MetricCard
            title="Monthly Spend"
            icon={<Wallet className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />}
          >
            {renderFormattedCurrency(monthlySpend, defaultCurrency)}
          </MetricCard>

          {/* Card 2: Renewing This Week */}
          <MetricCard
            title="Renewing This Week"
            icon={<Calendar className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />}
          >
            <span className="text-2xl sm:text-[30px] font-semibold leading-tight tracking-tight text-[#F5F7F6]">
              {renewingThisWeek}
            </span>
          </MetricCard>

          {/* Card 3: Active Plans */}
          <MetricCard
            title="Active Plans"
            icon={<CreditCard className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />}
          >
            <span className="text-2xl sm:text-[30px] font-semibold leading-tight tracking-tight text-[#F5F7F6]">
              {activeCount}
            </span>
          </MetricCard>

          {/* Card 4: Potential Savings */}
          <MetricCard
            title="Potential Savings"
            icon={<DollarSign className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />}
          >
            {renderFormattedCurrency(potentialSavings, defaultCurrency)}
          </MetricCard>
        </StatGrid>
      )}

      {/* 3. OVERVIEW: UPCOMING RENEWALS | MOST EXPENSIVE PLAN | SAVINGS RECOMMENDATIONS | SPENDING BY CATEGORY */}
      {!loading && (
        <DashboardOverviewCard
          subscriptions={subscriptions}
          activeSubscriptions={activeSubscriptions}
          onReviewSubscription={handleReviewSubscription}
          onSeeSavings={handleSeeSavings}
          onAskSubHalt={handleAskSubHalt}
        />
      )}

      {/* 7. SMART INSIGHT (Bottom Accordion) */}
      {!loading && <SmartInsightCard subscriptions={activeSubscriptions} />}

      {/* Modals & Dialogs */}
      <SubscriptionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingSubscription(null);
        }}
        onSave={handleSave}
        initialData={editingSubscription}
      />

      <ConfirmDialog
        isOpen={!!deletingSubscription}
        onClose={() => setDeletingSubscription(null)}
        onConfirm={handleConfirmDelete}
        loading={deleteLoading}
        title={`Delete "${deletingSubscription?.name}"?`}
        description="Are you sure you want to delete this subscription? This action cannot be undone."
        confirmText="Delete Subscription"
        variant="danger"
      />

      <PaymentReminderModal
        isOpen={!!reminderSubscription}
        onClose={() => setReminderSubscription(null)}
        onSave={(data) => {
          if (reminderSubscription) {
            handleSaveReminder(reminderSubscription.id, data);
          }
        }}
        subscriptionName={reminderSubscription?.name || ''}
        nextBillingDate={reminderSubscription?.next_billing_date}
        initialEmailLeadDays={
          reminderSubscription
            ? reminderPrefBySub.get(reminderSubscription.id)?.emailLeadDays
            : undefined
        }
        initialPushLeadDays={
          reminderSubscription
            ? reminderPrefBySub.get(reminderSubscription.id)?.pushLeadDays
            : undefined
        }
      />

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
      />

      <CancellationIntelligenceModal
        isOpen={!!cancellationSub}
        onClose={() => setCancellationSub(null)}
        subscription={cancellationSub}
        onStatusUpdated={loadData}
        onReviewSubscription={handleReviewSubscription}
      />

      <SubscriptionDetailModal
        isOpen={!!selectedDetailSub}
        onClose={() => setSelectedDetailSub(null)}
        subscription={selectedDetailSub}
        onEdit={(sub: SubscriptionRow) => {
          setSelectedDetailSub(null);
          setEditingSubscription(sub);
          setIsModalOpen(true);
        }}
        onDeleteRequest={(sub: SubscriptionRow) => {
          setSelectedDetailSub(null);
          setDeletingSubscription(sub);
        }}
        onPaymentReminderRequest={(sub: SubscriptionRow) => {
          setSelectedDetailSub(null);
          setReminderSubscription(sub);
        }}
        onCancellationAssistance={(sub: SubscriptionRow) => {
          setSelectedDetailSub(null);
          setCancellationSub(sub);
        }}
      />
    </div>
  );
}
