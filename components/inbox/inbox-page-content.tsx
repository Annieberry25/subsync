'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  CheckCheck, 
  ChevronRight,
  MoreVertical,
  Archive,
  Trash2,
  Plus,
  Star,
  StarOff,
  RotateCcw
} from 'lucide-react';
import { useInbox, type InboxItem } from '@/lib/contexts/inbox-context';
import { fetchSubscriptions, type SubscriptionRow } from '@/lib/services/subscription-service';
import SubscriptionDetailModal from '@/components/subscriptions/subscription-detail-modal';
import PaymentReminderModal from '@/components/subscriptions/payment-reminder-modal';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { useToast } from '@/lib/hooks/use-toast';

type FilterTab = 'all' | 'unread' | 'action_required' | 'marked_as_read' | 'favourited' | 'archived';

export default function InboxPageContent() {
  const router = useRouter();
  const { toast } = useToast();
  const { 
    items, 
    archivedItems, 
    unreadCount, 
    markAsRead, 
    deleteItem, 
    archiveItem, 
    unarchiveItem,
    addToFavourites, 
    removeFromFavourites 
  } = useInbox();
  
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  
  // WhatsApp-style Action Menu State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Explicit Delete Confirmation State
  const [itemToDelete, setItemToDelete] = useState<InboxItem | null>(null);

  // Modals for Actions
  const [selectedSub, setSelectedSub] = useState<SubscriptionRow | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [reminderSub, setReminderSub] = useState<SubscriptionRow | null>(null);
  const [isReminderOpen, setIsReminderOpen] = useState(false);

  // Long press timer ref for mobile interactions
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  // Total Action Required count (pure derived data: unread actionable items)
  const actionRequiredCount = useMemo(() => {
    return items.filter((i) => !i.isRead && Boolean(i.actionLabel || i.actionType)).length;
  }, [items]);

  // Total Favourited count
  const favouritedCount = useMemo(() => {
    return items.filter((i) => i.isFavourited).length;
  }, [items]);

  // Filtered items based on active tab
  const displayedItems = useMemo(() => {
    let filtered = items;
    if (activeTab === 'unread') {
      filtered = items.filter((item) => !item.isRead);
    } else if (activeTab === 'action_required') {
      filtered = items.filter((item) => !item.isRead && Boolean(item.actionLabel || item.actionType));
    } else if (activeTab === 'marked_as_read') {
      filtered = items.filter((item) => item.isRead);
    } else if (activeTab === 'favourited') {
      filtered = items.filter((item) => item.isFavourited);
    } else if (activeTab === 'archived') {
      filtered = archivedItems;
    }

    return [...filtered].sort((a, b) => {
      if (a.isRead === b.isRead) return 0;
      return a.isRead ? 1 : -1;
    });
  }, [items, archivedItems, activeTab]);

  const handleAction = useCallback(
    async (item: InboxItem) => {
      if (!item) return;

      // Explicit action taken by user on CTA button
      if (!item.isRead) {
        markAsRead(item.id);
      }

      // Try finding corresponding subscription if exists
      if (item.subscriptionName) {
        const { data: subs } = await fetchSubscriptions();
        const match = subs?.find(
          (s) => s.name.toLowerCase().trim() === item.subscriptionName?.toLowerCase().trim()
        );

        if (match) {
          if (item.actionType === 'view' || item.actionType === 'review') {
            setSelectedSub(match);
            setIsDetailOpen(true);
            return;
          }
          if (item.actionType === 'manage' || item.actionType === 'update_payment') {
            if (item.providerUrl) {
              window.open(item.providerUrl, '_blank', 'noopener,noreferrer');
            } else {
              setSelectedSub(match);
              setIsDetailOpen(true);
            }
            return;
          }
        }
      }

      // Fallback: If external providerUrl exists, open in new tab
      if (item.providerUrl) {
        window.open(item.providerUrl, '_blank', 'noopener,noreferrer');
      } else if (item.actionLabel) {
        toast.success(`Action "${item.actionLabel}" processed for "${item.title}".`, 'Inbox Updated');
      }
    },
    [markAsRead, toast]
  );

  const handleCardClick = (item: InboxItem) => {
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      return;
    }

    // Unread messages mark as read upon open, but still navigate
    if (!item.isRead) {
      markAsRead(item.id);
    }

    // Dedicated full-page route navigation
    router.push(`/inbox/${item.id}`);
  };

  const handleTouchStart = (item: InboxItem) => {
    isLongPressRef.current = false;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(40); } catch {}
      }
      setActiveMenuId(item.id);
    }, 450);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchMove = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getStatusDot = (item: InboxItem) => {
    if (item.isRead) {
      return <span className="w-2.5 h-2.5 rounded-full bg-[#1A1D1D] block mt-1.5 shrink-0" />;
    }
    if (item.type === 'failed_payment' || item.isUrgent) {
      return <span className="w-2.5 h-2.5 rounded-full bg-[#D9363E] block mt-1.5 shrink-0" title="Urgent Notice" />;
    }
    if (item.type === 'trial_ending' || item.type === 'price_increase') {
      return <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] block mt-1.5 shrink-0" title="Warning Notice" />;
    }
    return <span className="w-2.5 h-2.5 rounded-full bg-[#14B8A6] block mt-1.5 shrink-0" title="Notice" />;
  };

  const isSecondaryActive = activeTab === 'marked_as_read' || activeTab === 'favourited' || activeTab === 'archived';
  const showExpandedFilters = isFiltersExpanded || isSecondaryActive;

  const hasItemsToShow = displayedItems.length > 0;

  return (
    <div className="space-y-6 max-w-4xl min-h-[85vh] pb-32 w-full max-w-full overflow-x-hidden">
      {/* Accessible DOM Heading */}
      <h1 className="sr-only">Inbox - Attention Center</h1>

      {/* HEADER & FILTER CONTROLS */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 pb-3 border-b border-[#1A1D1D] w-full max-w-full overflow-x-hidden">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-[#F5F7F6] tracking-tight">Inbox</h2>
        </div>

        {/* Filter Tabs - WhatsApp-Style Standalone Pills with Expandable (+) Button */}
        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto max-w-full overflow-x-hidden">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto py-1 shrink-0">
            {/* Primary visible pills */}
            {[
              {
                id: 'all' as FilterTab,
                label: 'All',
                showBadge: false,
              },
              {
                id: 'unread' as FilterTab,
                label: 'Unread',
                count: unreadCount,
                showBadge: unreadCount > 0,
                badgeStyle: (isActive: boolean) =>
                  isActive
                    ? 'bg-[#091512] text-[#14B8A6]'
                    : 'bg-[#14B8A6]/20 text-[#14B8A6] border border-[#14B8A6]/30',
              },
              {
                id: 'action_required' as FilterTab,
                label: 'Action Required',
                count: actionRequiredCount,
                showBadge: actionRequiredCount > 0,
                badgeStyle: (_isActive: boolean) =>
                  'bg-[#1A1D1D] text-[#94A3B8] border border-[#262929]',
              },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-[#14B8A6] text-[#091512] font-semibold border border-[#14B8A6] shadow-sm shadow-[#14B8A6]/10'
                      : 'bg-[#0B0D0D] text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] border border-[#1A1D1D]'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.showBadge && tab.count !== undefined && (
                    <span
                      className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold min-w-[18px] h-4 leading-none transition-colors ${
                        tab.badgeStyle ? tab.badgeStyle(isActive) : 'bg-[#1A1D1D] text-[#94A3B8]'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Expanded Secondary Filters (Marked as read, Favourited, Archived) */}
            {showExpandedFilters && (
              <>
                {[
                  {
                    id: 'marked_as_read' as FilterTab,
                    label: 'Marked as read',
                    showBadge: false,
                  },
                  {
                    id: 'favourited' as FilterTab,
                    label: 'Favourited',
                    count: favouritedCount,
                    showBadge: favouritedCount > 0,
                    badgeStyle: (_isActive: boolean) =>
                      'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30',
                  },
                  {
                    id: 'archived' as FilterTab,
                    label: 'Archived',
                    count: archivedItems.length,
                    showBadge: archivedItems.length > 0,
                    badgeStyle: (_isActive: boolean) =>
                      'bg-[#1A1D1D] text-[#94A3B8] border border-[#262929]',
                  },
                ].map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150 ${
                        isActive
                          ? 'bg-[#14B8A6] text-[#091512] font-semibold border border-[#14B8A6] shadow-sm shadow-[#14B8A6]/10'
                          : 'bg-[#0B0D0D] text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] border border-[#1A1D1D]'
                      }`}
                    >
                      <span>{tab.label}</span>
                      {tab.showBadge && tab.count !== undefined && (
                        <span
                          className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold min-w-[18px] h-4 leading-none transition-colors ${
                            tab.badgeStyle ? tab.badgeStyle(isActive) : 'bg-[#1A1D1D] text-[#94A3B8]'
                          }`}
                        >
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </>
            )}

            {/* Standalone Expand (+) / Collapse Pill Button */}
            <button
              type="button"
              onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
              aria-label={showExpandedFilters ? "Collapse filter options" : "Expand filter options"}
              title={showExpandedFilters ? "Show fewer filters" : "Show more filters"}
              className={`px-2.5 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 cursor-pointer flex items-center justify-center shrink-0 ${
                showExpandedFilters
                  ? 'bg-[#14B8A6]/15 text-[#14B8A6] border-[#14B8A6]/40 hover:bg-[#14B8A6]/25'
                  : 'bg-[#0B0D0D] text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] border-[#1A1D1D]'
              }`}
            >
              <Plus className={`w-3.5 h-3.5 transition-transform duration-200 ${showExpandedFilters ? 'rotate-45 text-[#14B8A6]' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* INBOX CONTENT LIST */}
      {hasItemsToShow ? (
        <div className="space-y-2.5 relative">
          {displayedItems.map((item) => {
            const isMenuOpen = activeMenuId === item.id;
            const isArchivedTab = activeTab === 'archived';

            return (
              <div
                key={item.id}
                onClick={() => handleCardClick(item)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveMenuId(item.id);
                }}
                onTouchStart={() => handleTouchStart(item)}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchMove}
                className={`group relative rounded-2xl p-4 sm:p-5 border bg-[#0B0D0D] transition-all duration-150 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer ${
                  !item.isRead
                    ? 'border-[#1A1D1D] hover:border-[#14B8A6]/50 shadow-sm'
                    : 'border-[#1A1D1D] hover:border-[#262929]'
                }`}
              >
                {/* Left: Indicator & Content */}
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  {getStatusDot(item)}

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3
                          className={`text-sm font-semibold tracking-tight truncate ${
                            !item.isRead ? 'text-[#F5F7F6]' : 'text-[#94A3B8]'
                          }`}
                        >
                          {item.title}
                        </h3>

                        {/* Favourited Star Badge */}
                        {item.isFavourited && (
                          <Star className="w-3.5 h-3.5 text-[#F59E0B] fill-[#F59E0B] shrink-0" />
                        )}
                      </div>
                      <span className="text-[11px] text-[#94A3B8] shrink-0 font-normal">
                        {formatDate(item.date)}
                      </span>
                    </div>
                    <p
                      className={`text-xs leading-relaxed ${
                        !item.isRead ? 'text-[#94A3B8]' : 'text-[#94A3B8]/80'
                      }`}
                    >
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* Right: Actions & Secondary Interaction Controls */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#1A1D1D]/40">
                  {/* CTA Action Button (if actionable) */}
                  {item.actionLabel && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAction(item);
                      }}
                      className="py-1.5 px-3.5 rounded-xl text-xs font-semibold bg-[#14B8A6] hover:opacity-90 text-[#091512] transition-colors cursor-pointer flex items-center justify-center gap-1 min-h-[36px]"
                    >
                      <span>{item.actionLabel}</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-80" />
                    </button>
                  )}

                  {/* Read status checkmark (Read messages display checkmark) */}
                  {item.isRead && (
                    <div className="p-1 flex items-center justify-center text-[#14B8A6]">
                      <CheckCheck className="w-4 h-4 text-[#14B8A6]" />
                    </div>
                  )}

                  {/* Secondary 3-dots Menu Trigger Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuId(isMenuOpen ? null : item.id);
                    }}
                    aria-label="Message action menu"
                    className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] transition-colors cursor-pointer"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>

                {/* WhatsApp-Style Floating Action Menu Popover (Message Actions ONLY) */}
                {isMenuOpen && (
                  <>
                    {/* Backdrop to close menu */}
                    <div
                      className="fixed inset-0 z-30"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(null);
                      }}
                    />

                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-3 top-12 z-40 w-52 rounded-xl bg-[#0F1111] border border-[#1A1D1D] p-1.5 shadow-2xl space-y-0.5 animate-in fade-in zoom-in-95 duration-100"
                    >
                      {/* ACTION 1: Add to Favourites / Remove from Favourites (Placed FIRST) */}
                      {item.isFavourited ? (
                        <button
                          type="button"
                          onClick={() => {
                            removeFromFavourites(item.id);
                            toast.success(`Removed "${item.title}" from Favourites`, 'Favourites Updated');
                            setActiveMenuId(null);
                          }}
                          className="w-full px-3 py-2 rounded-lg text-xs font-medium text-[#F5F7F6] hover:bg-[#1A1D1D] flex items-center gap-2.5 transition-colors cursor-pointer text-left"
                        >
                          <StarOff className="w-3.5 h-3.5 text-[#F59E0B]" />
                          <span>Remove from Favourites</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            addToFavourites(item.id);
                            toast.success(`Added "${item.title}" to Favourites`, 'Favourites Updated');
                            setActiveMenuId(null);
                          }}
                          className="w-full px-3 py-2 rounded-lg text-xs font-medium text-[#F5F7F6] hover:bg-[#1A1D1D] flex items-center gap-2.5 transition-colors cursor-pointer text-left"
                        >
                          <Star className="w-3.5 h-3.5 text-[#F59E0B]" />
                          <span>Add to Favourites</span>
                        </button>
                      )}

                      {/* ACTION 2: Archive Message / Restore from Archive */}
                      {isArchivedTab ? (
                        <button
                          type="button"
                          onClick={() => {
                            unarchiveItem(item.id);
                            toast.success(`Message restored to Inbox`, 'Inbox Restored');
                            setActiveMenuId(null);
                          }}
                          className="w-full px-3 py-2 rounded-lg text-xs font-medium text-[#F5F7F6] hover:bg-[#1A1D1D] flex items-center gap-2.5 transition-colors cursor-pointer text-left"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-[#14B8A6]" />
                          <span>Restore to Inbox</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            archiveItem(item.id);
                            toast.success(`Message archived`, 'Moved to Archive');
                            setActiveMenuId(null);
                          }}
                          className="w-full px-3 py-2 rounded-lg text-xs font-medium text-[#F5F7F6] hover:bg-[#1A1D1D] flex items-center gap-2.5 transition-colors cursor-pointer text-left"
                        >
                          <Archive className="w-3.5 h-3.5 text-[#F59E0B]" />
                          <span>Archive message</span>
                        </button>
                      )}

                      {/* ACTION 3: Delete Message (Destructive) */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveMenuId(null);
                          setItemToDelete(item);
                        }}
                        className="w-full px-3 py-2 rounded-lg text-xs font-medium text-[#D9363E] hover:bg-[#D9363E]/10 flex items-center gap-2.5 transition-colors cursor-pointer text-left border-t border-[#1A1D1D]"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-[#D9363E]" />
                        <span>Delete message</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Minimal Empty State */
        <div className="py-16 text-center flex flex-col items-center justify-center space-y-2 rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D]">
          <h3 className="text-sm font-semibold text-[#F5F7F6]">All caught up</h3>
          <p className="text-xs text-[#94A3B8] max-w-xs">
            No pending items in this view. Subscription notices and billing alerts requiring attention will appear here.
          </p>
        </div>
      )}

      {/* Explicit Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(itemToDelete)}
        onClose={() => setItemToDelete(null)}
        onConfirm={() => {
          if (itemToDelete) {
            deleteItem(itemToDelete.id);
            toast.success(`Message deleted`, 'Inbox Updated');
            setItemToDelete(null);
          }
        }}
        title="Delete message?"
        description="Are you sure you want to delete this message? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

      {/* Subscription Detail Modal for Action Viewing */}
      <SubscriptionDetailModal
        subscription={selectedSub}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedSub(null);
        }}
        onEdit={() => {}}
        onDeleteRequest={() => {}}
        onPaymentReminderRequest={(sub) => {
          setSelectedSub(null);
          setIsDetailOpen(false);
          setReminderSub(sub);
          setIsReminderOpen(true);
        }}
      />

      {/* Payment Reminder Modal */}
      {reminderSub && (
        <PaymentReminderModal
          subscriptionName={reminderSub.name}
          nextBillingDate={reminderSub.next_billing_date}
          isOpen={isReminderOpen}
          onClose={() => {
            setIsReminderOpen(false);
            setReminderSub(null);
          }}
          onSave={() => {
            setIsReminderOpen(false);
            setReminderSub(null);
            toast.success(`Reminder set for ${reminderSub.name}`, 'Reminder Configured');
          }}
        />
      )}
    </div>
  );
}
