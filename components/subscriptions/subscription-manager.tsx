'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, CreditCard, AlertCircle, XCircle } from 'lucide-react';
import { 
  fetchSubscriptions, 
  createSubscription, 
  updateSubscription, 
  deleteSubscription,
  type SubscriptionRow,
  type SubscriptionInsert 
} from '@/lib/services/subscription-service';

import SubscriptionCard from './subscription-card';
import SubscriptionModal from './subscription-modal';
import SubscriptionFilters from './subscription-filters';
import PaymentReminderModal from './payment-reminder-modal';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { SubscriptionCardSkeleton } from '@/components/ui/skeleton';
import { useToast } from '@/lib/hooks/use-toast';

import { useSearchParams } from 'next/navigation';

export default function SubscriptionManager() {
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const paramHighlight = searchParams.get('highlight');
  const paramCategory = searchParams.get('category');
  const paramStatus = searchParams.get('status');

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
      // Ignore storage errors
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
      // Ignore storage errors
    }
    toast.info(`Dismissed payment reminder for ${sub.name}.`, 'Reminder Dismissed');
  };

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(paramCategory || 'All');
  const [selectedStatus, setSelectedStatus] = useState(paramStatus || 'All');
  const [sortBy, setSortBy] = useState('next_billing_asc');
  const [highlightedSubId, setHighlightedSubId] = useState<string | null>(paramHighlight);

  useEffect(() => {
    if (paramCategory) setSelectedCategory(paramCategory);
    if (paramStatus) setSelectedStatus(paramStatus);
    if (paramHighlight) setHighlightedSubId(paramHighlight);
  }, [paramCategory, paramStatus, paramHighlight]);

  // Scroll into view & highlight effect
  useEffect(() => {
    if (highlightedSubId && !loading && subscriptions.length > 0) {
      const scrollTimer = setTimeout(() => {
        const el = document.getElementById(`sub-card-${highlightedSubId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);

      const clearTimer = setTimeout(() => {
        setHighlightedSubId(null);
      }, 2500);

      return () => {
        clearTimeout(scrollTimer);
        clearTimeout(clearTimer);
      };
    }
  }, [highlightedSubId, loading, subscriptions]);

  // Fetch Subscriptions Data
  const loadData = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await fetchSubscriptions();
    if (err) {
      setError(err.message || 'Failed to load subscriptions.');
    } else if (data) {
      setSubscriptions(data);
    }
    setLoading(false);
  }, []);

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
      toast.success('Subscription updated successfully.', 'Changes Saved');
    } else {
      const { error: err } = await createSubscription(data);
      if (err) throw err;
      toast.success('New subscription added to your portfolio.', 'Subscription Created');
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

  const hasActiveFilters = searchQuery !== '' || selectedCategory !== 'All' || selectedStatus !== 'All';

  return (
    <div className="space-y-6 sm:space-y-8 bg-ambient-grid min-h-[85vh] pb-8 sm:pb-12">
      {/* 1. PAGE HEADER (Primary Action: Add Subscription) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-white tracking-tight leading-[34px]">
            Subscriptions
          </h1>
          <p className="text-[14px] font-normal text-[#A1AAB8] mt-1">
            Manage your active plans, recurring billing cycles, and payment reminders.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingSubscription(null);
            setIsModalOpen(true);
          }}
          className="px-5 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer shrink-0 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add Subscription</span>
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-[#EF4444]/10 border border-[#EF4444]/20 flex items-center gap-3 text-[#EF4444] text-xs">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. SEARCH AND FILTERS BAR */}
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

      {/* 3. SUBSCRIPTIONS GRID / SKELETONS / EMPTY STATES */}
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
              isHighlighted={sub.id === highlightedSubId}
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
        <div className="p-16 rounded-[20px] bg-[#171A21] border border-[#2B313D] text-center flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#4F46E5]/10 border border-[#4F46E5]/20 flex items-center justify-center text-[#4F46E5]">
            {hasActiveFilters ? <XCircle className="w-8 h-8 text-[#F59E0B]" /> : <CreditCard className="w-8 h-8 text-[#4F46E5]" />}
          </div>
          <div className="max-w-xs space-y-1">
            <h3 className="text-base font-bold text-white">
              {hasActiveFilters ? 'No matching subscriptions' : 'No subscriptions added yet'}
            </h3>
            <p className="text-xs text-[#A1AAB8]">
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
                className="px-5 py-2.5 rounded-xl bg-[#1D222B] hover:bg-[#2B313D] text-white text-xs font-semibold border border-[#2B313D] transition-all cursor-pointer"
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
                className="px-6 py-3 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-bold transition-all cursor-pointer"
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

      {/* Payment Reminder Modal */}
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
