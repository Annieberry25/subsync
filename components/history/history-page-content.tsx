'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Archive, 
  Trash2, 
  RotateCcw, 
  ChevronRight, 
  ChevronDown,
  AlertCircle,
  Clock,
  SlidersHorizontal,
  ArrowLeft
} from 'lucide-react';
import { 
  fetchSubscriptions, 
  filterArchivedSubscriptions, 
  filterDeletedSubscriptions, 
  restoreSubscription, 
  permanentlyDeleteSubscription, 
  getRestoredHistory, 
  type SubscriptionRow, 
  type RestoredHistoryRecord 
} from '@/lib/services/subscription-service';
import { 
  getActivityHistory, 
  getActivityPreviewTexts,
  type ActivityRecord, 
  type ActivityType 
} from '@/lib/services/activity-service';
import { formatCurrency } from '@/lib/utils/metrics-utils';
import { ServiceIcon } from '@/components/ui/service-icon';
import { useToast } from '@/lib/hooks/use-toast';
import { useInbox } from '@/lib/contexts/inbox-context';
import SubscriptionDetailModal from '@/components/subscriptions/subscription-detail-modal';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { SubscriptionCardSkeleton } from '@/components/ui/skeleton';

export type HistorySection = 'all' | 'archive' | 'deleted' | 'restored';

interface HistoryPageContentProps {
  section?: HistorySection;
}

const sectionHeaderMeta: Record<HistorySection, { title: string; subtitle: string }> = {
  all: {
    title: 'Past Activity',
    subtitle: 'Chronological record of subscription activity, changes, and alerts.',
  },
  archive: {
    title: 'Archive',
    subtitle: "Subscriptions you've archived.",
  },
  deleted: {
    title: 'Deleted',
    subtitle: "Subscriptions you've deleted.",
  },
  restored: {
    title: 'Restored',
    subtitle: 'Subscriptions previously archived or deleted and restored.',
  },
};

const ACTIVITY_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Activity Types' },
  { value: 'added', label: 'Subscriptions Added' },
  { value: 'edited', label: 'Subscriptions Edited' },
  { value: 'renewed', label: 'Subscriptions Renewed' },
  { value: 'archived', label: 'Subscriptions Archived' },
  { value: 'deleted', label: 'Subscriptions Deleted' },
  { value: 'restored', label: 'Subscriptions Restored' },
  { value: 'reminder_sent', label: 'Reminders Sent' },
  { value: 'updated', label: 'Information Updated' },
];

interface ActivityMessageItemProps {
  activity: ActivityRecord;
  onClick: () => void;
}

