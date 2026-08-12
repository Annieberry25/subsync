'use client';

import { useState, useMemo, useCallback } from 'react';
import { 
  Check,
  CheckCheck, 
  X,
  ChevronRight
} from 'lucide-react';
import { useInbox, type InboxItem } from '@/lib/contexts/inbox-context';
import { fetchSubscriptions, type SubscriptionRow } from '@/lib/services/subscription-service';
import SubscriptionDetailModal from '@/components/subscriptions/subscription-detail-modal';
import PaymentReminderModal from '@/components/subscriptions/payment-reminder-modal';
import { useToast } from '@/lib/hooks/use-toast';

type FilterTab = 'all' | 'unread' | 'action_required' | 'marked_as_read';

export default function InboxPageContent() {
  const { toast } = useToast();
  const { items, unreadCount, markAsRead, markAsUnread, deleteItem } = useInbox();
  
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  
  // Modals for Actions
  const [selectedSub, setSelectedSub] = useState<SubscriptionRow | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [reminderSub, setReminderSub] = useState<SubscriptionRow | null>(null);
  const [isReminderOpen, setIsReminderOpen] = useState(false);

  // Total Action Required count (pure derived data: unread actionable items)
  const actionRequiredCount = useMemo(() => {
    return items.filter((i) => !i.isRead && Boolean(i.actionLabel || i.actionType)).length;
  }, [items]);

  // Read items count (pure derived data)
  const readCount = useMemo(() => {
    return items.filter((i) => i.isRead).length;
  }, [items]);

  // Filtered and ordered items in ONE continuous list (pure derived data)
  const displayedItems = useMemo(() => {
    let filtered = items;
    if (activeTab === 'unread') {
      filtered = items.filter((item) => !item.isRead);
    } else if (activeTab === 'action_required') {
      filtered = items.filter((item) => !item.isRead && Boolean(item.actionLabel || item.actionType));
    } else if (activeTab === 'marked_as_read') {
      filtered = items.filter((item) => item.isRead);
    }

    return [...filtered].sort((a, b) => {
      if (a.isRead === b.isRead) return 0;
      return a.isRead ? 1 : -1;
    });
  }, [items, activeTab]);

  const handleAction = useCallback(
    async (item: InboxItem) => {
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
      } else {
        toast.success(`Action "${item.actionLabel}" processed for "${item.title}".`, 'Inbox Updated');
      }
    },
    [markAsRead, toast]
  );

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

        {/* Filter Tabs & Mark Read */}
        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto max-w-full overflow-x-hidden">
          <div className="flex items-center gap-1.5 sm:gap-1 overflow-x-auto no-scrollbar w-full sm:w-auto py-1 px-0.5 sm:p-1 rounded-none sm:rounded-xl bg-transparent sm:bg-[#0B0D0D] border-0 sm:border sm:border-[#1A1D1D] shrink-0">
            {[
              { id: 'all', label: 'All', count: items.length },
              { id: 'unread', label: 'Unread', count: unreadCount },
              { id: 'action_required', label: 'Action Required', count: actionRequiredCount },
              { id: 'marked_as_read', label: 'Marked as read', count: readCount },
            ].map((tab) => {
              const isActive = activeTab === (tab.id as FilterTab);
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as FilterTab)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-[#1A1D1D] text-[#F5F7F6] font-semibold border border-[#262929] sm:border-transparent'
                      : 'bg-[#0B0D0D]/70 sm:bg-transparent text-[#94A3B8] hover:text-[#F5F7F6] border border-[#1A1D1D]/70 sm:border-transparent'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold min-w-[18px] h-4 leading-none transition-colors ${
                      isActive
                        ? 'bg-[#14B8A6] text-[#091512]'
                        : tab.count > 0
                        ? 'bg-[#14B8A6]/20 text-[#14B8A6]'
                        : 'bg-[#1A1D1D] text-[#94A3B8]'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* INBOX CONTENT - SINGLE CONTINUOUS LIST */}
      {hasItemsToShow ? (
        <div className="space-y-2.5">
          {displayedItems.map((item) => {
            if (!item.isRead) {
              // UNREAD ITEM (Prominent styling, appropriate CTA button if available, NO double-check icon, NO X icon)
              return (
                <div
                  key={item.id}
                  className="group rounded-2xl p-4 sm:p-5 border border-[#1A1D1D] bg-[#0B0D0D] hover:border-[#14B8A6]/50 transition-colors duration-150 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm"
                >
                  {/* Left: Status Indicator Dot & Content */}
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    {getStatusDot(item)}

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="text-sm font-semibold tracking-tight text-[#F5F7F6]">
                          {item.title}
                        </h3>
                        <span className="text-[11px] text-[#94A3B8] shrink-0 font-normal">
                          {formatDate(item.date)}
                        </span>
                      </div>
                      <p className="text-xs text-[#94A3B8] leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  {/* Right: Actions for Unread Items */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#1A1D1D]">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(item.id);
                      }}
                      title="Mark as read"
                      aria-label="Mark as read"
                      className="p-1 text-[#94A3B8] hover:text-[#14B8A6] transition-colors cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                    </button>
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
                  </div>
                </div>
              );
            }

            // READ ITEM (Visually muted, teal double-check icon for mark as unread + dismiss X icon, NO active CTA)
            return (
              <div
                key={item.id}
                className="group rounded-2xl p-4 sm:p-4.5 border border-[#1A1D1D]/70 bg-[#0B0D0D]/40 opacity-60 hover:opacity-85 transition-opacity duration-150 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                {/* Left: Muted Content */}
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  {getStatusDot(item)}

                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <h4 className="text-sm font-medium tracking-tight text-[#94A3B8]">
                        {item.title}
                      </h4>
                      <span className="text-[11px] text-[#94A3B8]/70 shrink-0 font-normal">
                        {formatDate(item.date)}
                      </span>
                    </div>
                    <p className="text-xs text-[#94A3B8]/70 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* Right: Icons for Read Messages (Teal double-check + X/dismiss) */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#1A1D1D]/40">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      markAsUnread(item.id);
                    }}
                    title="Mark as unread"
                    aria-label="Mark as unread"
                    className="p-1 text-[#14B8A6] hover:text-[#2DD4BF] transition-colors cursor-pointer"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteItem(item.id);
                    }}
                    title="Dismiss"
                    aria-label="Dismiss"
                    className="p-1 text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Minimal Empty State */
        <div className="py-16 text-center flex flex-col items-center justify-center space-y-2 rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D]">
          <h3 className="text-sm font-semibold text-[#F5F7F6]">All caught up</h3>
          <p className="text-xs text-[#94A3B8] max-w-xs">
            No pending items. Subscription notices and billing alerts requiring attention will appear here.
          </p>
        </div>
      )}

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
