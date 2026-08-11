'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, CreditCard, AlertCircle, XCircle, LayoutGrid, List } from 'lucide-react';
import { 
  fetchSubscriptions, 
  createSubscription, 
  updateSubscription, 
  softDeleteSubscription,
  archiveSubscription,
  filterActiveSubscriptions,
  type SubscriptionRow,
  type SubscriptionInsert 
} from '@/lib/services/subscription-service';

import SubscriptionCard from './subscription-card';
import SubscriptionTable from './subscription-table';
import SubscriptionDetailModal from './subscription-detail-modal';
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

  // View Mode: 'table' (default list/table) or 'grid' (cards)
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Detail View Modal state
  const [selectedDetailSub, setSelectedDetailSub] = useState<SubscriptionRow | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Modal & Confirm State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<SubscriptionRow | null>(null);
  const [returnToDetailSub, setReturnToDetailSub] = useState<SubscriptionRow | null>(null);

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

  // Handle Archive
  const handleArchiveSubscription = async (sub: SubscriptionRow) => {
    const { error: err } = await archiveSubscription(sub.id);
    if (err) {
      toast.error(err.message, 'Archiving Failed');
    } else {
      toast.success(`Moved "${sub.name}" to History → Archive.`, 'Subscription Archived');
      await loadData();
    }
  };

  // Handle Soft Delete Confirmation
  const handleConfirmDelete = async () => {
    if (!deletingSubscription) return;
    setDeleteLoading(true);

    const { error: err } = await softDeleteSubscription(deletingSubscription.id);
    setDeleteLoading(false);

    if (err) {
      toast.error(err.message, 'Deletion Failed');
    } else {
      toast.success(`Moved "${deletingSubscription.name}" to History → Deleted.`, 'Subscription Moved to Deleted');
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

  // Active Subscriptions
  const activeSubscriptions = useMemo(() => filterActiveSubscriptions(subscriptions), [subscriptions]);

  // Filter and Sort active subscriptions
  const filteredSubscriptions = useMemo(() => {
    return activeSubscriptions
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
  }, [activeSubscriptions, searchQuery, selectedCategory, selectedStatus, sortBy]);

  const hasActiveFilters = searchQuery !== '' || selectedCategory !== 'All' || selectedStatus !== 'All';

  return (
    <div className="space-y-6 sm:space-y-8 bg-ambient-grid min-h-[85vh] pb-72 sm:pb-80">
      {/* 1. PAGE HEADER (Primary Action: Add Subscription & View Switcher) */}
      <div className="flex items-center justify-between sm:justify-end gap-4">
        <h1 className="sr-only">Subscriptions</h1>
        <div className="flex items-center gap-3">
          {/* Layout View Toggle */}
          <div className="flex items-center bg-[#0D0F0F] border border-[#1A1D1D] rounded-xl p-1 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              title="Table/List View"
              aria-label="Table view"
              className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-[#14B8A6] text-[#091512] font-semibold'
                  : 'text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D]'
              }`}
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title="Grid Cards View"
              aria-label="Grid view"
              className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-[#14B8A6] text-[#091512] font-semibold'
                  : 'text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D]'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Cards</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingSubscription(null);
              setIsModalOpen(true);
            }}
            className="px-5 py-2.5 rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer shrink-0 shadow-sm min-h-[44px]"
          >
            <Plus className="w-4 h-4 text-[#091512]" />
            <span>Add Subscription</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-[#D9363E]/10 border border-[#D9363E]/20 flex items-center gap-3 text-[#D9363E] text-xs">
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

      {/* 3. SUBSCRIPTIONS TABLE / GRID / SKELETONS / EMPTY STATES */}
      {loading && subscriptions.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <SubscriptionCardSkeleton />
          <SubscriptionCardSkeleton />
          <SubscriptionCardSkeleton />
        </div>
      ) : filteredSubscriptions.length > 0 ? (
        viewMode === 'table' ? (
          <SubscriptionTable
            subscriptions={filteredSubscriptions}
            highlightedSubId={highlightedSubId}
            onSelectSubscription={(item) => {
              setSelectedDetailSub(item);
              setIsDetailOpen(true);
            }}
            onEdit={(item) => {
              setEditingSubscription(item);
              setIsModalOpen(true);
            }}
            onDeleteRequest={(item) => setDeletingSubscription(item)}
            onPaymentReminderRequest={(item) => setReminderSubscription(item)}
            reminders={reminders}
            onDismissReminder={handleDismissReminder}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSubscriptions.map((sub) => (
              <div
                key={sub.id}
                onClick={() => {
                  setSelectedDetailSub(sub);
                  setIsDetailOpen(true);
                }}
                className="cursor-pointer"
              >
                <SubscriptionCard
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
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="p-16 rounded-[20px] bg-[#0B0D0D] border border-[#1A1D1D] text-center flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#14B8A6]/15 border border-[#14B8A6]/30 flex items-center justify-center text-[#14B8A6]">
            {hasActiveFilters ? <XCircle className="w-8 h-8 text-[#F59E0B]" /> : <CreditCard className="w-8 h-8 text-[#14B8A6]" />}
          </div>
          <div className="max-w-xs space-y-1">
            <h3 className="text-base font-bold text-[#F5F7F6]">
              {hasActiveFilters ? 'No matching subscriptions' : 'No subscriptions added yet'}
            </h3>
            <p className="text-xs text-[#94A3B8]">
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
                className="px-5 py-2.5 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] text-[#F5F7F6] text-xs font-semibold border border-[#1A1D1D] transition-all cursor-pointer"
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
                className="px-6 py-3 rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-bold transition-all cursor-pointer"
              >
                Add Your First Subscription
              </button>
            )}
          </div>
        </div>
      )}

      {/* Subscription Detail View Modal */}
      <SubscriptionDetailModal
        subscription={selectedDetailSub}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedDetailSub(null);
        }}
        onEdit={(item) => {
          setReturnToDetailSub(item);
          setIsDetailOpen(false);
          setEditingSubscription(item);
          setIsModalOpen(true);
        }}
        onDeleteRequest={(item) => setDeletingSubscription(item)}
        onPaymentReminderRequest={(item) => setReminderSubscription(item)}
      />

      {/* Subscription Form Modal */}
      <SubscriptionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingSubscription(null);
          if (returnToDetailSub) {
            const updated = subscriptions.find((s) => s.id === returnToDetailSub.id) || returnToDetailSub;
            setSelectedDetailSub(updated);
            setIsDetailOpen(true);
            setReturnToDetailSub(null);
          }
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
        title={`Move "${deletingSubscription?.name}" to Deleted?`}
        description="This subscription will be removed from your active list and moved to History → Deleted where you can review or restore it anytime."
        confirmText="Move to Deleted"
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
