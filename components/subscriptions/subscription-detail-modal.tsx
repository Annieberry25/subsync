'use client';

import { useEffect, useState } from 'react';
import { X, Calendar, DollarSign, FileText, Clock, Link2, Globe, Users, ExternalLink } from 'lucide-react';
import { 
  type SubscriptionRow,
  parseAccountLinks,
  parseAttachedReceipts,
  cleanNotesUserText,
  getProviderWebsite,
  getProviderManagementUrl
} from '@/lib/services/subscription-service';
import { formatCurrency } from '@/lib/utils/metrics-utils';
import { ServiceIcon } from '@/components/ui/service-icon';
import { useToast } from '@/lib/hooks/use-toast';

interface SubscriptionDetailModalProps {
  subscription: SubscriptionRow | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (subscription: SubscriptionRow) => void;
  onDeleteRequest: (subscription: SubscriptionRow) => void;
  onPaymentReminderRequest: (subscription: SubscriptionRow) => void;
  onRestoreRequest?: (subscription: SubscriptionRow) => void;
  onCancellationAssistance?: (subscription: SubscriptionRow) => void;
}

function calculateAnnualCost(price: number, billingCycle: string): number {
  const cycle = billingCycle.toLowerCase();
  if (cycle === 'yearly' || cycle === 'annual') return price;
  if (cycle === 'quarterly') return price * 4;
  if (cycle === 'weekly') return price * 52;
  return price * 12; // default monthly
}

const statusBadgeStyles: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-[#10B981]/15 border-[#10B981]/30', text: 'text-[#10B981]', label: 'Active' },
  trial: { bg: 'bg-[#F59E0B]/15 border-[#F59E0B]/30', text: 'text-[#F59E0B]', label: 'Trial Period' },
  paused: { bg: 'bg-[#6B7280]/15 border-[#6B7280]/30', text: 'text-[#9CA3AF]', label: 'Paused' },
  canceled: { bg: 'bg-[#EF4444]/15 border-[#EF4444]/30', text: 'text-[#EF4444]', label: 'Canceled' },
};

