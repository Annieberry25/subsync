'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  fetchSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
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

import { PersonalizedHeader } from './personalized-header';
import { UpcomingRenewalsSpotlight } from '@/components/subscriptions/upcoming-renewals-spotlight';
import { CategoryBreakdownCard } from './category-breakdown-card';
import { MostExpensivePlanCard } from './most-expensive-plan-card';
import { SmartInsightCard } from './smart-insight-card';

import SubscriptionModal from '@/components/subscriptions/subscription-modal';
import PaymentReminderModal from '@/components/subscriptions/payment-reminder-modal';
import ConfirmDialog from '@/components/ui/confirm-dialog';

import {
  DollarSign,
  Calendar,
  CreditCard,
  Wallet,
  AlertCircle,
} from 'lucide-react';

export default function DashboardV2() {
  const { toast } = useToast();

  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal & Dialog states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<SubscriptionRow | null>(null);

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
      if (err) {
        setError(err.message || 'Failed to load subscriptions.');
      } else if (data) {
        setSubscriptions(data);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleSave = async (data: Omit<SubscriptionInsert, 'user_id'>, id?: string) => {
    if (id) {
      const { error: err } = await updateSubscription(id, data);
      if (err) throw err;
      toast.success('Subscription updated successfully.', 'Changes Saved');
    } else {
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

  // Metrics
  const monthlySpend = useMemo(() => calculateMonthlySpend(subscriptions), [subscriptions]);
  const renewingThisWeek = useMemo(() => getUpcomingRenewalsCount(subscriptions, 7), [subscriptions]);
  const activeCount = useMemo(() => getActiveCount(subscriptions), [subscriptions]);
  const potentialSavings = useMemo(() => calculatePotentialSavings(subscriptions), [subscriptions]);

  return (
    <div className="space-y-6 sm:space-y-8 bg-ambient-grid min-h-[85vh] pb-32 sm:pb-48">
      {/* 1. HERO SECTION */}
      <PersonalizedHeader
        onRefresh={() => loadData(true)}
        loading={loading}
        renewingThisWeekCount={renewingThisWeek}
      />

      {/* ERROR BANNER */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-rose-400 text-xs">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. FOUR STATISTICS CARDS */}
      {loading && subscriptions.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Card 1: Monthly Spend */}
          <div className="glass-panel group relative overflow-hidden p-5 sm:p-6 rounded-3xl space-y-3 shadow-xl border-l-4 border-l-indigo-500 hover:scale-[1.01] transition-all">
            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-indigo-500/15 blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between relative z-10">
              <span className="text-xs font-bold text-env-body tracking-wider uppercase">Monthly Spend</span>
              <div className="w-11 h-11 rounded-2xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shadow-lg shadow-indigo-500/25">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 relative z-10 min-w-0">
              <span className="text-2xl sm:text-3xl font-black text-env-heading tracking-tight truncate">
                {formatCurrency(monthlySpend)}
              </span>
              <span className="text-[11px] text-indigo-400 font-semibold shrink-0">/ month</span>
            </div>
            <span className="text-[11px] text-env-muted/75 block mt-1.5 relative z-10 truncate">
              Normalized recurring total
            </span>
          </div>

          {/* Card 2: Renewing This Week */}
          <div className="glass-panel group relative overflow-hidden p-5 sm:p-6 rounded-3xl space-y-3 shadow-xl border-l-4 border-l-amber-500 hover:scale-[1.01] transition-all">
            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-amber-500/15 blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between relative z-10">
              <span className="text-xs font-bold text-env-body tracking-wider uppercase">Renewing This Week</span>
              <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/30 shadow-lg shadow-amber-500/25">
                <Calendar className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 relative z-10 min-w-0">
              <span className="text-2xl sm:text-3xl font-black text-env-heading tracking-tight truncate">
                {renewingThisWeek}
              </span>
              <span className="text-[11px] text-amber-400 font-semibold shrink-0">
                {renewingThisWeek === 1 ? 'Subscription' : 'Subscriptions'}
              </span>
            </div>
            <span className="text-[11px] text-env-muted/75 block mt-1.5 relative z-10 truncate">
              Due within next 7 days
            </span>
          </div>

          {/* Card 3: Active Plans */}
          <div className="glass-panel group relative overflow-hidden p-5 sm:p-6 rounded-3xl space-y-3 shadow-xl border-l-4 border-l-env-status-active hover:scale-[1.01] transition-all">
            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-env-status-active-bg blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between relative z-10">
              <span className="text-xs font-bold text-env-body tracking-wider uppercase">Active Plans</span>
              <div className="w-11 h-11 rounded-2xl bg-env-status-active-bg text-env-status-active flex items-center justify-center border border-env-status-active-border shadow-lg">
                <CreditCard className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 relative z-10 min-w-0">
              <span className="text-2xl sm:text-3xl font-black text-env-heading tracking-tight truncate">
                {activeCount}
              </span>
              <span className="text-[11px] text-env-status-active font-semibold shrink-0">Tracked</span>
            </div>
            <span className="text-[11px] text-env-status-active opacity-80 font-semibold block mt-1.5 relative z-10 truncate">
              Active & Trial subscriptions
            </span>
          </div>

          {/* Card 4: Potential Savings */}
          <div className="glass-panel group relative overflow-hidden p-5 sm:p-6 rounded-3xl space-y-3 shadow-xl border-l-4 border-l-purple-500 hover:scale-[1.01] transition-all">
            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-purple-500/15 blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between gap-3 relative z-10">
              <span className="text-xs font-bold text-env-body tracking-wider uppercase">Potential Savings</span>
              <div className="w-11 h-11 rounded-2xl bg-purple-500/15 text-purple-400 flex items-center justify-center border border-purple-500/30 shadow-lg shadow-purple-500/25 -mr-1">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 relative z-10 min-w-0">
              <span className="text-2xl sm:text-3xl font-black text-env-heading tracking-tight truncate">
                {formatCurrency(potentialSavings)}
              </span>
              <span className="text-[11px] text-purple-400 font-semibold shrink-0">/ month</span>
            </div>
            <span className="text-[11px] text-env-muted/75 block mt-1.5 relative z-10 truncate">
              Paused plans & active trials
            </span>
          </div>
        </div>
      )}

      {/* 3. UPCOMING RENEWALS */}
      {!loading && (
        <UpcomingRenewalsSpotlight
          subscriptions={subscriptions}
          onEdit={(sub) => {
            setEditingSubscription(sub);
            setIsModalOpen(true);
          }}
        />
      )}

      {/* 4. SPENDING BY CATEGORY */}
      {!loading && <CategoryBreakdownCard subscriptions={subscriptions} />}

      {/* 5. MOST EXPENSIVE PLAN */}
      {!loading && (
        <MostExpensivePlanCard
          subscriptions={subscriptions}
          onEdit={(sub) => {
            setEditingSubscription(sub);
            setIsModalOpen(true);
          }}
        />
      )}

      {/* 6. SMART INSIGHT */}
      {!loading && <SmartInsightCard subscriptions={subscriptions} />}

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
    </div>
  );
}
