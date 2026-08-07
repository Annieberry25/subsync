'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  fetchSubscriptions,
  getCachedSubscriptions,
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

function renderFormattedCurrency(amount: number, currency = 'USD') {
  const formatted = formatCurrency(amount, currency);
  if (formatted.startsWith('$')) {
    return (
      <span className="inline-flex items-baseline">
        <span
          style={{ fontSize: '24px', fontWeight: 600, color: '#FFFFFF' }}
          className="mr-0.5 select-none"
        >
          $
        </span>
        <span
          style={{ fontSize: '30px', fontWeight: 600, lineHeight: '34px', letterSpacing: '-0.02em', color: '#FFFFFF' }}
        >
          {formatted.slice(1)}
        </span>
      </span>
    );
  }
  return (
    <span
      style={{ fontSize: '30px', fontWeight: 600, lineHeight: '34px', letterSpacing: '-0.02em', color: '#FFFFFF' }}
    >
      {formatted}
    </span>
  );
}

export default function DashboardV2() {
  const { toast } = useToast();

  const initialCache = getCachedSubscriptions();
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>(initialCache || []);
  const [loading, setLoading] = useState(!initialCache);
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

  const overdueCount = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return subscriptions.filter((sub) => {
      if (sub.status === 'canceled') return false;
      const nextBilling = new Date(sub.next_billing_date);
      return nextBilling < now;
    }).length;
  }, [subscriptions]);

  const renewalSemantic = useMemo(() => {
    if (overdueCount > 0) {
      return {
        iconColor: 'text-[#EF4444]',
        textColor: 'text-[#EF4444]',
        label: overdueCount === 1 ? 'Overdue subscription' : 'Overdue subscriptions',
      };
    }
    if (renewingThisWeek > 0) {
      return {
        iconColor: 'text-[#F59E0B]',
        textColor: 'text-[#F59E0B]',
        label: renewingThisWeek === 1 ? 'Subscription due' : 'Subscriptions due',
      };
    }
    return {
      iconColor: 'text-[#6F7787]',
      textColor: 'text-[#A1AAB8]',
      label: 'Subscriptions due',
    };
  }, [overdueCount, renewingThisWeek]);

  return (
    <div className="animate-page-transition pt-0 space-y-5 bg-ambient-grid min-h-[85vh] pb-32 sm:pb-48">
      {/* 1. HEADER SECTION */}
      <div className="mb-4">
        <PersonalizedHeader
          renewingThisWeekCount={renewingThisWeek}
        />
      </div>

      {/* ERROR BANNER */}
      {error && (
        <div className="p-4 rounded-2xl bg-[#EF4444]/10 border border-[#EF4444]/20 flex items-center gap-3 text-[#EF4444] text-xs">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. KPI METRICS (Sits directly on dashboard background) */}
      {loading && subscriptions.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Card 1: Monthly Spend */}
          <div className="px-5 py-4 rounded-2xl bg-[#1D222B] border border-[#2B313D] flex flex-col justify-center min-h-[104px]">
            <div className="flex items-baseline justify-between">
              <span style={{ fontSize: '16px', fontWeight: 600, color: '#FFFFFF', lineHeight: '20px' }}>
                Monthly Spend
              </span>
              <DollarSign className="w-4 h-4 text-[#6F7787] translate-y-[1px]" />
            </div>
            <div className="mt-2">
              <div>
                {renderFormattedCurrency(monthlySpend)}
              </div>
              <span
                style={{ fontSize: '15px', fontWeight: 400, lineHeight: '22px', color: '#A1AAB8' }}
                className="block mt-2"
              >
                Normalized monthly expense
              </span>
            </div>
          </div>

          {/* Card 2: Renewing This Week */}
          <div className="px-5 py-4 rounded-2xl bg-[#1D222B] border border-[#2B313D] flex flex-col justify-center min-h-[104px]">
            <div className="flex items-baseline justify-between">
              <span style={{ fontSize: '16px', fontWeight: 600, color: '#FFFFFF', lineHeight: '20px' }}>
                Renewing This Week
              </span>
              <Calendar className={`w-4 h-4 ${renewalSemantic.iconColor} translate-y-[1px]`} />
            </div>
            <div className="mt-2">
              <div style={{ fontSize: '30px', fontWeight: 600, lineHeight: '34px', letterSpacing: '-0.02em', color: '#FFFFFF' }}>
                {renewingThisWeek}
              </div>
              <span
                style={{ fontSize: '15px', fontWeight: 400, lineHeight: '22px' }}
                className={`block mt-2 ${renewalSemantic.textColor}`}
              >
                {renewalSemantic.label}
              </span>
            </div>
          </div>

          {/* Card 3: Active Plans */}
          <div className="px-5 py-4 rounded-2xl bg-[#1D222B] border border-[#2B313D] flex flex-col justify-center min-h-[104px]">
            <div className="flex items-baseline justify-between">
              <span style={{ fontSize: '16px', fontWeight: 600, color: '#FFFFFF', lineHeight: '20px' }}>
                Active Plans
              </span>
              <CreditCard className="w-4 h-4 text-[#22C55E] translate-y-[1px]" />
            </div>
            <div className="mt-2">
              <div style={{ fontSize: '30px', fontWeight: 600, lineHeight: '34px', letterSpacing: '-0.02em', color: '#FFFFFF' }}>
                {activeCount}
              </div>
              <span
                style={{ fontSize: '15px', fontWeight: 400, lineHeight: '22px', color: '#22C55E' }}
                className="block mt-2"
              >
                Active & trial subscriptions
              </span>
            </div>
          </div>

          {/* Card 4: Potential Savings */}
          <div className="px-5 py-4 rounded-2xl bg-[#1D222B] border border-[#2B313D] flex flex-col justify-center min-h-[104px]">
            <div className="flex items-baseline justify-between">
              <span style={{ fontSize: '16px', fontWeight: 600, color: '#FFFFFF', lineHeight: '20px' }}>
                Potential Savings
              </span>
              <Wallet className="w-4 h-4 text-[#A1AAB8] translate-y-[1px]" />
            </div>
            <div className="mt-2">
              <div>
                {renderFormattedCurrency(potentialSavings)}
              </div>
              <span
                style={{ fontSize: '15px', fontWeight: 400, lineHeight: '22px', color: '#A1AAB8' }}
                className="block mt-2"
              >
                From paused/trial plans
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. UPCOMING RENEWALS */}
      {!loading && (
        <UpcomingRenewalsSpotlight
          subscriptions={subscriptions}
        />
      )}

      {/* 4. SPENDING BY CATEGORY */}
      {!loading && <CategoryBreakdownCard subscriptions={subscriptions} />}

      {/* 5. MOST EXPENSIVE PLAN */}
      {!loading && (
        <MostExpensivePlanCard
          subscriptions={subscriptions}
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