function formatDate(isoStr: string) {
  const d = new Date(isoStr);
  const now = new Date();
  const diffHours = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60));
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ActivityMessageItem({ activity, onClick }: ActivityMessageItemProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const animationRef = useRef<Animation | null>(null);

  const [hasOverflow, setHasOverflow] = useState(false);
  const [, setIsRevealing] = useState(false);

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchTimer = useRef<NodeJS.Timeout | null>(null);
  const isHolding = useRef(false);
  const isSwiping = useRef(false);

  const checkOverflow = useCallback(() => {
    if (containerRef.current && textRef.current) {
      const isOverflowing =
        textRef.current.scrollWidth > containerRef.current.clientWidth + 4 ||
        activity.description.length > 65;
      setHasOverflow(isOverflowing);
    }
  }, [activity.description]);

  useEffect(() => {
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [checkOverflow]);

  const startReveal = () => {
    if (!containerRef.current || !textRef.current) return;
    const containerWidth = containerRef.current.clientWidth;
    const textWidth = textRef.current.scrollWidth;
    const overflowDistance = textWidth - containerWidth;

    if (overflowDistance > 4) {
      setIsRevealing(true);
      const speedPxPerSec = 35;
      const duration = Math.max(3200, (overflowDistance / speedPxPerSec) * 1000);

      if (animationRef.current) {
        animationRef.current.cancel();
      }

      textRef.current.className =
        'text-xs sm:text-sm font-normal leading-relaxed select-none whitespace-nowrap inline-block text-[#F5F7F6] transition-colors duration-200';

      animationRef.current = textRef.current.animate(
        [
          { transform: 'translateX(0px)', offset: 0 },
          { transform: 'translateX(0px)', offset: 0.08 },
          { transform: `translateX(-${overflowDistance + 14}px)`, offset: 0.92 },
          { transform: `translateX(-${overflowDistance + 14}px)`, offset: 1.0 },
        ],
        {
          duration: duration,
          easing: 'linear',
          fill: 'forwards',
        }
      );
    }
  };

  const stopReveal = () => {
    if (animationRef.current) {
      animationRef.current.cancel();
      animationRef.current = null;
    }
    if (textRef.current) {
      textRef.current.style.transform = 'translateX(0px)';
      textRef.current.className =
        'text-xs sm:text-sm font-normal leading-relaxed select-none truncate w-full text-[#94A3B8] group-hover:text-[#F5F7F6] transition-colors duration-200';
    }
    setIsRevealing(false);
  };

  // Desktop Mouse Events
  const handleMouseEnter = () => {
    if (hasOverflow) {
      startReveal();
    }
  };

  const handleMouseLeave = () => {
    if (hasOverflow) {
      stopReveal();
    }
  };

  // Mobile Touch Events (Press-and-Hold directly on text/row)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwiping.current = false;
    isHolding.current = false;

    if (touchTimer.current) {
      clearTimeout(touchTimer.current);
    }

    if (hasOverflow) {
      touchTimer.current = setTimeout(() => {
        if (!isSwiping.current) {
          isHolding.current = true;
          startReveal();
        }
      }, 200);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current !== null && touchStartY.current !== null) {
      const diffX = Math.abs(e.touches[0].clientX - touchStartX.current);
      const diffY = Math.abs(e.touches[0].clientY - touchStartY.current);

      if (diffY > 8 || diffX > 8) {
        isSwiping.current = true;
        if (touchTimer.current) {
          clearTimeout(touchTimer.current);
          touchTimer.current = null;
        }
        if (isHolding.current) {
          stopReveal();
          isHolding.current = false;
        }
      }
    }
  };

  const handleTouchEnd = () => {
    if (touchTimer.current) {
      clearTimeout(touchTimer.current);
      touchTimer.current = null;
    }

    if (isHolding.current) {
      stopReveal();
      isHolding.current = false;
      return;
    }

    if (!isSwiping.current) {
      onClick();
    }
  };

  const handleTouchCancel = () => {
    if (touchTimer.current) {
      clearTimeout(touchTimer.current);
      touchTimer.current = null;
    }
    if (isHolding.current) {
      stopReveal();
      isHolding.current = false;
    }
  };

  const handleClick = () => {
    if (!isHolding.current && !isSwiping.current) {
      onClick();
    }
  };

  return (
    <div
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      className="group cursor-pointer py-1.5 px-4 sm:px-0 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4 w-full max-w-full overflow-hidden border-b border-[#1A1D1D]/30 last:border-b-0 hover:bg-[#14B8A6]/[0.04] transition-all duration-150"
    >
      {/* Mobile date line (compact secondary metadata) */}
      <span className="sm:hidden text-[11px] text-[#94A3B8]/60 font-normal block tracking-tight">
        {formatDate(activity.timestamp)}
      </span>

      {/* Activity message container */}
      <div
        ref={containerRef}
        className="relative flex-1 min-w-0 max-w-[520px] sm:max-w-[620px] md:max-w-[700px] lg:max-w-[760px] xl:max-w-[780px] overflow-hidden flex items-center h-6"
      >
        <p
          ref={textRef}
          className="text-xs sm:text-sm font-normal leading-relaxed select-none truncate w-full text-[#94A3B8] group-hover:text-[#F5F7F6] transition-colors duration-200"
          style={{ willChange: 'transform' }}
        >
          {activity.description}
        </p>
      </div>

      {/* Desktop date (subtle secondary metadata aligned far right, fixed) */}
      <span className="hidden sm:block text-xs text-[#94A3B8]/60 group-hover:text-[#94A3B8] font-normal shrink-0 text-right ml-auto transition-colors">
        {formatDate(activity.timestamp)}
      </span>
    </div>
  );
}

