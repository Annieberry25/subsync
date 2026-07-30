'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  fetchSubscriptions, 
  createSubscription, 
  updateSubscription, 
  deleteSubscription,
  type SubscriptionRow,
  type SubscriptionInsert 
} from '@/lib/services/subscription-service';
import { 
  calculateMonthlySpend, 
  calculateAnnualSpend, 
  getActiveCount, 
  getUpcomingRenewalsCount, 
  formatCurrency 
} from '@/lib/utils/metrics-utils';

import SubscriptionCard from './subscription-card';
import SubscriptionModal from './subscription-modal';
import SubscriptionFilters from './subscription-filters';
import PaymentReminderModal from './payment-reminder-modal';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { MetricCardSkeleton, SubscriptionCardSkeleton } from '@/components/ui/skeleton';
import { useToast } from '@/lib/hooks/use-toast';
import { PersonalizedHeader } from '@/components/dashboard/personalized-header';
import { UpcomingRenewalsSpotlight } from '@/components/subscriptions/upcoming-renewals-spotlight';

import { 
  CreditCard, 
  DollarSign, 
  Calendar, 
  TrendingUp, 
  AlertCircle,
  XCircle
} from 'lucide-react';

export default function SubscriptionManager() {
  const { toast } = useToast();

  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal & Confirm State
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

  const handleSaveReminder = (subId: string, data: { timing: string; method: string; note?: string }) => {
    const updated = {
      ...reminders,
      [subId]: { ...data, dismissed: false },
    };
    setReminders(updated);
    try {
      localStorage.setItem('subsync_reminders', JSON.stringify(updated));
    } catch {
      // Ignore localStorage errors
    }
    toast.success(`Payment reminder configured for subscription.`, 'Reminder Set');
  };

  const handleDismissReminder = (sub: SubscriptionRow) => {
    const existing = reminders[sub.id] || { timing: '7_days', method: 'both' };
    const updated = {
      ...reminders,
      [sub.id]: { ...existing, dismissed: true },
    };
    setReminders(updated);
    try {
      localStorage.setItem('subsync_reminders', JSON.stringify(updated));
    } catch {
      // Ignore localStorage errors
    }
    toast.info(`Dismissed payment reminder for ${sub.name}.`, 'Reminder Dismissed');
  };

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [sortBy, setSortBy] = useState('next_billing_asc');

  // Fetch Subscriptions Data
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

  // Handle Save (Create / Update)
  const handleSave = async (data: Omit<SubscriptionInsert, 'user_id'>, id?: string) => {
    if (id) {
      const { error: err } = await updateSubscription(id, data);
      if (err) throw err;
    } else {
      const { error: err } = await createSubscription(data);
      if (err) throw err;
    }
    await loadData();
  };

  // Handle Delete Confirmation
  const handleConfirmDelete = async () => {
    if (!deletingSubscription) return;
    setDeleteLoading(true);

    const { error: err } = await deleteSubscription(deletingSubscription.id);
    setDeleteLoading(false);

    if (err) {
      toast.error(err.message, 'Deletion Failed');
    } else {
      toast.success(`Removed "${deletingSubscription.name}" from your subscriptions.`, 'Subscription Deleted');
      setDeletingSubscription(null);
      await loadData();
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('All');
    setSelectedStatus('All');
    setSortBy('next_billing_asc');
  };

  // Filter and Sort subscriptions
  const filteredSubscriptions = useMemo(() => {
    return subscriptions
      .filter((sub) => {
        const matchesSearch = sub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (sub.notes && sub.notes.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesCategory = selectedCategory === 'All' || sub.category === selectedCategory;
        const matchesStatus = selectedStatus === 'All' || sub.status === selectedStatus;
        return matchesSearch && matchesCategory && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'next_billing_asc') {
          return new Date(a.next_billing_date).getTime() - new Date(b.next_billing_date).getTime();
        }
        if (sortBy === 'price_desc') {
          return Number(b.price) - Number(a.price);
        }
        if (sortBy === 'price_asc') {
          return Number(a.price) - Number(b.price);
        }
        if (sortBy === 'name_asc') {
          return a.name.localeCompare(b.name);
        }
        return 0;
      });
  }, [subscriptions, searchQuery, selectedCategory, selectedStatus, sortBy]);

  // Calculated Metrics
  const monthlySpend = useMemo(() => calculateMonthlySpend(subscriptions), [subscriptions]);
  const annualSpend = useMemo(() => calculateAnnualSpend(subscriptions), [subscriptions]);
  const activeCount = useMemo(() => getActiveCount(subscriptions), [subscriptions]);
  const upcomingCount = useMemo(() => getUpcomingRenewalsCount(subscriptions), [subscriptions]);

  const hasActiveFilters = searchQuery !== '' || selectedCategory !== 'All' || selectedStatus !== 'All';

  return (
    <div className="space-y-6 sm:space-y-8 bg-ambient-grid min-h-[85vh] pb-32 sm:pb-48">
      {/* 1. HERO PANEL (Centerpiece Header) */}
      <PersonalizedHeader
        onRefresh={() => loadData(true)}
        onAddSubscription={() => {
          setEditingSubscription(null);
          setIsModalOpen(true);
        }}
        loading={loading}
      />

      {/* 2. STATISTICS SUMMARY CARDS */}
      {loading && subscriptions.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Monthly Spend */}
          <div className="glass-panel group relative overflow-hidden p-5 sm:p-6 rounded-3xl space-y-3 shadow-xl border-l-4 border-l-indigo-500 hover:scale-[1.01] transition-all">
            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-indigo-500/15 blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between relative z-10">
              <span className="text-xs font-bold text-env-body tracking-wider uppercase">Monthly Spend</span>
              <div className="w-11 h-11 rounded-2xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shadow-lg shadow-indigo-500/25">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 relative z-10 min-w-0">
              <span className="text-2xl sm:text-3xl font-black text-env-heading tracking-tight truncate">{formatCurrency(monthlySpend)}</span>
              <span className="text-[11px] text-indigo-400 font-semibold shrink-0">/ month</span>
            </div>
            <span className="text-[11px] text-env-muted/75 block mt-1.5 relative z-10 truncate">Normalized recurring monthly total</span>
          </div>

          {/* Annual Spend */}
          <div className="glass-panel group relative overflow-hidden p-5 sm:p-6 rounded-3xl space-y-3 shadow-xl border-l-4 border-l-purple-500 hover:scale-[1.01] transition-all">
            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-purple-500/15 blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between relative z-10">
              <span className="text-xs font-bold text-env-body tracking-wider uppercase">Annual Projection</span>
              <div className="w-11 h-11 rounded-2xl bg-purple-500/15 text-purple-400 flex items-center justify-center border border-purple-500/30 shadow-lg shadow-purple-500/25">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 relative z-10 min-w-0">
              <span className="text-2xl sm:text-3xl font-black text-env-heading tracking-tight truncate">{formatCurrency(annualSpend)}</span>
              <span className="text-[11px] text-purple-400 font-semibold shrink-0">/ year</span>
            </div>
            <span className="text-[11px] text-env-muted/75 block mt-1.5 relative z-10 truncate">Projected yearly total expenditure</span>
          </div>

          {/* Active Subscriptions */}
          <div className="glass-panel group relative overflow-hidden p-5 sm:p-6 rounded-3xl space-y-3 shadow-xl border-l-4 border-l-env-status-active hover:scale-[1.01] transition-all">
            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-env-status-active-bg blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between relative z-10">
              <span className="text-xs font-bold text-env-body tracking-wider uppercase">Active Plans</span>
              <div className="w-11 h-11 rounded-2xl bg-env-status-active-bg text-env-status-active flex items-center justify-center border border-env-status-active-border shadow-lg">
                <CreditCard className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 relative z-10 min-w-0">
              <span className="text-2xl sm:text-3xl font-black text-env-heading tracking-tight truncate">{activeCount}</span>
              <span className="text-[11px] text-env-status-active font-semibold shrink-0">Tracked</span>
            </div>
            <span className="text-[11px] text-env-status-active opacity-80 font-semibold block mt-1.5 relative z-10 truncate">Active & Trial subscriptions</span>
          </div>

          {/* Upcoming Renewals */}
          <div className="glass-panel group relative overflow-hidden p-5 sm:p-6 rounded-3xl space-y-3 shadow-xl border-l-4 border-l-env-status-warning hover:scale-[1.01] transition-all">
            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-env-status-warning-bg blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between relative z-10">
              <span className="text-xs font-bold text-env-body tracking-wider uppercase">Due in 30 Days</span>
              <div className="w-11 h-11 rounded-2xl bg-env-status-warning-bg text-env-status-warning flex items-center justify-center border border-env-status-warning-border shadow-lg">
                <Calendar className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 relative z-10 min-w-0">
              <span className="text-2xl sm:text-3xl font-black text-env-heading tracking-tight truncate">{upcomingCount}</span>
              <span className="text-[11px] text-env-status-warning font-semibold shrink-0">Pending</span>
            </div>
            <span className="text-[11px] text-env-status-warning opacity-80 font-semibold block mt-1.5 relative z-10 truncate">Upcoming billing renewal dates</span>
          </div>
        </div>
      )}

      {/* 3. UPCOMING RENEWALS SPOTLIGHT BANNER */}
      {!loading && (
        <UpcomingRenewalsSpotlight
          subscriptions={subscriptions}
          onEdit={(sub) => {
            setEditingSubscription(sub);
            setIsModalOpen(true);
          }}
        />
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-rose-400 text-xs">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 4. SEARCH AND FILTERS BAR */}
      <SubscriptionFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      {/* 5. SUBSCRIPTIONS GRID / SKELETONS / EMPTY STATES */}
      {loading && subscriptions.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <SubscriptionCardSkeleton />
          <SubscriptionCardSkeleton />
          <SubscriptionCardSkeleton />
        </div>
      ) : filteredSubscriptions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSubscriptions.map((sub) => (
            <SubscriptionCard
              key={sub.id}
              subscription={sub}
              onEdit={(item) => {
                setEditingSubscription(item);
                setIsModalOpen(true);
              }}
              onDeleteRequest={(item) => setDeletingSubscription(item)}
              onPaymentReminderRequest={(item) => setReminderSubscription(item)}
              reminderInfo={reminders[sub.id] || null}
              onDismissReminder={handleDismissReminder}
            />
          ))}
        </div>
      ) : (
        <div className="glass-panel p-16 rounded-3xl text-center flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-xl">
            {hasActiveFilters ? <XCircle className="w-8 h-8 text-amber-400" /> : <CreditCard className="w-8 h-8 text-indigo-400" />}
          </div>
          <div className="max-w-xs space-y-1">
            <h3 className="text-base font-bold text-env-heading">
              {hasActiveFilters ? 'No matching subscriptions' : 'No subscriptions added yet'}
            </h3>
            <p className="text-xs text-env-body">
              {hasActiveFilters
                ? 'No subscriptions match your current search terms or filter criteria.'
                : 'Track your recurring Netflix, Spotify, or software subscriptions in one place.'}
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="px-5 py-2.5 rounded-2xl bg-env-button-sec hover:bg-env-button-sec-hover text-env-heading text-xs font-semibold border border-env-main transition-all cursor-pointer"
              >
                Clear All Filters
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditingSubscription(null);
                  setIsModalOpen(true);
                }}
                className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
              >
                Add Your First Subscription
              </button>
            )}
          </div>
        </div>
      )}

      {/* Subscription Form Modal */}
      <SubscriptionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingSubscription(null);
        }}
        onSave={handleSave}
        initialData={editingSubscription}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={!!deletingSubscription}
        onClose={() => setDeletingSubscription(null)}
        onConfirm={handleConfirmDelete}
        loading={deleteLoading}
        title={`Delete "${deletingSubscription?.name}"?`}
        description="Are you sure you want to delete this subscription? This action cannot be undone and will update your expense analytics."
        confirmText="Delete Subscription"
        variant="danger"
      />

      {/* Payment Reminder Modal (Single Source of Truth) */}
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