export default function SubscriptionDetailModal({
  subscription,
  isOpen,
  onClose,
  onEdit,
  onDeleteRequest,
  onPaymentReminderRequest,
  onRestoreRequest,
  onCancellationAssistance,
}: SubscriptionDetailModalProps) {
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && subscription) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, subscription]);

  if (!isOpen || !subscription) return null;

  const priceNum = Number(subscription.price) || 0;
  const formattedPrice = formatCurrency(priceNum, subscription.currency);
  const annualCost = calculateAnnualCost(priceNum, subscription.billing_cycle);
  const formattedAnnualCost = formatCurrency(annualCost, subscription.currency);
  const accountLinks = parseAccountLinks(subscription);
  const attachedReceipts = parseAttachedReceipts(subscription);
  const cleanNotes = cleanNotesUserText(subscription.notes);

  const rawProviderUrl = subscription.provider_url ? subscription.provider_url.trim() : '';
  const activeProviderUrl = rawProviderUrl
    ? (rawProviderUrl.startsWith('http://') || rawProviderUrl.startsWith('https://') ? rawProviderUrl : `https://${rawProviderUrl}`)
    : null;

  // Calculate days until next billing with accurate local date math
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const parseLocalDate = (dateStr: string | null | undefined): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) return new Date(y, m, d);
    }
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const rawNextDateObj = parseLocalDate(subscription.next_billing_date);
  const nextDate = rawNextDateObj || today;
  const diffTime = nextDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
  const formattedNextDate = rawNextDateObj
    ? rawNextDateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : subscription.next_billing_date;

  // Calculate start/created date
  const rawStartDateObj = parseLocalDate(subscription.start_date || subscription.created_at);
  const formattedStartDate = rawStartDateObj
    ? rawStartDateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  const handleManageWebsite = () => {
    if (activeProviderUrl) {
      window.open(activeProviderUrl, '_blank', 'noopener,noreferrer');
    } else {
      toast.error(
        'No website or management portal link is available for this subscription.',
        'No URL configured'
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-modal-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl bg-[#0D0F10] border border-[#1F2425] rounded-2xl sm:rounded-3xl p-4 sm:p-7 space-y-6 max-h-[90vh] overflow-y-auto my-auto shadow-2xl animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1F2425] pb-4 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <ServiceIcon
              name={subscription.name}
              category={subscription.category}
              providerUrl={activeProviderUrl}
              className="w-12 h-12 rounded-xl shrink-0"
            />
            <div className="min-w-0">
              <h2 id="detail-modal-title" className="text-xl sm:text-2xl font-bold text-[#F5F7F6] tracking-tight truncate">
                {subscription.name}
              </h2>
              <span className="text-xs text-[#9CA3AF] block mt-0.5 capitalize">
                {subscription.billing_cycle} billing
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close detail modal"
            className="w-9 h-9 rounded-xl bg-[#131617] hover:bg-[#1A1E1F] flex items-center justify-center text-[#9CA3AF] hover:text-[#F5F7F6] transition-colors cursor-pointer border border-[#222728] shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 6 Detailed Sections Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Section 1: Costs & Billing */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#131617] border border-[#222728] space-y-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#9CA3AF]" />
              <span className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">Costs & Billing</span>
            </div>
            <div>
              <span className="text-2xl sm:text-3xl font-bold text-[#F5F7F6] tracking-tight">{formattedPrice}</span>
              <span className="text-xs text-[#9CA3AF] ml-1.5">/ {subscription.billing_cycle}</span>
            </div>
            <div className="pt-2 border-t border-[#1F2425] flex items-center justify-between text-xs text-[#9CA3AF]">
              <span>Estimated Annual Total:</span>
              <strong className="text-[#F5F7F6] font-semibold">{formattedAnnualCost}</strong>
            </div>
          </div>

          {/* Section 2: Contract & Renewal */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#131617] border border-[#222728] space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#9CA3AF]" />
              <span className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">Contract & Renewal</span>
            </div>
            <div>
              <span className="text-xl sm:text-2xl font-bold text-[#F5F7F6] tracking-tight">{formattedNextDate}</span>
            </div>
            <div className="pt-2 border-t border-[#1F2425] flex items-center justify-between text-xs">
              <span className="text-[#9CA3AF]">Renewal Status:</span>
              {diffDays < 0 ? (
                <span className="text-[#EF4444] font-bold">Overdue by {Math.abs(diffDays)} {Math.abs(diffDays) === 1 ? 'day' : 'days'}</span>
              ) : diffDays === 0 ? (
                <span className="text-[#EF4444] font-bold">Renews Today</span>
              ) : (
                <span className="text-[#10B981] font-semibold">Renews in {diffDays} {diffDays === 1 ? 'day' : 'days'}</span>
              )}
            </div>
            {formattedStartDate && (
              <div className="pt-2 border-t border-[#1F2425] flex items-center justify-between text-xs text-[#9CA3AF]">
                <span>{subscription.start_date ? 'Start Date:' : 'Created Date:'}</span>
                <strong className="text-[#F5F7F6] font-medium">{formattedStartDate}</strong>
              </div>
            )}
            {cleanNotes && (
              <div className="pt-2 border-t border-[#1F2425] text-xs">
                <span className="text-[#9CA3AF] font-medium block mb-1">Notes & Plan Details:</span>
                <p className="text-[#F5F7F6] leading-relaxed whitespace-pre-wrap">{cleanNotes}</p>
              </div>
            )}
          </div>

          {/* Section 3: Category & Website */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#131617] border border-[#222728] space-y-3 col-span-1 md:col-span-2">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#9CA3AF]" />
              <span className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">Category & Website</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
              <div className="p-3 rounded-xl bg-[#0D0F10] border border-[#1F2425] flex items-center justify-between">
                <span className="text-[#9CA3AF]">Category</span>
                <span className="text-[#F5F7F6] font-semibold">{subscription.category}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#0D0F10] border border-[#1F2425] flex items-center justify-between">
                <span className="text-[#9CA3AF]">Official Provider Website</span>
                {activeProviderUrl ? (
                  <a
                    href={activeProviderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#F5F7F6] hover:underline flex items-center gap-1 font-medium truncate max-w-[180px]"
                  >
                    <span className="truncate">{activeProviderUrl.replace(/^https?:\/\//, '')}</span>
                    <ExternalLink className="w-3 h-3 text-[#9CA3AF] shrink-0" />
                  </a>
                ) : (
                  <span className="text-[#6B7280] italic">Not set</span>
                )}
              </div>
            </div>
          </div>

          {/* Section 4: Subscription Accounts */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#131617] border border-[#222728] space-y-3 col-span-1 md:col-span-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#9CA3AF]" />
              <span className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">
                Subscription Accounts ({accountLinks.length})
              </span>
            </div>

            {accountLinks.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                {accountLinks.map((link) => (
                  <div key={link.id} className="p-3 rounded-xl bg-[#0D0F10] border border-[#1F2425] flex items-center justify-between">
                    <div className="min-w-0 pr-2">
                      <span className="text-[#F5F7F6] font-semibold block truncate">{link.label || 'Account Link'}</span>
                      {link.email && <span className="text-[11px] text-[#9CA3AF] block truncate">{link.email}</span>}
                    </div>
                    {link.url && (
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-[#1F2425] hover:bg-[#2A3032] text-[#F5F7F6] text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer shrink-0 border border-[#2A3032]"
                      >
                        <span>Visit</span>
                        <ExternalLink className="w-3 h-3 text-[#9CA3AF]" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-[#0D0F10] border border-[#1F2425] text-xs text-[#9CA3AF] leading-relaxed">
                No account links have been configured. You can add account login emails or portal links by clicking Edit Subscription.
              </div>
            )}
          </div>

          {/* Section 5: Attached Receipts */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#131617] border border-[#222728] space-y-3 col-span-1 md:col-span-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#9CA3AF]" />
              <span className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">
                Attached Receipts ({attachedReceipts.length})
              </span>
            </div>

            {attachedReceipts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                {attachedReceipts.map((receipt) => (
                  <div key={receipt.id} className="p-3 rounded-xl bg-[#0D0F10] border border-[#1F2425] flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-4 h-4 text-[#9CA3AF] shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[#F5F7F6] text-xs font-medium block truncate">{receipt.fileName}</span>
                        <span className="text-[11px] text-[#9CA3AF] block">{receipt.uploadDate}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-[#0D0F10] border border-[#1F2425] text-xs text-[#9CA3AF] leading-relaxed">
                No receipts attached yet. Use &quot;Import Receipt&quot; to attach payment confirmation files or screenshots.
              </div>
            )}
          </div>

          {/* Section 6: Billing & Renewal Schedule */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#131617] border border-[#222728] space-y-3 col-span-1 md:col-span-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">Billing & Renewal Schedule</span>
            </div>

            <div className="pt-1">
              <div className="flex items-center justify-between text-xs p-3 rounded-xl bg-[#0D0F10] border border-[#1F2425]">
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-[#9CA3AF] shrink-0" />
                  <div>
                    <span className="text-[#F5F7F6] font-semibold block">{formattedNextDate}</span>
                    <span className="text-[11px] text-[#9CA3AF]">
                      {diffDays < 0 ? 'Overdue' : diffDays === 0 ? 'Due Today' : 'Upcoming Renewal'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-[#F5F7F6] block">{formattedPrice}</span>
                  <span className="text-[11px] text-[#9CA3AF] capitalize">{subscription.billing_cycle}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions Bar (Text Only, No Icons, Clean SaaS Spacing) */}
        <div className="pt-4 border-t border-[#1F2425] flex flex-col gap-2 shrink-0">
          <div className="flex flex-wrap items-center justify-start gap-x-6 gap-y-3 text-xs">
            {onRestoreRequest ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRestoreRequest(subscription);
                }}
                className="text-[#10B981] hover:text-[#34D399] font-normal transition-colors cursor-pointer bg-transparent border-0 p-0"
              >
                Restore Subscription
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEdit(subscription);
                  }}
                  className="text-[#D1D5DB] hover:text-white font-normal transition-colors cursor-pointer bg-transparent border-0 p-0"
                >
                  Edit Subscription
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onPaymentReminderRequest(subscription);
                  }}
                  className="text-[#D1D5DB] hover:text-white font-normal transition-colors cursor-pointer bg-transparent border-0 p-0"
                >
                  Set Reminder
                </button>

                <button
                  type="button"
                  onClick={handleManageWebsite}
                  className="text-[#D1D5DB] hover:text-white font-normal transition-colors cursor-pointer bg-transparent border-0 p-0"
                >
                  Manage Subscription
                </button>

                {onCancellationAssistance && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onCancellationAssistance(subscription);
                    }}
                    className="text-[#14B8A6] hover:text-[#2DD4BF] font-normal transition-colors cursor-pointer bg-transparent border-0 p-0"
                  >
                    Cancellation Intelligence
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onDeleteRequest(subscription);
                  }}
                  className="text-[#EF4444] hover:text-[#F87171] font-normal transition-colors cursor-pointer bg-transparent border-0 p-0"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

