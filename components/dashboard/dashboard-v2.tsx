'use client';

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
import { useToast } from '@/lib/hooks/use-toast';
import { useUserSettings } from '@/lib/contexts/user-settings-context';

import { PersonalizedHeader } from './personalized-header';
import { UpcomingRenewalsSpotlight } from '@/components/subscriptions/upcoming-renewals-spotlight';
import { CategoryBreakdownCard } from './category-breakdown-card';
import { MostExpensivePlanCard } from './most-expensive-plan-card';
import { SmartInsightCard } from './smart-insight-card';
import { AdBanner } from './ad-banner';

import SubscriptionModal from '@/components/subscriptions/subscription-modal';
import PaymentReminderModal from '@/components/subscriptions/payment-reminder-modal';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import UpgradeModal from '@/components/subscriptions/upgrade-modal';

import { SubHaltAIAssistant } from '@/components/ai/subhalt-ai-assistant';
import { SavingsRecommendations } from '@/components/ai/savings-recommendations';
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

export default function DashboardV2() {
  const { toast } = useToast();
  const { defaultCurrency, exchangeRates, isPlus, isPremium } = useUserSettings();

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
      const saved = localStorage.getItem('subsync_reminders');
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
    });
    return () => {
      active = false;
    };
  }, [subscriptions.length]);

  const handleSave = async (data: Omit<SubscriptionInsert, 'user_id'>, id?: string) => {
    if (id) {
      const { error: err } = await updateSubscription(id, data);
      if (err) throw err;
      toast.success('Subscription updated successfully.', 'Changes Saved');
    } else {
      if (!isPlus && activeSubscriptions.length >= FREE_SUBSCRIPTION_LIMIT) {
        setIsUpgradeModalOpen(true);
        return;
      }
      const { error: err } = await createSubscription(data);
      if (err) throw err;
      toast.success('New subscription added to your portfolio.', 'Subscription Created');
    }
    await loadData();
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
      localStorage.setItem('subsync_reminders', JSON.stringify(updated));
    } catch {
      // Ignore storage errors
    }
    toast.success('Payment reminder configured.', 'Reminder Set');
  };

  // Metrics with User Default Currency
  const activeSubscriptions = useMemo(() => filterActiveSubscriptions(subscriptions), [subscriptions]);

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
    <div className="animate-page-transition space-y-5 sm:space-y-6 bg-ambient-grid min-h-[85vh] pb-8 sm:pb-12 overflow-x-hidden">
      {/* 0. SPONSOR ADVERTISEMENT (Restrained Top Strip) */}
      {!loading && <AdBanner planTier="free" />}

      {/* 1. HEADER SECTION (Greeting) */}
      <div>
        <PersonalizedHeader
          renewingThisWeekCount={renewingThisWeek}
        />
      </div>

      {/* 2. SUBHALT AI ASSISTANT PROACTIVE BANNER (FLOATING WITH BREATHING ROOM) */}
      {!loading && (
        <div className="py-0.5">
          <SubHaltAIAssistant
            subscriptions={subscriptions}
            onViewSubscription={(sub) => setSelectedDetailSub(sub)}
          />
        </div>
      )}

      {/* 3. OVERDUE SUBSCRIPTIONS ALERT BANNER (FULL-WIDTH CONTAINER WITH BREATHING ROOM) */}
      {!loading && overdueCount > 0 && (
        <div className="p-4 rounded-2xl bg-[#D9363E]/10 border border-[#D9363E]/30 flex items-center justify-between gap-4 text-xs sm:text-sm text-[#F5F7F6]">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-[#D9363E] shrink-0" />
            <div>
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
            className="px-3.5 py-1.5 rounded-xl bg-[#D9363E]/20 hover:bg-[#D9363E]/30 text-[#D9363E] font-semibold text-xs transition-colors shrink-0 cursor-pointer border border-[#D9363E]/30"
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
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {/* Card 1: Monthly Spend */}
          <div className="px-4 py-3.5 sm:px-5 sm:py-4 rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] flex flex-col justify-center min-h-[96px] sm:min-h-[104px]">
            <div>
              <span className="text-xs sm:text-sm font-medium text-[#94A3B8] leading-tight block">
                Monthly Spend
              </span>
            </div>
            <div className="mt-1 sm:mt-1.5">
              <div>
                {renderFormattedCurrency(monthlySpend, defaultCurrency)}
              </div>
              <span
                className="text-xs sm:text-[13px] font-normal leading-tight text-[#94A3B8] block mt-1"
              >
                Normalized monthly expense ({defaultCurrency})
              </span>
            </div>
          </div>

          {/* Card 2: Renewing This Week */}
          <div className="px-4 py-3.5 sm:px-5 sm:py-4 rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] flex flex-col justify-center min-h-[96px] sm:min-h-[104px]">
            <div>
              <span className="text-xs sm:text-sm font-medium text-[#94A3B8] leading-tight block">
                Renewing This Week
              </span>
            </div>
            <div className="mt-1 sm:mt-1.5">
              <div className="text-2xl sm:text-[30px] font-semibold leading-tight tracking-tight text-[#F5F7F6]">
                {renewingThisWeek}
              </div>
              <span className="block mt-1 text-xs sm:text-[13px] font-normal leading-tight text-[#94A3B8]">
                Due in next 7 days
              </span>
            </div>
          </div>

          {/* Card 3: Active Plans */}
          <div className="px-4 py-3.5 sm:px-5 sm:py-4 rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] flex flex-col justify-center min-h-[96px] sm:min-h-[104px]">
            <div>
              <span className="text-xs sm:text-sm font-medium text-[#94A3B8] leading-tight block">
                Active Plans
              </span>
            </div>
            <div className="mt-1 sm:mt-1.5">
              <div className="text-2xl sm:text-[30px] font-semibold leading-tight tracking-tight text-[#F5F7F6]">
                {activeCount}
              </div>
              <span
                className="block mt-1 text-xs sm:text-[13px] font-normal leading-tight text-[#94A3B8]"
              >
                Active & trial subscriptions
              </span>
            </div>
          </div>

          {/* Card 4: Potential Savings */}
          <div className="px-4 py-3.5 sm:px-5 sm:py-4 rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] flex flex-col justify-center min-h-[96px] sm:min-h-[104px]">
            <div>
              <span className="text-xs sm:text-sm font-medium text-[#94A3B8] leading-tight block">
                Potential Savings
              </span>
            </div>
            <div className="mt-1 sm:mt-1.5">
              <div>
                {renderFormattedCurrency(potentialSavings, defaultCurrency)}
              </div>
              <span
                className="block mt-1 text-xs sm:text-[13px] font-normal leading-tight text-[#94A3B8]"
              >
                From paused/trial plans ({defaultCurrency})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. UPCOMING RENEWALS */}
      {!loading && (
        <UpcomingRenewalsSpotlight
          subscriptions={activeSubscriptions}
        />
      )}

      {/* 4. FINANCIAL OVERVIEW: SAVINGS RECOMMENDATIONS & SPENDING BY CATEGORY */}
      {!loading && (
        <SavingsRecommendations
          subscriptions={subscriptions}
          activeSubscriptions={activeSubscriptions}
          onReviewSubscription={(sub) => setSelectedDetailSub(sub)}
          onSeeSavings={(sub) => setCancellationSub(sub)}
          onAskSubHalt={(q) => {
            window.dispatchEvent(new CustomEvent('subsync_open_ask_modal', { detail: { question: q } }));
          }}
        />
      )}

      {/* 6. MOST EXPENSIVE PLAN */}
      {!loading && (
        <MostExpensivePlanCard
          subscriptions={activeSubscriptions}
        />
      )}

      {/* 7. SMART INSIGHT */}
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
