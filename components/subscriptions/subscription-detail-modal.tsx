'use client';

import { useEffect } from 'react';
import { X, ExternalLink, Calendar, DollarSign, Edit2, Settings, Bell, Archive, FileText, Clock, ShieldCheck, Link2, CheckCircle2, RotateCcw } from 'lucide-react';
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
}

function getPlanName(sub: SubscriptionRow): string {
  const cleanNotes = cleanNotesUserText(sub.notes);
  if (cleanNotes) {
    return cleanNotes;
  }
  const cycleName = sub.billing_cycle ? sub.billing_cycle.charAt(0).toUpperCase() + sub.billing_cycle.slice(1) : 'Monthly';
  return `${cycleName} Subscription`;
}

function calculateAnnualCost(price: number, billingCycle: string): number {
  const cycle = billingCycle.toLowerCase();
  if (cycle === 'yearly' || cycle === 'annual') return price;
  if (cycle === 'quarterly') return price * 4;
  if (cycle === 'weekly') return price * 52;
  return price * 12; // default monthly
}

const statusBadgeStyles: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-[#14B8A6]/15 border-[#14B8A6]/30', text: 'text-[#14B8A6]', label: 'Active' },
  trial: { bg: 'bg-[#F59E0B]/10 border-[#F59E0B]/30', text: 'text-[#F59E0B]', label: 'Trial Period' },
  paused: { bg: 'bg-[#6B7280]/10 border-[#6B7280]/30', text: 'text-[#9CA3AF]', label: 'Paused' },
  canceled: { bg: 'bg-[#D9363E]/10 border-[#D9363E]/30', text: 'text-[#D9363E]', label: 'Canceled' },
};

