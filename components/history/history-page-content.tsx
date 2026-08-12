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

function ActivityMessageItem({ activity, onClick }: ActivityMessageItemProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isTouchSwiping = useRef(false);

  const handleMouseEnter = () => {
    if (!containerRef.current || !textRef.current) return;
    const containerWidth = containerRef.current.clientWidth;
    const textWidth = textRef.current.scrollWidth;
    const overflowDistance = textWidth - containerWidth;

    if (overflowDistance > 0) {
      setIsHovered(true);
      const duration = Math.max(3500, (overflowDistance / 35) * 1000);

      if (animationRef.current) {
        animationRef.current.cancel();
      }

      animationRef.current = textRef.current.animate(
        [
          { transform: 'translateX(0px)', offset: 0 },
          { transform: 'translateX(0px)', offset: 0.12 },
          { transform: `translateX(-${overflowDistance + 12}px)`, offset: 0.9 },
          { transform: `translateX(-${overflowDistance + 12}px)`, offset: 1.0 },
        ],
        {
          duration: duration,
          easing: 'linear',
          fill: 'forwards',
        }
      );
    }
  };

  const handleMouseLeave = () => {
    if (animationRef.current) {
      animationRef.current.cancel();
      animationRef.current = null;
    }
    if (textRef.current) {
      textRef.current.style.transform = 'translateX(0px)';
    }
    setIsHovered(false);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = e.currentTarget.scrollLeft;
    if (scrollLeft > 6) {
      if (!isScrolled) setIsScrolled(true);
    } else {
      if (isScrolled) setIsScrolled(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isTouchSwiping.current = false;
    if (animationRef.current) {
      animationRef.current.cancel();
      animationRef.current = null;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current !== null && touchStartY.current !== null) {
      const diffX = Math.abs(e.touches[0].clientX - touchStartX.current);
      const diffY = Math.abs(e.touches[0].clientY - touchStartY.current);
      if (diffX > 6 && diffX > diffY) {
        isTouchSwiping.current = true;
      }
    }
  };

  const handleClick = () => {
    if (isTouchSwiping.current) {
      return;
    }
    onClick();
  };

  return (
    <div
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      className="group cursor-pointer py-2 px-3 sm:px-0 min-h-[32px] flex items-center w-full max-w-full overflow-hidden"
    >
      <div className="relative w-full max-w-xl overflow-hidden flex items-center">
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="w-full overflow-x-auto no-scrollbar whitespace-nowrap touch-pan-x scroll-smooth flex items-center"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <p
            ref={textRef}
            className={`text-xs sm:text-sm font-normal leading-relaxed inline-block transition-colors duration-200 select-none ${
              isHovered || isScrolled
                ? 'text-[#F5F7F6]'
                : 'text-[#94A3B8]'
            }`}
          >
            {activity.description}
          </p>
        </div>

        {/* Trailing ellipsis fade indicator for initial un-scrolled state */}
        {!isScrolled && !isHovered && (
          <div className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none flex items-center justify-end bg-gradient-to-l from-[#000000] via-[#000000]/90 to-transparent pr-0.5 text-xs text-[#94A3B8]">
            ...
          </div>
        )}
      </div>
    </div>
  );
}

export default function HistoryPageContent({ section = 'all' }: HistoryPageContentProps) {
  const { toast } = useToast();

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
                    <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider block">
                      Activity Event
                    </span>
                    <p className="text-base sm:text-lg font-medium text-[#F5F7F6]">
                      {selectedActivity.title}
                    </p>
                  </div>

                  {/* 2. Subscription */}
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider block">
                      Subscription
                    </span>
                    <p className="text-base sm:text-lg font-medium text-[#F5F7F6]">
                      {selectedActivity.subscriptionName}
                    </p>
                  </div>

                  {/* 3. Detail */}
                  <div className="space-y-1 max-w-3xl">
                    <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider block">
                      Detail
                    </span>
                    <p className="text-base sm:text-lg font-normal text-[#F5F7F6] leading-relaxed">
                      {selectedActivity.description}
                    </p>
                  </div>

                  {/* 4. Timestamp */}
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider block">
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

                {/* Activity Feed List - Clean Vertical List with Hover-to-Scroll Text Preview */}
                {filteredActivities.length > 0 ? (
                  <div className="space-y-3 py-2">
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
                  <div className="py-12 text-center flex flex-col items-center justify-center space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-[#14B8A6]/10 border border-[#14B8A6]/20 flex items-center justify-center text-[#14B8A6]">
                      <Clock className="w-8 h-8 text-[#14B8A6]" />
                    </div>
                    <div className="max-w-xs space-y-1">
                      <h3 className="text-base font-bold text-[#F5F7F6]">No activity recorded</h3>
                      <p className="text-xs text-[#94A3B8]">
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
            archivedList.length > 0 ? (
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
            ) : (
              <div className="py-12 text-center flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-center justify-center text-[#F59E0B]">
                  <Archive className="w-8 h-8 text-[#F59E0B]" />
                </div>
                <div className="max-w-xs space-y-1">
                  <h3 className="text-base font-bold text-[#F5F7F6]">No archived subscriptions</h3>
                  <p className="text-xs text-[#94A3B8]">
                    Subscriptions you archive will be stored here safely without affecting active metrics.
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
              <div className="py-12 text-center flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-[#D9363E]/10 border border-[#D9363E]/20 flex items-center justify-center text-[#D9363E]">
                  <Trash2 className="w-8 h-8 text-[#D9363E]" />
                </div>
                <div className="max-w-xs space-y-1">
                  <h3 className="text-base font-bold text-[#F5F7F6]">No deleted subscriptions</h3>
                  <p className="text-xs text-[#94A3B8]">
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
              <div className="py-12 text-center flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-[#14B8A6]/15 border border-[#14B8A6]/30 flex items-center justify-center text-[#14B8A6]">
                  <RotateCcw className="w-8 h-8 text-[#14B8A6]" />
                </div>
                <div className="max-w-xs space-y-1">
                  <h3 className="text-base font-bold text-[#F5F7F6]">No restored history records</h3>
                  <p className="text-xs text-[#94A3B8]">
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
