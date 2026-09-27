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
import { MetricCardSkeleton } from '@/components/ui/skeleton';
import { StatGrid } from '@/components/ui/stat-grid';
import { useToast } from '@/lib/hooks/use-toast';
import { useCurrency, usePlan } from '@/lib/contexts/user-settings-context';

import { PersonalizedHeader } from './personalized-header';
import { UpcomingRenewalsSpotlight } from '@/components/subscriptions/upcoming-renewals-spotlight';
import { MostExpensivePlanCard } from './most-expensive-plan-card';
import { SmartInsightCard } from './smart-insight-card';
import { AdBanner } from './ad-banner';

import SubscriptionModal from '@/components/subscriptions/subscription-modal';
import PaymentReminderModal from '@/components/subscriptions/payment-reminder-modal';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import UpgradeModal from '@/components/subscriptions/upgrade-modal';

import { SavingsRecommendations } from '@/components/ai/savings-recommendations';
import { CancellationIntelligenceModal } from '@/components/ai/cancellation-intelligence-modal';
import SubscriptionDetailModal from '@/components/subscriptions/subscription-detail-modal';

import {
  DollarSign,
  Calendar,
  CreditCard,
  Wallet,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';

function renderFormattedCurrency(amount: number, currency = 'USD') {
  const formatted = formatCurrency(amount, currency);
  return (
    <span className="text-2xl sm:text-[30px] font-semibold leading-tight tracking-tight text-[#F5F7F6]">
      {formatted}
    </span>
  );
}

function MetricCardLink({
  href,
  title,
  icon,
  children,
}: {
  href: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      title={`${title} — open related page`}
      className="group px-4 py-3.5 sm:px-5 sm:py-4 rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] hover:border-[#2A2E2E] transition-colors flex flex-col justify-between min-h-[96px] sm:min-h-[104px]"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {icon}
          <span className="text-xs sm:text-sm font-medium text-[#94A3B8] leading-tight block truncate">
            {title}
          </span>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8] opacity-0 group-hover:opacity-100 -translate-x-0.5 group-hover:translate-x-0 transition-all duration-200 shrink-0" />
      </div>
      <div className="mt-1 sm:mt-1.5">
        {children}
      </div>
    </Link>
  );
}

export default function DashboardV2() {
  const { toast } = useToast();
  const { defaultCurrency, exchangeRates } = useCurrency();
  const { isPlus } = usePlan();

  const initialCache = getCachedSubscriptions();
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>(initialCache || []);
  const [loading, setLoading] = useState(!initialCache);
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
      return synced ? id : null;
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
    return synced && created ? created.id : null;
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

  const handleSaveReminder = (subId: string, data: { timing: string; method: string; note?: string }) => {
    const updated = {
      ...reminders,
      [subId]: { ...data, dismissed: false },
    };
    setReminders(updated);
    try {
      safeSetItem('subhalt_reminders', JSON.stringify(updated));
    } catch {
      // Ignore storage errors
    }
    toast.success('Payment reminder configured.', 'Reminder Set');
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
            href="/renewals"
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
          <MetricCardLink
            href="/subscriptions"
            title="Monthly Spend"
            icon={<Wallet className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />}
          >
            {renderFormattedCurrency(monthlySpend, defaultCurrency)}
            <span className="text-xs sm:text-[13px] font-normal leading-tight text-[#94A3B8] block mt-1">
              Normalized monthly expense ({defaultCurrency})
            </span>
          </MetricCardLink>

          {/* Card 2: Renewing This Week */}
          <MetricCardLink
            href="/renewals"
            title="Renewing This Week"
            icon={<Calendar className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />}
          >
            <span className="text-2xl sm:text-[30px] font-semibold leading-tight tracking-tight text-[#F5F7F6]">
              {renewingThisWeek}
            </span>
            <span className="block mt-1 text-xs sm:text-[13px] font-normal leading-tight text-[#94A3B8]">
              Due in next 7 days
            </span>
          </MetricCardLink>

          {/* Card 3: Active Plans */}
          <MetricCardLink
            href="/subscriptions"
            title="Active Plans"
            icon={<CreditCard className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />}
          >
            <span className="text-2xl sm:text-[30px] font-semibold leading-tight tracking-tight text-[#F5F7F6]">
              {activeCount}
            </span>
            <span className="block mt-1 text-xs sm:text-[13px] font-normal leading-tight text-[#94A3B8]">
              Active & trial subscriptions
            </span>
          </MetricCardLink>

          {/* Card 4: Potential Savings */}
          <MetricCardLink
            href="/subscriptions?sort=price_desc"
            title="Potential Savings"
            icon={<DollarSign className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />}
          >
            {renderFormattedCurrency(potentialSavings, defaultCurrency)}
            <span className="block mt-1 text-xs sm:text-[13px] font-normal leading-tight text-[#94A3B8]">
              From paused/trial plans ({defaultCurrency})
            </span>
          </MetricCardLink>
        </StatGrid>
      )}

      {/* 3. DESKTOP 2-COLUMN: UPCOMING RENEWALS | MOST EXPENSIVE PLAN */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
          <div className="lg:col-span-3 min-w-0">
            <UpcomingRenewalsSpotlight
              subscriptions={activeSubscriptions}
            />
          </div>
          <div className="lg:col-span-2 min-w-0">
            <MostExpensivePlanCard
              subscriptions={activeSubscriptions}
            />
          </div>
        </div>
      )}

      {/* 4. FINANCIAL OVERVIEW: SAVINGS RECOMMENDATIONS & SPENDING BY CATEGORY */}
      {!loading && (
        <SavingsRecommendations
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
