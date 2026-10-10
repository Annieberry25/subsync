'use client';
import { safeSetItem, safeGetItem } from '@/lib/safe-local-storage';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, AlertCircle, LayoutGrid, List, Trash2 } from 'lucide-react';
import { hasReachedSubscriptionCap } from '@/lib/constants/plan-limits';
import { 
  fetchSubscriptions, 
  createSubscription, 
  updateSubscription, 
  softDeleteSubscription,
  archiveSubscription,
  filterActiveSubscriptions,
  isOverdueSubscription,
  isSubscriptionDeleted,
  type SubscriptionRow,
  type SubscriptionInsert
} from '@/lib/services/subscription-service';
import {
  fetchReminderPreferences,
  saveReminderPreference,
  type ReminderPreference,
} from '@/lib/services/reminder-preferences';

import SubscriptionCard from './subscription-card';
import SubscriptionTable from './subscription-table';
import SubscriptionDetailModal from './subscription-detail-modal';
import SubscriptionModal from './subscription-modal';
import AddSubscriptionModal from './add-subscription-modal';
import SubscriptionNotesModal from './subscription-notes-modal';
import SubscriptionFilters from './subscription-filters';
import PaymentReminderModal from './payment-reminder-modal';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { SubscriptionCardSkeleton } from '@/components/ui/skeleton';
import { useToast } from '@/lib/hooks/use-toast';
import { usePlan } from '@/lib/contexts/user-settings-context';
import { AdBanner } from '@/components/dashboard/ad-banner';
import UpgradeModal from './upgrade-modal';
import { GmailConnectModal } from '@/components/integrations/gmail-connect-modal';

import { useSearchParams, useRouter } from 'next/navigation';