export default function SubscriptionDetailModal({
  subscription,
  isOpen,
  onClose,
  onEdit,
  onDeleteRequest,
  onPaymentReminderRequest,
  onRestoreRequest,
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

  const planName = getPlanName(subscription);
  const priceNum = Number(subscription.price) || 0;
  const formattedPrice = formatCurrency(priceNum, subscription.currency);
  const annualCost = calculateAnnualCost(priceNum, subscription.billing_cycle);
  const formattedAnnualCost = formatCurrency(annualCost, subscription.currency);
  const statusInfo = statusBadgeStyles[subscription.status] || statusBadgeStyles.active;
  const accountLinks = parseAccountLinks(subscription);
  const attachedReceipts = parseAttachedReceipts(subscription);
  const cleanNotes = cleanNotesUserText(subscription.notes);

  const officialWebsite = getProviderWebsite(subscription.name, subscription.provider_url);
  const activeProviderUrl = officialWebsite;
  const managementUrl = getProviderManagementUrl(subscription.name, subscription.provider_url);

  // Calculate days until next billing
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rawNextDate = new Date(subscription.next_billing_date);
  const nextDate = !isNaN(rawNextDate.getTime())
    ? new Date(rawNextDate.getFullYear(), rawNextDate.getMonth(), rawNextDate.getDate())
    : today;
  const diffTime = nextDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
  const formattedNextDate = !isNaN(rawNextDate.getTime())
    ? rawNextDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : subscription.next_billing_date;

  const handleManageWebsite = () => {
    if (managementUrl) {
      window.open(managementUrl, '_blank', 'noopener,noreferrer');
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
        className="w-full max-w-3xl bg-[#0F1111] border border-[#1A1D1D] rounded-2xl sm:rounded-3xl p-4 sm:p-7 space-y-6 max-h-[90vh] overflow-y-auto my-auto shadow-2xl animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1A1D1D] pb-4 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <ServiceIcon
              name={subscription.name}
              category={subscription.category}
              providerUrl={activeProviderUrl}
              className="w-12 h-12 rounded-xl shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 id="detail-modal-title" className="text-xl sm:text-2xl font-bold text-[#F5F7F6] tracking-tight truncate">
                  {subscription.name}
                </h2>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusInfo.bg} ${statusInfo.text}`}>
                  {statusInfo.label}
                </span>
              </div>
              <span className="text-xs text-[#94A3B8] block mt-0.5">
                {subscription.category} • {subscription.billing_cycle} billing
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close detail modal"
            className="w-9 h-9 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] flex items-center justify-center text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer border border-[#1A1D1D] shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Cost Breakdown */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Billing Amount</span>
              <DollarSign className="w-4 h-4 text-[#14B8A6]" />
            </div>
            <div>
              <span className="text-2xl sm:text-3xl font-bold text-[#F5F7F6] tracking-tight">{formattedPrice}</span>
              <span className="text-xs text-[#94A3B8] ml-1.5">/ {subscription.billing_cycle}</span>
            </div>
            <div className="pt-2 border-t border-[#1A1D1D] flex items-center justify-between text-xs text-[#94A3B8]">
              <span>Estimated Annual Total:</span>
              <strong className="text-[#F5F7F6] font-semibold">{formattedAnnualCost}</strong>
            </div>
          </div>

          {/* Card 2: Next Renewal Date */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Next Renewal</span>
              <Calendar className="w-4 h-4 text-[#14B8A6]" />
            </div>
            <div>
              <span className="text-xl sm:text-2xl font-bold text-[#F5F7F6] tracking-tight">{formattedNextDate}</span>
            </div>
            <div className="pt-2 border-t border-[#1A1D1D] flex items-center justify-between text-xs">
              <span className="text-[#94A3B8]">Status:</span>
              {diffDays <= 0 ? (
                <span className="text-[#D9363E] font-bold">Renewal Due Today</span>
              ) : (
                <span className="text-[#14B8A6] font-semibold">Renews in {diffDays} {diffDays === 1 ? 'day' : 'days'}</span>
              )}
            </div>
          </div>

          {/* Card 3: Account Links */}
          {accountLinks.length > 0 && (
            <div className="p-4 sm:p-5 rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] space-y-3 col-span-1 md:col-span-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                <Link2 className="w-4 h-4 text-[#14B8A6]" />
                <span>Account Credentials & Links ({accountLinks.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {accountLinks.map((link) => (
                  <div key={link.id} className="p-3 rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] flex items-center justify-between text-xs">
                    <div className="min-w-0 pr-2">
                      <span className="text-[#F5F7F6] font-semibold block truncate">{link.label || 'Personal Account'}</span>
                      {link.email && <span className="text-[11px] text-[#94A3B8] block truncate">{link.email}</span>}
                    </div>
                    {link.url && (
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-[#14B8A6]/15 hover:bg-[#14B8A6]/25 text-[#14B8A6] border border-[#14B8A6]/30 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                      >
                        <span>Visit</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Card 4: User Notes */}
          {cleanNotes && (
            <div className="p-4 sm:p-5 rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] space-y-2 col-span-1 md:col-span-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                <FileText className="w-4 h-4 text-[#14B8A6]" />
                <span>Notes & Plan Details</span>
              </div>
              <p className="text-xs text-[#F5F7F6] leading-relaxed whitespace-pre-wrap pt-1">{cleanNotes}</p>
            </div>
          )}

          {/* Card 5: Attached Receipts */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] space-y-3 col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
              <FileText className="w-4 h-4 text-[#14B8A6]" />
              <span>Attached Receipts ({attachedReceipts.length})</span>
            </div>

            {attachedReceipts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                {attachedReceipts.map((receipt) => (
                  <div key={receipt.id} className="p-3 rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-4 h-4 text-[#14B8A6] shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[#F5F7F6] text-xs font-medium block truncate">{receipt.fileName}</span>
                        <span className="text-[11px] text-[#94A3B8] block">{receipt.uploadDate}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-[#94A3B8] italic p-2.5 rounded-xl bg-[#0D0F0F] border border-[#1A1D1D]/60">
                No receipts attached yet. Use &quot;Import Receipt&quot; to attach payment confirmation files or screenshots.
              </div>
            )}
          </div>
        </div>

        {/* Card 6: Billing & Renewal History */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
            <Clock className="w-4 h-4 text-[#14B8A6]" />
            <span>Billing & Renewal Schedule</span>
          </div>

          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-[#0D0F0F] border border-[#1A1D1D]/60">
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-[#F59E0B] shrink-0" />
                <div>
                  <span className="text-[#F5F7F6] font-medium block">{formattedNextDate}</span>
                  <span className="text-[11px] text-[#94A3B8]">{diffDays <= 0 ? 'Due Today' : 'Upcoming Renewal'}</span>
                </div>
              </div>
              <span className="text-sm font-semibold text-[#F5F7F6]">{formattedPrice}</span>
            </div>
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-[#1A1D1D] shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            {onRestoreRequest ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRestoreRequest(subscription);
                }}
                className="px-5 py-2.5 rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer min-h-[44px]"
              >
                <RotateCcw className="w-4 h-4 text-[#091512]" />
                <span>Restore Subscription</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEdit(subscription);
                  }}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer min-h-[44px]"
                >
                  <Edit2 className="w-3.5 h-3.5 text-[#091512]" />
                  <span>Edit Subscription</span>
                </button>

                {managementUrl && (
                  <button
                    type="button"
                    onClick={handleManageWebsite}
                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] text-[#F5F7F6] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer border border-[#1A1D1D] min-h-[44px]"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-[#94A3B8]" />
                    <span>Manage Plan</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onPaymentReminderRequest(subscription);
                  }}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] text-[#F59E0B] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer border border-[#1A1D1D] min-h-[44px]"
                >
                  <Bell className="w-3.5 h-3.5 text-[#F59E0B]" />
                  <span>Set Reminder</span>
                </button>
              </>
            )}
          </div>

          {!onRestoreRequest && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onDeleteRequest(subscription);
              }}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#D9363E]/10 hover:bg-[#D9363E]/20 text-[#D9363E] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer border border-[#D9363E]/30 min-h-[44px]"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Archive / Delete</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
