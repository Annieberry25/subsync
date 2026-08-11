'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Archive, 
  Trash2, 
  RotateCcw, 
  ChevronRight, 
  AlertCircle 
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
import { formatCurrency } from '@/lib/utils/metrics-utils';
import { ServiceIcon } from '@/components/ui/service-icon';
import { useToast } from '@/lib/hooks/use-toast';
import SubscriptionDetailModal from '@/components/subscriptions/subscription-detail-modal';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { SubscriptionCardSkeleton } from '@/components/ui/skeleton';

export type HistorySection = 'archive' | 'deleted' | 'restored';

interface HistoryPageContentProps {
  section?: HistorySection;
}

const sectionHeaderMeta: Record<HistorySection, { title: string; subtitle: string }> = {
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

export default function HistoryPageContent({ section = 'archive' }: HistoryPageContentProps) {
  const { toast } = useToast();

  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [restoredHistory, setRestoredHistory] = useState<RestoredHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail Modal state
  const [selectedSub, setSelectedSub] = useState<SubscriptionRow | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

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
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const archivedList = useMemo(() => filterArchivedSubscriptions(subscriptions), [subscriptions]);
  const deletedList = useMemo(() => filterDeletedSubscriptions(subscriptions), [subscriptions]);

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

  const headerInfo = sectionHeaderMeta[section] || sectionHeaderMeta.archive;

  return (
    <div className="space-y-6 sm:space-y-8 bg-ambient-grid min-h-[85vh] pb-32">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-white tracking-tight leading-[34px]">
            {headerInfo.title}
          </h1>
          <p className="text-[14px] font-normal text-[#A1AAB8] mt-1">
            {headerInfo.subtitle}
          </p>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-[#EF4444]/10 border border-[#EF4444]/20 flex items-center gap-3 text-[#EF4444] text-xs">
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
          {/* SECTION 1: ARCHIVE */}
          {section === 'archive' && (
            archivedList.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {archivedList.map((sub) => (
                  <div
                    key={sub.id}
                    className="w-full rounded-2xl p-5 bg-[#1D222B] border border-[#2B313D] hover:border-[#4F46E5] flex flex-col justify-between transition-all duration-300 gap-4"
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
                          <h3 className="font-semibold text-white text-[18px] tracking-tight truncate">
                            {sub.name}
                          </h3>
                          <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B] mt-0.5">
                            Archived
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-2xl font-bold text-white tracking-tight">
                        {formatCurrency(Number(sub.price), sub.currency)}
                      </span>
                      <span className="text-xs text-[#A1AAB8]">/ {sub.billing_cycle}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#A1AAB8]">
                      <span>Category: <strong className="text-white font-medium">{sub.category}</strong></span>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-[#2B313D]/60">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSub(sub);
                          setIsDetailOpen(true);
                        }}
                        className="flex-1 py-2 px-3 rounded-xl bg-[#171A21] hover:bg-[#2B313D] text-xs font-semibold text-white border border-[#2B313D] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <ChevronRight className="w-3.5 h-3.5 text-[#4F46E5]" />
                        <span>View Details</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRestore(sub)}
                        className="flex-1 py-2 px-3 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] text-xs font-semibold text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
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
                  <h3 className="text-base font-bold text-white">No archived subscriptions</h3>
                  <p className="text-xs text-[#A1AAB8]">
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
                    className="w-full rounded-2xl p-5 bg-[#1D222B] border border-[#2B313D] hover:border-[#EF4444]/60 flex flex-col justify-between transition-all duration-300 gap-4"
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
                          <h3 className="font-semibold text-white text-[18px] tracking-tight truncate">
                            {sub.name}
                          </h3>
                          <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] mt-0.5">
                            Soft Deleted
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-2xl font-bold text-white tracking-tight">
                        {formatCurrency(Number(sub.price), sub.currency)}
                      </span>
                      <span className="text-xs text-[#A1AAB8]">/ {sub.billing_cycle}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#A1AAB8]">
                      <span>Category: <strong className="text-white font-medium">{sub.category}</strong></span>
                    </div>

                    <div className="flex flex-col gap-2 pt-2 border-t border-[#2B313D]/60">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSub(sub);
                            setIsDetailOpen(true);
                          }}
                          className="flex-1 py-2 px-3 rounded-xl bg-[#171A21] hover:bg-[#2B313D] text-xs font-semibold text-white border border-[#2B313D] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <ChevronRight className="w-3.5 h-3.5 text-[#4F46E5]" />
                          <span>View Details</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRestore(sub)}
                          className="flex-1 py-2 px-3 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] text-xs font-semibold text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restore</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setPermDeletingSub(sub)}
                        className="w-full py-2 px-3 rounded-xl bg-[#EF4444]/10 hover:bg-[#EF4444]/20 text-xs font-semibold text-[#EF4444] border border-[#EF4444]/30 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
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
                <div className="w-16 h-16 rounded-2xl bg-[#EF4444]/10 border border-[#EF4444]/20 flex items-center justify-center text-[#EF4444]">
                  <Trash2 className="w-8 h-8 text-[#EF4444]" />
                </div>
                <div className="max-w-xs space-y-1">
                  <h3 className="text-base font-bold text-white">No deleted subscriptions</h3>
                  <p className="text-xs text-[#A1AAB8]">
                    Subscriptions you remove are kept here first so you can review or restore them anytime.
                  </p>
                </div>
              </div>
            )
          )}

          {/* SECTION 3: RESTORED */}
          {section === 'restored' && (
            restoredHistory.length > 0 ? (
              <div className="w-full max-w-full overflow-hidden rounded-[20px] bg-[#171A21] border border-[#2B313D] shadow-sm">
                <div className="w-full overflow-x-auto no-scrollbar">
                  <table className="w-full text-left border-collapse min-w-[640px]">
                    <thead>
                      <tr className="border-b border-[#2B313D] text-[13px] font-semibold text-[#6F7787] uppercase tracking-wider bg-[#1D222B]/60">
                        <th className="py-4 px-5 font-semibold">Subscription Name</th>
                        <th className="py-4 px-4 font-semibold">Provider / Service</th>
                        <th className="py-4 px-4 font-semibold">Previous State</th>
                        <th className="py-4 px-5 font-semibold text-right">Date Restored</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2B313D]/60 text-xs sm:text-sm">
                      {restoredHistory.map((item) => {
                        const dateFormatted = new Date(item.dateRestored).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        });

                        return (
                          <tr key={item.id} className="hover:bg-[#1D222B]/70 transition-colors">
                            <td className="py-4 px-5 whitespace-nowrap font-bold text-white">
                              {item.name}
                            </td>
                            <td className="py-4 px-4 whitespace-nowrap text-[#A1AAB8]">
                              {item.provider}
                            </td>
                            <td className="py-4 px-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                                item.previousState === 'Archived'
                                  ? 'bg-[#F59E0B]/10 border-[#F59E0B]/30 text-[#F59E0B]'
                                  : 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]'
                              }`}>
                                {item.previousState}
                              </span>
                            </td>
                            <td className="py-4 px-5 whitespace-nowrap text-right font-medium text-[#A1AAB8]">
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
                <div className="w-16 h-16 rounded-2xl bg-[#4F46E5]/10 border border-[#4F46E5]/20 flex items-center justify-center text-[#4F46E5]">
                  <RotateCcw className="w-8 h-8 text-[#4F46E5]" />
                </div>
                <div className="max-w-xs space-y-1">
                  <h3 className="text-base font-bold text-white">No restored history records</h3>
                  <p className="text-xs text-[#A1AAB8]">
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