export default function SubscriptionManager() {
  const { toast } = useToast();
  const { planTier } = usePlan();
  const searchParams = useSearchParams();
  const router = useRouter();

  const paramHighlight = searchParams.get('highlight');
  const paramCategory = searchParams.get('category');
  const paramStatus = searchParams.get('status');
  const paramSort = searchParams.get('sort');
  const _paramLinked = searchParams.get('linked');
  const _paramEmail = searchParams.get('email');
  const paramGmailConnected = searchParams.get('gmailConnected');
  const paramGmailError = searchParams.get('gmailError');

  const [gmailAutoScan, setGmailAutoScan] = useState(false);

  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isGmailModalOpen, setIsGmailModalOpen] = useState(false);

  // View Mode: 'table' (list) or 'grid' (cards)
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  /* The list view is offered at every width. It used to be gated behind
     `isWideViewport` (>=768px) with the toggle hidden on phones, on the
     assumption that a 700px-min table is unusable on a small screen. That is
     not true of this table: `.table-scroll` scrolls it horizontally and the
     provider column is pinned, so the name stays readable while the remaining
     columns scroll under it. Hiding the toggle also meant a phone could never
     reach the list view at all. */
  const isTableView = viewMode === 'table';

  // Detail View Modal state
  const [selectedDetailSub, setSelectedDetailSub] = useState<SubscriptionRow | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  /**
   * A deep link that resolves to a deleted row.
   *
   * Kept separate from `selectedDetailSub` so the notice renders as page content
   * instead of inside the detail sheet: the sheet's whole layout assumes a live
   * subscription and its actions are the ones that do not apply here.
   */
  const [deletedTarget, setDeletedTarget] = useState<SubscriptionRow | null>(null);

  /** The `highlight` param whose deep link has already been acted on. */
  const [resolvedHighlight, setResolvedHighlight] = useState<string | null>(null);

  // Add Subscription Modal State
  const [isAddPathModalOpen, setIsAddPathModalOpen] = useState(false);
  const [addPathInitial, setAddPathInitial] = useState<'gmail' | 'forwarding' | 'link' | 'receipt' | null>(null);
  const [pendingReceiptFile, setPendingReceiptFile] = useState<File | null>(null);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  // Notes Modal state
  const [notesSub, setNotesSub] = useState<SubscriptionRow | null>(null);

  // Manual Form Modal & Confirm State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<SubscriptionRow | null>(null);
  const [returnToDetailSub, setReturnToDetailSub] = useState<SubscriptionRow | null>(null);

  const [deletingSubscription, setDeletingSubscription] = useState<SubscriptionRow | null>(null);
  const [deleteReturnToDetailSub, setDeleteReturnToDetailSub] = useState<SubscriptionRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [reminderSubscription, setReminderSubscription] = useState<SubscriptionRow | null>(null);
  const [reminderReturnToDetailSub, setReminderReturnToDetailSub] = useState<SubscriptionRow | null>(null);
  const [reminders, setReminders] = useState<Record<string, { timing: string; method: string; note?: string; dismissed?: boolean }>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const saved = safeGetItem('subhalt_reminders');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  /* Server-side reminder preferences, keyed by subscription id.
     Loaded so the reminder sheet shows what is actually saved rather than
     resetting to defaults every time it is opened. */
  const [reminderPrefs, setReminderPrefs] = useState<ReminderPreference[]>([]);

  useEffect(() => {
    let active = true;
    fetchReminderPreferences().then((prefs) => {
      if (!active) return;
      setReminderPrefs(prefs);
    });
    return () => {
      active = false;
    };
  }, []);

  const reminderPrefBySub = useMemo(() => {
    const map = new Map<string, ReminderPreference>();
    for (const pref of reminderPrefs) map.set(pref.subscriptionId, pref);
    return map;
  }, [reminderPrefs]);

  const handleSaveReminder = async (
    subId: string,
    data: { emailLeadDays: number | null; pushLeadDays: number | null; note?: string }
  ) => {
    // localStorage first so the on-screen badge updates even if the write below
    // fails; the database copy is what the cron actually reads.
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

    if (saved) {
      setReminderPrefs((prev) => [
        ...prev.filter((p) => p.subscriptionId !== subId),
        {
          subscriptionId: subId,
          emailLeadDays: data.emailLeadDays,
          pushLeadDays: data.pushLeadDays,
          note: data.note ?? null,
        },
      ]);
    }

    // The local copy succeeded, so saying "reminder saved" and then having nothing
    // arrive at the renewal would be the worst outcome: the user has no way to tell
    // the difference between "saved" and "saved locally but the server never sees it".
    if (!saved) {
      toast.warning(
        'Reminder saved on this device, but not synced. It may not fire. Check your connection and try again.',
        'Reminder Not Synced'
      );
      return;
    }

    toast.success('Reminder saved.', 'Reminder Set');
  };

  const handleDismissReminder = (sub: SubscriptionRow) => {
    const existing = reminders[sub.id] || { timing: '7_days', method: 'both' };
    const updated = {
      ...reminders,
      [sub.id]: { ...existing, dismissed: true },
    };
    setReminders(updated);
    try {
      safeSetItem('subhalt_reminders', JSON.stringify(updated));
    } catch {
      // Ignore storage errors
    }
  };

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(paramCategory || 'All');
  const [selectedStatus, setSelectedStatus] = useState(paramStatus || 'All');
  const [sortBy, setSortBy] = useState(paramSort || 'next_billing_asc');
  const [highlightedSubId, setHighlightedSubId] = useState<string | null>(paramHighlight);

  // Sync URL params into filter state via render-phase adjustment (no effect).
  const [prevParamState, setPrevParamState] = useState({
    category: paramCategory,
    status: paramStatus,
    highlight: paramHighlight,
    sort: paramSort,
  });
  if (
    paramCategory !== prevParamState.category ||
    paramStatus !== prevParamState.status ||
    paramHighlight !== prevParamState.highlight ||
    paramSort !== prevParamState.sort
  ) {
    setPrevParamState({ category: paramCategory, status: paramStatus, highlight: paramHighlight, sort: paramSort });
    if (paramCategory) setSelectedCategory(paramCategory);
    if (paramStatus) setSelectedStatus(paramStatus);
    if (paramHighlight) setHighlightedSubId(paramHighlight);
    if (paramSort) setSortBy(paramSort);
  }

  /*
    * Open the detail view when search parameter detail=true is specified.

    * `resolvedHighlight` records which param has already been acted on. It is
    * required, not an optimisation: this is a render-phase adjustment, so it
    * re-runs on every render until the state it writes matches what it reads.
    * Guarding only on `deletedTarget` would mean dismissing the notice sets it
    * back to null and the next render re-opens the notice it just closed.
    */
  if (
    paramHighlight &&
    searchParams.get('detail') === 'true' &&
    !loading &&
    subscriptions.length > 0 &&
    !isDetailOpen &&
    resolvedHighlight !== paramHighlight
  ) {
    const decodedParam = decodeURIComponent(paramHighlight).toLowerCase().trim();
    const match = subscriptions.find(
      (s) =>
        s.id === paramHighlight ||
        s.name.toLowerCase().trim() === paramHighlight.toLowerCase().trim() ||
        s.name.toLowerCase().trim() === decodedParam
    );
    if (match) {
      setResolvedHighlight(paramHighlight);
      /*
       * A deep link can point at a row that has since been moved to Deleted —
       * the inbox builds these links from a stored subscription name, so they go
       * stale that way. Opening the normal detail sheet there offered Edit, Set
       * Reminder and Move to Deleted on a deleted row: edits were rejected by the
       * save path, losing the change, and Move to Deleted re-ran a delete the
       * user had already performed. Shown as a read-only notice instead.
       */
      if (isSubscriptionDeleted(match)) {
        setDeletedTarget(match);
      } else {
        setSelectedDetailSub(match);
        setIsDetailOpen(true);
      }
    }
  }

  // Open the add flow when the contextual FAB deep-links here with ?add=true.
  //
  // Guarded by a `handled` flag rather than a previous-value comparison like
  // the filter params above: `useState(paramAdd)` would seed the comparison
  // with the current value, so a direct load of `?add=true` (refresh, or
  // opening the FAB link in a new tab) would see no change and never open the
  // modal. This matches how the OAuth callback params below are handled.
  const paramAdd = searchParams.get('add');
  const [addParamHandled, setAddParamHandled] = useState(false);
  if (!addParamHandled && paramAdd === 'true') {
    setAddParamHandled(true);
    if (!isAddPathModalOpen) {
      setAddPathInitial(null);
      setIsAddPathModalOpen(true);
    }
  }

  // React to OAuth callback redirects (?gmailConnected=1 / ?gmailError=1).
  const [gmailParamHandled, setGmailParamHandled] = useState(false);
  if (!gmailParamHandled && (paramGmailConnected === '1' || paramGmailError === '1')) {
    setGmailParamHandled(true);
    if (paramGmailConnected === '1') {
      setGmailAutoScan(true);
      setIsGmailModalOpen(true);
    }
  }

  useEffect(() => {
    if (paramGmailConnected === '1') {
      router.replace(window.location.pathname, { scroll: false });
      toast.success('Gmail connected successfully.', 'Gmail Connected');
    } else if (paramGmailError === '1') {
      router.replace(window.location.pathname, { scroll: false });
      toast.error('Gmail connection failed. Please try again.', 'Gmail Error');
    }
  }, [paramGmailConnected, paramGmailError, router, toast]);

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
    const handleUpdate = () => {
      fetchSubscriptions().then(({ data }) => {
        if (active && data) setSubscriptions(data);
      }).catch(() => {});
    };

    fetchSubscriptions().then(({ data, error: err }) => {
      if (!active) return;
      if (err) {
        setError(err.message || 'Failed to load subscriptions.');
      } else if (data) {
        setSubscriptions(data);
      }
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      setLoading(false);
    });

    window.addEventListener('subhalt_subscriptions_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      active = false;
      window.removeEventListener('subhalt_subscriptions_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Handle Save (Create / Update)
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
        toast.warning('Saved on this device only. It will sync to your account when you are back online.', 'Offline Save');
      }
      await loadData();
      return id;
    }

    if (hasReachedSubscriptionCap({ tier: planTier, activeCount: activeSubscriptions.length })) {
      setIsUpgradeModalOpen(true);
      return null;
    }

    const { data: created, error: err, synced } = await createSubscription(data);
    if (err) throw err;
    if (synced) {
      toast.success('Subscription created successfully.', 'Subscription Created');
    } else {
      toast.warning('Added on this device only. It will sync to your account when you are back online.', 'Offline Save');
    }
    await loadData();
    return created ? created.id : null;
  };

  // Handle Archive
  const handleArchiveSubscription = async (sub: SubscriptionRow) => {
    const { error: err } = await archiveSubscription(sub.id);
    if (err) {
      toast.error(err.message, 'Archiving Failed');
    } else {
      toast.success(`Moved "${sub.name}" to Archive.`, 'Subscription Archived');
      await loadData();
    }
  };

  // Handle Soft Delete Confirmation
  const handleConfirmDelete = async () => {
    if (!deletingSubscription) return;

    // Guard a second click. The confirm button stays mounted while the request is
    // in flight, and a second tap used to fire a second softDelete for the same
    // id — two "moved to Deleted" toasts, and a second write against a row that
    // was already gone.
    if (deleteLoading) return;

    // The row may already be soft-deleted: the detail view stays open behind the
    // dialog, and deleting from there then reopening it left this reachable.
    if (isSubscriptionDeleted(deletingSubscription)) {
      toast.info(
        `"${deletingSubscription.name}" has already been moved to Deleted.`,
        'Already Deleted'
      );
      setDeletingSubscription(null);
      setDeleteReturnToDetailSub(null);
      return;
    }

    setDeleteLoading(true);

    const { error: err } = await softDeleteSubscription(deletingSubscription.id);
    setDeleteLoading(false);

    if (err) {
      toast.error(err.message, 'Deletion Failed');
    } else {
      toast.success(`Moved "${deletingSubscription.name}" to Deleted.`, 'Subscription Moved to Deleted');
      setDeletingSubscription(null);
      setDeleteReturnToDetailSub(null);
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
  const activeSubscriptions = filterActiveSubscriptions(subscriptions);

  /**
   * Overdue rows are kept off this list and surfaced in Past Activities instead.
   * Filtered here rather than in `fetchSubscriptions` so they remain available to
   * the dashboard's overdue banner and the renewals page.
   */
  const filteredSubscriptions = useMemo(() => {
    return activeSubscriptions
      .filter((sub) => !isOverdueSubscription(sub))
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

  const PAGE_SIZE = 20;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const paginatedSubscriptions = useMemo(
    () => filteredSubscriptions.slice(0, visibleCount),
    [filteredSubscriptions, visibleCount]
  );
  const hasMore = filteredSubscriptions.length > visibleCount;

  const handleSelectSubscription = useCallback((item: SubscriptionRow) => {
    setSelectedDetailSub(item);
    setIsDetailOpen(true);
  }, []);

  const handleEditSubscription = useCallback((item: SubscriptionRow) => {
    setEditingSubscription(item);
    setIsModalOpen(true);
  }, []);

  const handleDeleteRequest = useCallback((item: SubscriptionRow) => {
    setDeletingSubscription(item);
  }, []);

  return (
    <div className="space-y-6 sm:space-y-8 bg-ambient-grid min-h-[85dvh] pb-12 sm:pb-16">
      {/* 1. PAGE HEADER (Title + Count + Consolidated Actions) */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Title, Live Count Badge & Subtitle */}
        <div className="min-w-0">
          <div className="flex items-center gap-3 min-w-0 flex-wrap">
            <h1 className="sr-only">Subscriptions</h1>
            <h2 className="text-xl sm:text-2xl font-bold text-[#F5F7F6] tracking-tight shrink-0">
              Subscriptions
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[#94A3B8] mt-1 font-normal leading-relaxed">
            Track every subscription, renewal, and payment in one place.
          </p>
        </div>

        {/* Right: View Mode + Primary Action.

            The Gmail / receipt / forwarding icon trio that used to live here is
            gone: every one of those paths is already a first-class option
            inside the Add Subscription menu, so the row duplicated it. The
            Gmail modal is still mounted below because the OAuth callback opens
            it. */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap lg:flex-nowrap">
          {/* Layout View Toggle. Shown at every width — the list view works on
              a phone via horizontal scroll with the provider column pinned. */}
          <div
            className="flex items-center bg-[#0D0F0F] border border-[#1A1D1D] rounded-xl p-1 gap-1 shrink-0"
            role="group"
            aria-label="View mode"
          >
            <button
              type="button"
              onClick={() => setViewMode('table')}
              title="List View"
              aria-label="Table view"
              aria-pressed={viewMode === 'table'}
              data-touch="compact"
              className={`w-9 h-9 sm:w-8 sm:h-8 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-[#14B8A6] text-[#091512] font-semibold'
                  : 'text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D]'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title="Cards View"
              aria-label="Grid view"
              aria-pressed={viewMode === 'grid'}
              data-touch="compact"
              className={`w-9 h-9 sm:w-8 sm:h-8 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-[#14B8A6] text-[#091512] font-semibold'
                  : 'text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Desktop only. Below `lg` the contextual FAB in the dock is the add
              affordance, so a second copy here competed with it. */}
          <button
            type="button"
            onClick={() => setIsAddPathModalOpen(true)}
            className="hidden lg:inline-flex px-5 py-2.5 rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-sm font-semibold items-center gap-2 transition-colors cursor-pointer shrink-0 shadow-sm min-h-[44px]"
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

      {/*
        A deep link to a row that is now in Deleted.
        Rendered above the filters rather than as a sheet: nothing here is
        editable, so the detail layout — which is built around editing a live
        subscription — would be misleading even read-only.
      */}
      {deletedTarget && (
        <div className="p-5 sm:p-6 rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] space-y-3">
          <div className="flex items-start gap-3">
            <Trash2 className="w-5 h-5 text-[#94A3B8] shrink-0 mt-0.5" />
            <div className="min-w-0 space-y-1">
              <h3 className="text-sm font-medium text-[#F5F7F6]/90 truncate">
                {deletedTarget.name} is in Deleted
              </h3>
              <p className="text-xs text-[#94A3B8]/80">
                This subscription was moved to Deleted, so there is nothing to edit here. Restore it
                to change its details or track it again.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
            <button
              type="button"
              onClick={() => setDeletedTarget(null)}
              className="min-h-[44px] text-xs text-[#D1D5DB] hover:text-white cursor-pointer bg-transparent border-0 p-0"
            >
              Back to subscriptions
            </button>
            <button
              type="button"
              onClick={() => {
                /* `deletedTarget` is left in place: the router navigates away from this page,
                   and clearing it first would unmount the notice mid-transition.
                   No id is passed because the Deleted page has its own layout and
                   does not read a highlight param, so one would be ignored. */
                router.push('/history/deleted');
              }}
              className="min-h-[44px] text-xs text-[#14B8A6] hover:text-[#2DD4BF] cursor-pointer bg-transparent border-0 p-0"
            >
              Go to Deleted
            </button>
          </div>
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
        resultCount={filteredSubscriptions.length}
        totalCount={activeSubscriptions.length}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
      />

      {/* 3. SUBSCRIPTIONS TABLE / GRID / SKELETONS / EMPTY STATES */}
      {loading && subscriptions.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <SubscriptionCardSkeleton />
          <SubscriptionCardSkeleton />
          <SubscriptionCardSkeleton />
        </div>
      ) : filteredSubscriptions.length > 0 ? (
        isTableView ? (
          <>
            <SubscriptionTable
              subscriptions={paginatedSubscriptions}
              highlightedSubId={highlightedSubId}
              onSelectSubscription={handleSelectSubscription}
              onEdit={handleEditSubscription}
              onDeleteRequest={handleDeleteRequest}
              onArchiveRequest={handleArchiveSubscription}
              onPaymentReminderRequest={(item) => setReminderSubscription(item)}
              onOpenNotes={(item) => setNotesSub(item)}
              reminders={reminders}
            onDismissReminder={handleDismissReminder}
          />
          {hasMore && (
            <div className="flex justify-center pt-6">
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="px-6 py-2.5 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] text-[#94A3B8] hover:text-[#F5F7F6] text-xs font-semibold border border-[#1A1D1D] cursor-pointer transition-colors"
              >
                Load More
              </button>
            </div>
          )}
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {paginatedSubscriptions.map((sub) => (
              <SubscriptionCard
                key={sub.id}
                subscription={sub}
                isHighlighted={sub.id === highlightedSubId}
                onViewDetails={handleSelectSubscription}
                onEdit={handleEditSubscription}
                onDeleteRequest={handleDeleteRequest}
                onArchiveRequest={handleArchiveSubscription}
                onPaymentReminderRequest={(item) => setReminderSubscription(item)}
                onOpenNotes={(item) => setNotesSub(item)}
                reminderInfo={reminders[sub.id] || null}
                onDismissReminder={handleDismissReminder}
              />
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center pt-6">
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="px-6 py-2.5 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] text-[#94A3B8] hover:text-[#F5F7F6] text-xs font-semibold border border-[#1A1D1D] cursor-pointer transition-colors"
              >
                Load More
              </button>
            </div>
          )}
          </>
        )
      ) : (
        <div className="py-12 sm:py-16 text-center flex flex-col items-center justify-center space-y-1.5">
          <div className="max-w-sm space-y-1">
            <h3 className="text-sm sm:text-base font-medium text-[#F5F7F6]/80">
              {hasActiveFilters ? 'No matching subscriptions' : 'No subscriptions added yet'}
            </h3>
            <p className="text-xs text-[#94A3B8]/60">
              {hasActiveFilters
                ? 'No subscriptions match your current search terms or filter criteria.'
                : 'Track your recurring Netflix, Spotify, or software subscriptions in one place.'}
            </p>
          </div>

          {/*
            No call to action here on purpose. Adding one meant three of them
            existed at once: this one, the header's "Add Subscription" (which is
            desktop-only, `hidden lg:inline-flex`), and the contextual FAB in the
            dock. The header row and the FAB between them already cover every
            width, so this was a third control opening the same modal — and the
            most prominent one, sitting below a heading that read as though it
            were the only way to start.
          */}
        </div>
      )}

      {/* 4. SPONSOR ADVERTISEMENT (After the list scan) */}
      {!loading && filteredSubscriptions.length > 0 && (
        <AdBanner planTier={planTier} />
      )}

      {/* Add Subscription Entry Choice Modal (Three Path Flow) */}
      <AddSubscriptionModal
        isOpen={isAddPathModalOpen}
        onClose={() => {
          setAddPathInitial(null);
          setIsAddPathModalOpen(false);
        }}
        initialPath={addPathInitial}
        onRequireUpgrade={() => setIsUpgradeModalOpen(true)}
        existingSubscriptions={activeSubscriptions}
        onSelectExistingDetails={(sub) => {
          setSelectedDetailSub(sub);
          setIsDetailOpen(true);
        }}
        onSelectManual={(prefill, receiptFile) => {
          setPendingReceiptFile(receiptFile ?? null);
          setIsAddPathModalOpen(false);
          if (prefill) {
            setEditingSubscription({
              id: '',
              user_id: '',
              name: prefill.name || '',
              price: prefill.price || 0,
              currency: prefill.currency || 'USD',
              billing_cycle: prefill.billing_cycle || 'monthly',
              category: prefill.category || 'Streaming',
              status: prefill.status || 'active',
              start_date: prefill.start_date || null,
              end_date: prefill.end_date || null,
              next_billing_date: prefill.next_billing_date || new Date().toISOString().split('T')[0],
              payment_method: null,
              provider_url: prefill.provider_url || null,
              notes: prefill.notes || null,
              account_links: prefill.account_links || [],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          } else {
            setEditingSubscription(null);
          }
          setIsModalOpen(true);
        }}
      />



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
        onDeleteRequest={(item) => {
          setDeleteReturnToDetailSub(item);
          setDeletingSubscription(item);
        }}
        onPaymentReminderRequest={(item) => {
          setReminderReturnToDetailSub(item);
          setReminderSubscription(item);
        }}
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
        onBack={
          !editingSubscription?.id
            ? () => {
                setIsModalOpen(false);
                setEditingSubscription(null);
                setIsAddPathModalOpen(true);
              }
            : undefined
        }
        onSave={handleSave}
        initialData={editingSubscription}
        pendingReceiptFile={pendingReceiptFile}
        onRequireUpgrade={() => {
          // Close the form so the upgrade sheet is not stacked behind it.
          setIsModalOpen(false);
          setIsUpgradeModalOpen(true);
        }}
      />

      {/* Dedicated Notes Editor Modal */}
      <SubscriptionNotesModal
        subscription={notesSub}
        isOpen={!!notesSub}
        onClose={() => setNotesSub(null)}
        onSaved={loadData}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={!!deletingSubscription}
        onClose={() => {
          if (deleteReturnToDetailSub) {
            setSelectedDetailSub(deleteReturnToDetailSub);
            setIsDetailOpen(true);
            setDeleteReturnToDetailSub(null);
          }
          setDeletingSubscription(null);
        }}
        onConfirm={handleConfirmDelete}
        loading={deleteLoading}
        title={`Move "${deletingSubscription?.name}" to Deleted?`}
        description="This subscription will be removed from your active list and moved to Deleted where you can review or restore it anytime."
        confirmText="Move to Deleted"
        variant="danger"
      />

      {/* Payment Reminder Modal */}
      <PaymentReminderModal
        isOpen={!!reminderSubscription}
        onClose={() => {
          setReminderSubscription(null);
          if (reminderReturnToDetailSub) {
            setSelectedDetailSub(reminderReturnToDetailSub);
            setIsDetailOpen(true);
            setReminderReturnToDetailSub(null);
          }
        }}
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

      {/* Premium Upgrade Modal */}
      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
      />

      {/* Auto-Discovery & Import Modals */}
      <GmailConnectModal
        isOpen={isGmailModalOpen}
        onClose={() => {
          setIsGmailModalOpen(false);
          setGmailAutoScan(false);
        }}
        onSuccess={loadData}
        autoScan={gmailAutoScan}
      />
    </div>
  );
}