export default function HistoryPageContent({ section = 'all' }: HistoryPageContentProps) {
  const { toast } = useToast();
  const { archivedItems: archivedInboxItems, unarchiveItem: unarchiveInboxItem } = useInbox();

  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [restoredHistory, setRestoredHistory] = useState<RestoredHistoryRecord[]>([]);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state & Custom Dropdown State for All Activity
  const [activityFilter, setActivityFilter] = useState<string>('all');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  // Detail Modal state
  const [selectedSub, setSelectedSub] = useState<SubscriptionRow | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Activity Detail View state
  const [selectedActivity, setSelectedActivity] = useState<ActivityRecord | null>(null);

  // Permanent Delete Confirm Dialog State
  const [permDeletingSub, setPermDeletingSub] = useState<SubscriptionRow | null>(null);
  const [permDeleteLoading, setPermDeleteLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await fetchSubscriptions();
    if (err) {
      setError(err.message || 'Failed to load subscriptions.');
    } else if (data) {
      setSubscriptions(data);
    }
    setRestoredHistory(getRestoredHistory());
    setActivities(getActivityHistory());
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const archivedList = useMemo(() => filterArchivedSubscriptions(subscriptions), [subscriptions]);
  const deletedList = useMemo(() => filterDeletedSubscriptions(subscriptions), [subscriptions]);

  const filteredActivities = useMemo(() => {
    if (activityFilter === 'all') return activities;
    return activities.filter((act) => act.type === activityFilter);
  }, [activities, activityFilter]);

  const selectedOption = useMemo(
    () => ACTIVITY_FILTER_OPTIONS.find((opt) => opt.value === activityFilter) || ACTIVITY_FILTER_OPTIONS[0],
    [activityFilter]
  );

  const handleRestore = async (sub: SubscriptionRow) => {
    const { error: err } = await restoreSubscription(sub.id);
    if (err) {
      toast.error(err.message, 'Restore Failed');
    } else {
      toast.success(`"${sub.name}" has been restored to active subscriptions.`, 'Subscription Restored');
      await loadData();
    }
  };

  const handleConfirmPermanentDelete = async () => {
    if (!permDeletingSub) return;
    setPermDeleteLoading(true);
    const { error: err } = await permanentlyDeleteSubscription(permDeletingSub.id);
    setPermDeleteLoading(false);

    if (err) {
      toast.error(err.message, 'Permanent Deletion Failed');
    } else {
      toast.success(`"${permDeletingSub.name}" was permanently removed.`, 'Permanently Deleted');
      setPermDeletingSub(null);
      await loadData();
    }
  };

  const headerInfo = sectionHeaderMeta[section] || sectionHeaderMeta.all;

  return (
    <div className="space-y-6 sm:space-y-8 bg-ambient-grid min-h-[85vh] pb-32 w-full max-w-full overflow-x-hidden">
      {/* Accessible DOM Heading */}
      <h1 className="sr-only">{headerInfo.title} - History</h1>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-[#D9363E]/10 border border-[#D9363E]/20 flex items-center gap-3 text-[#D9363E] text-xs">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Skeletons */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <SubscriptionCardSkeleton />
          <SubscriptionCardSkeleton />
          <SubscriptionCardSkeleton />
        </div>
      ) : (
        <>
          {/* SECTION 0: ALL ACTIVITY (DEFAULT MAIN VIEW OR DETAIL VIEW) */}
          {section === 'all' && (
            selectedActivity ? (
              /* CLEAN PAST ACTIVITY DETAIL VIEW */
              <div className="space-y-8 animate-in fade-in duration-200">
                {/* Back Navigation */}
                <div>
                  <button
                    type="button"
                    onClick={() => setSelectedActivity(null)}
                    className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer outline-none bg-transparent border-none p-0"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Past Activity</span>
                  </button>
                </div>

                {/* Main Title Heading */}
                <div className="space-y-1">
                  <h2 className="text-2xl sm:text-3xl font-bold text-[#F5F7F6] tracking-tight">
                    {selectedActivity.title}
                  </h2>
                </div>

                {/* Vertical Information Sections */}
                <div className="space-y-6 pt-2">
                  {/* 1. Activity Event */}
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-[#94A3B8] block">
                      Activity Event
                    </span>
                    <p className="text-base sm:text-lg font-medium text-[#F5F7F6]">
                      {selectedActivity.title}
                    </p>
                  </div>

                  {/* 2. Subscription */}
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-[#94A3B8] block">
                      Subscription
                    </span>
                    <p className="text-base sm:text-lg font-medium text-[#F5F7F6]">
                      {selectedActivity.subscriptionName}
                    </p>
                  </div>

                  {/* 3. Detail */}
                  <div className="space-y-1 max-w-3xl">
                    <span className="text-xs font-medium text-[#94A3B8] block">
                      Detail
                    </span>
                    <p className="text-base sm:text-lg font-normal text-[#F5F7F6] leading-relaxed">
                      {selectedActivity.description}
                    </p>
                  </div>

                  {/* 4. Timestamp */}
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-[#94A3B8] block">
                      Timestamp
                    </span>
                    <p className="text-sm sm:text-base font-normal text-[#94A3B8]">
                      {new Date(selectedActivity.timestamp).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* MAIN ACTIVITY FEED LIST VIEW */
              <div className="space-y-4">
                {/* Activity Filter Custom SaaS Dropdown sitting directly on page background */}
                <div className="flex items-center justify-end gap-2 px-3 sm:px-0">
                  <SlidersHorizontal className="w-4 h-4 text-[#94A3B8] shrink-0" />
                  <div ref={dropdownRef} className="relative inline-block text-left">
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen((prev) => !prev)}
                      className="flex items-center gap-1.5 py-1 text-xs sm:text-sm font-medium text-[#F5F7F6] hover:text-[#F5F7F6]/80 transition-colors cursor-pointer outline-none focus:outline-none bg-transparent border-none"
                    >
                      <span>{selectedOption.label}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-[#94A3B8] transition-transform duration-200 shrink-0 ${
                          isDropdownOpen ? 'rotate-180 text-[#14B8A6]' : ''
                        }`}
                      />
                    </button>

                    {isDropdownOpen && (
                      <div className="absolute right-0 top-full mt-2 w-56 p-1.5 rounded-xl bg-[#0F1111] border border-[#1A1D1D] shadow-2xl shadow-black/80 z-50 animate-in fade-in duration-100">
                        <div className="space-y-0.5 max-h-64 overflow-y-auto no-scrollbar">
                          {ACTIVITY_FILTER_OPTIONS.map((opt) => {
                            const isSelected = opt.value === activityFilter;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                  setActivityFilter(opt.value);
                                  setIsDropdownOpen(false);
                                }}
                                className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs sm:text-sm transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-[#14B8A6]/15 text-[#14B8A6] font-semibold'
                                    : 'text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D]'
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Activity Feed List - Clean Dense Vertical List */}
                {filteredActivities.length > 0 ? (
                  <div className="space-y-0.5 py-1">
                    {filteredActivities.map((act) => (
                      <ActivityMessageItem
                        key={act.id}
                        activity={act}
                        onClick={() => {
                          setSelectedActivity(act);
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="py-20 sm:py-28 min-h-[320px] text-center flex flex-col items-center justify-center space-y-1.5">
                    <div className="max-w-xs space-y-1">
                      <h3 className="text-sm sm:text-base font-medium text-[#F5F7F6]/80">No activity yet</h3>
                      <p className="text-xs text-[#94A3B8]/60">
                        Actions taken on subscriptions will log here automatically.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )
          )}

          {/* SECTION 1: ARCHIVE */}
          {section === 'archive' && (
            (archivedList.length > 0 || archivedInboxItems.length > 0) ? (
              <div className="space-y-6">
                {/* Archived Subscriptions */}
                {archivedList.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                      Archived Subscriptions ({archivedList.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {archivedList.map((sub) => (
                        <div
                          key={sub.id}
                          className="w-full rounded-2xl p-5 bg-[#0B0D0D] border border-[#1A1D1D] hover:border-[#14B8A6] flex flex-col justify-between transition-all duration-300 gap-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <ServiceIcon
                                name={sub.name}
                                category={sub.category}
                                providerUrl={sub.provider_url}
                                className="w-10 h-10 rounded-xl shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <h3 className="font-semibold text-[#F5F7F6] text-[18px] tracking-tight truncate">
                                  {sub.name}
                                </h3>
                                <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B] mt-0.5">
                                  Archived
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-2xl font-bold text-[#F5F7F6] tracking-tight">
                              {formatCurrency(Number(sub.price), sub.currency)}
                            </span>
                            <span className="text-xs text-[#94A3B8]">/ {sub.billing_cycle}</span>
                          </div>

                          <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                            <span>Category: <strong className="text-[#F5F7F6] font-medium">{sub.category}</strong></span>
                          </div>

                          <div className="flex items-center gap-2 pt-2 border-t border-[#1A1D1D]">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSub(sub);
                                setIsDetailOpen(true);
                              }}
                              className="flex-1 py-2 px-3 rounded-xl bg-[#0B0D0D] hover:bg-[#1A1D1D] text-xs font-semibold text-[#F5F7F6] border border-[#1A1D1D] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <ChevronRight className="w-3.5 h-3.5 text-[#14B8A6]" />
                              <span>View Details</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRestore(sub)}
                              className="flex-1 py-2 px-3 rounded-xl bg-[#14B8A6] hover:opacity-90 text-xs font-semibold text-[#091512] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-[#091512]" />
                              <span>Restore</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Archived Inbox Messages */}
                {archivedInboxItems.length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-[#1A1D1D]/60">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                      Archived Inbox Messages ({archivedInboxItems.length})
                    </h3>
                    <div className="space-y-2.5">
                      {archivedInboxItems.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-2xl p-4 sm:p-5 border border-[#1A1D1D] bg-[#0B0D0D] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B]">
                                Archived Message
                              </span>
                              <h4 className="text-sm font-semibold text-[#F5F7F6] truncate">
                                {item.title}
                              </h4>
                            </div>
                            <p className="text-xs text-[#94A3B8] leading-relaxed line-clamp-2">
                              {item.description}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                unarchiveInboxItem(item.id);
                                toast.success(`Message "${item.title}" restored to Inbox`, 'Inbox Restored');
                              }}
                              className="py-1.5 px-3.5 rounded-xl text-xs font-semibold bg-[#14B8A6] hover:opacity-90 text-[#091512] transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Restore to Inbox</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-20 sm:py-28 min-h-[320px] text-center flex flex-col items-center justify-center space-y-1.5">
                <div className="max-w-xs space-y-1">
                  <h3 className="text-sm sm:text-base font-medium text-[#F5F7F6]/80">Nothing archived</h3>
                  <p className="text-xs text-[#94A3B8]/60">
                    Items you archive will be stored here safely without affecting active metrics.
                  </p>
                </div>
              </div>
            )
          )}

          {/* SECTION 2: DELETED */}
          {section === 'deleted' && (
            deletedList.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {deletedList.map((sub) => (
                  <div
                    key={sub.id}
                    className="w-full rounded-2xl p-5 bg-[#0B0D0D] border border-[#1A1D1D] hover:border-[#D9363E]/60 flex flex-col justify-between transition-all duration-300 gap-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <ServiceIcon
                          name={sub.name}
                          category={sub.category}
                          providerUrl={sub.provider_url}
                          className="w-10 h-10 rounded-xl shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-[#F5F7F6] text-[18px] tracking-tight truncate">
                            {sub.name}
                          </h3>
                          <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#D9363E]/10 border border-[#D9363E]/30 text-[#D9363E] mt-0.5">
                            Soft Deleted
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-2xl font-bold text-[#F5F7F6] tracking-tight">
                        {formatCurrency(Number(sub.price), sub.currency)}
                      </span>
                      <span className="text-xs text-[#94A3B8]">/ {sub.billing_cycle}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                      <span>Category: <strong className="text-[#F5F7F6] font-medium">{sub.category}</strong></span>
                    </div>

                    <div className="flex flex-col gap-2 pt-2 border-t border-[#1A1D1D]">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSub(sub);
                            setIsDetailOpen(true);
                          }}
                          className="flex-1 py-2 px-3 rounded-xl bg-[#0B0D0D] hover:bg-[#1A1D1D] text-xs font-semibold text-[#F5F7F6] border border-[#1A1D1D] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <ChevronRight className="w-3.5 h-3.5 text-[#14B8A6]" />
                          <span>View Details</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRestore(sub)}
                          className="flex-1 py-2 px-3 rounded-xl bg-[#14B8A6] hover:opacity-90 text-xs font-semibold text-[#091512] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-[#091512]" />
                          <span>Restore</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setPermDeletingSub(sub)}
                        className="w-full py-2 px-3 rounded-xl bg-[#D9363E]/10 hover:bg-[#D9363E]/20 text-xs font-semibold text-[#D9363E] border border-[#D9363E]/30 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Permanently</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 sm:py-28 min-h-[320px] text-center flex flex-col items-center justify-center space-y-1.5">
                <div className="max-w-xs space-y-1">
                  <h3 className="text-sm sm:text-base font-medium text-[#F5F7F6]/80">Nothing deleted</h3>
                  <p className="text-xs text-[#94A3B8]/60">
                    Subscriptions you remove are kept here first so you can review or restore them anytime.
                  </p>
                </div>
              </div>
            )
          )}

          {/* SECTION 3: RESTORED */}
          {section === 'restored' && (
            restoredHistory.length > 0 ? (
              <div className="w-full max-w-full overflow-hidden rounded-[20px] bg-[#0B0D0D] border border-[#1A1D1D] shadow-sm">
                <div className="w-full overflow-x-auto no-scrollbar">
                  <table className="w-full text-left border-collapse min-w-[640px]">
                    <thead>
                      <tr className="border-b border-[#1A1D1D] text-[13px] font-semibold text-[#94A3B8] uppercase tracking-wider bg-[#0B0D0D]">
                        <th className="py-4 px-5 font-semibold">Subscription Name</th>
                        <th className="py-4 px-4 font-semibold">Provider / Service</th>
                        <th className="py-4 px-4 font-semibold">Previous State</th>
                        <th className="py-4 px-5 font-semibold text-right">Date Restored</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1A1D1D] text-xs sm:text-sm">
                      {restoredHistory.map((item) => {
                        const dateFormatted = new Date(item.dateRestored).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        });

                        return (
                          <tr key={item.id} className="hover:bg-[#0F1111] transition-colors">
                            <td className="py-4 px-5 whitespace-nowrap font-bold text-[#F5F7F6]">
                              {item.name}
                            </td>
                            <td className="py-4 px-4 whitespace-nowrap text-[#94A3B8]">
                              {item.provider}
                            </td>
                            <td className="py-4 px-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                                item.previousState === 'Archived'
                                  ? 'bg-[#F59E0B]/10 border-[#F59E0B]/30 text-[#F59E0B]'
                                  : 'bg-[#D9363E]/10 border-[#D9363E]/30 text-[#D9363E]'
                              }`}>
                                {item.previousState}
                              </span>
                            </td>
                            <td className="py-4 px-5 whitespace-nowrap text-right font-medium text-[#94A3B8]">
                              {dateFormatted}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="py-20 sm:py-28 min-h-[320px] text-center flex flex-col items-center justify-center space-y-1.5">
                <div className="max-w-xs space-y-1">
                  <h3 className="text-sm sm:text-base font-medium text-[#F5F7F6]/80">Nothing restored</h3>
                  <p className="text-xs text-[#94A3B8]/60">
                    When you restore subscriptions from Archive or Deleted, a historical log entry will appear here.
                  </p>
                </div>
              </div>
            )
          )}
        </>
      )}



      {/* Subscription Detail Modal for Viewing Details */}
      <SubscriptionDetailModal
        subscription={selectedSub}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedSub(null);
        }}
        onEdit={() => {}}
        onDeleteRequest={() => {}}
        onPaymentReminderRequest={() => {}}
        onRestoreRequest={async (sub) => {
          setIsDetailOpen(false);
          setSelectedSub(null);
          await handleRestore(sub);
        }}
      />

      {/* Confirm Permanent Delete Dialog */}
      <ConfirmDialog
        isOpen={!!permDeletingSub}
        onClose={() => setPermDeletingSub(null)}
        onConfirm={handleConfirmPermanentDelete}
        loading={permDeleteLoading}
        title={`Permanently delete "${permDeletingSub?.name}"?`}
        description="Are you sure you want to permanently erase this subscription? This action cannot be undone and will permanently remove all saved information."
        confirmText="Delete Permanently"
        variant="danger"
      />
    </div>
  );
}
