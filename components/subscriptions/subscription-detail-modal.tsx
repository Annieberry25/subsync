'use client';

import { useEffect } from 'react';
import { X, ExternalLink, Calendar, DollarSign, Edit2, Settings, Bell, Archive, FileText, Clock, ShieldCheck, Link2, CheckCircle2, RotateCcw } from 'lucide-react';
import { 
  type SubscriptionRow,
  parseAccountLinks,
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
  if (cleanNotes && cleanNotes.toLowerCase().includes('plan')) {
    return cleanNotes;
  }
  const nameLower = sub.name.toLowerCase();
  if (nameLower.includes('netflix')) return 'Basic Plan';
  if (nameLower.includes('spotify')) return 'Premium Plan';
  if (nameLower.includes('chatgpt') || nameLower.includes('openai')) return 'Plus Plan';
  if (nameLower.includes('icloud') || nameLower.includes('google')) return 'Storage Plan';
  if (nameLower.includes('amazon') || nameLower.includes('prime')) return 'Prime Plan';
  
  const cycleName = sub.billing_cycle ? sub.billing_cycle.charAt(0).toUpperCase() + sub.billing_cycle.slice(1) : 'Monthly';
  return `${cycleName} Plan`;
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
    } else {
      toast.info(`Managing settings for ${subscription.name} coming soon.`, 'Manage Plan');
    }
  };

  // Mock payment history based on subscription data
  const historyEntries = [
    {
      date: formattedNextDate,
      status: diffDays <= 0 ? 'Due Today' : 'Upcoming Renewal',
      amount: formattedPrice,
      isUpcoming: true,
    },
    {
      date: new Date(nextDate.getFullYear(), nextDate.getMonth() - 1, nextDate.getDate()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      status: 'Paid',
      amount: formattedPrice,
      isUpcoming: false,
    },
    {
      date: new Date(nextDate.getFullYear(), nextDate.getMonth() - 2, nextDate.getDate()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      status: 'Paid',
      amount: formattedPrice,
      isUpcoming: false,
    },
  ];

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
        {/* Header Bar */}
        <div className="flex items-start justify-between gap-4 border-b border-[#1A1D1D] pb-5 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <ServiceIcon
              name={subscription.name}
              category={subscription.category}
              providerUrl={activeProviderUrl}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl shrink-0 border border-[#1A1D1D]"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="detail-modal-title" className="text-xl sm:text-2xl font-bold text-[#F5F7F6] tracking-tight leading-tight">
                  {subscription.name}
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusInfo.bg} ${statusInfo.text}`}>
                  {statusInfo.label}
                </span>
              </div>
              <p className="text-xs sm:text-sm font-medium text-[#94A3B8] mt-0.5">
                {planName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close subscription detail"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] flex items-center justify-center text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer border border-[#1A1D1D] shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Structured Grid Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {/* Card 1: Costs */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
              <DollarSign className="w-4 h-4 text-[#14B8A6]" />
              <span>Costs & Billing</span>
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-[#94A3B8]">Recurring Price</span>
                <span className="text-lg sm:text-xl font-bold text-[#F5F7F6]">
                  {formattedPrice} <span className="text-xs font-normal text-[#94A3B8]">/ {subscription.billing_cycle}</span>
                </span>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-[#1A1D1D]/60">
                <span className="text-[#94A3B8]">Estimated Annual Spend</span>
                <span className="font-semibold text-[#F5F7F6]">{formattedAnnualCost} / yr</span>
              </div>
            </div>
          </div>

          {/* Card 2: Contract */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
              <Calendar className="w-4 h-4 text-[#14B8A6]" />
              <span>Contract & Renewal</span>
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#94A3B8]">Next Billing Date</span>
                <span className="font-semibold text-[#F5F7F6]">{formattedNextDate}</span>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-[#1A1D1D]/60">
                <span className="text-[#94A3B8]">Renewal Term</span>
                <span className="font-semibold text-[#F5F7F6] capitalize">{diffDays <= 0 ? (
                  <span className="text-[#D9363E] font-bold">Due today</span>
                ) : (
                  `Renews in ${diffDays} days`
                )}</span>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-[#94A3B8]">Auto-Renew Status</span>
                <span className="font-medium text-[#14B8A6] flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#14B8A6]" />
                  Active Auto-Renew
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Category & Website */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
              <Settings className="w-4 h-4 text-[#14B8A6]" />
              <span>Category & Website</span>
            </div>

            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#94A3B8]">Category</span>
                <span className="px-2.5 py-1 rounded-lg bg-[#0D0F0F] border border-[#1A1D1D] text-xs font-medium text-[#F5F7F6]">
                  {subscription.category}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-[#1A1D1D]/60">
                <span className="text-[#94A3B8]">Website</span>
                {officialWebsite ? (
                  <span className="text-[#F5F7F6] font-medium">{officialWebsite}</span>
                ) : (
                  <span className="text-[#94A3B8]">Not configured</span>
                )}
              </div>

              {cleanNotes && (
                <div className="pt-1.5 border-t border-[#1A1D1D]/60 text-xs">
                  <span className="text-[#94A3B8] block mb-1">Notes:</span>
                  <p className="text-[#F5F7F6] text-xs bg-[#0D0F0F] p-2.5 rounded-xl border border-[#1A1D1D] leading-relaxed">
                    {cleanNotes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Card 4: Subscription Accounts Links */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
              <Link2 className="w-4 h-4 text-[#14B8A6]" />
              <span>Subscription Accounts ({accountLinks.length})</span>
            </div>

            {accountLinks.length > 0 ? (
              <div className="space-y-2 pt-1 text-xs">
                {accountLinks.map((link) => (
                  <div key={link.id} className="flex items-center justify-between p-2.5 rounded-xl bg-[#0D0F0F] border border-[#1A1D1D]">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-semibold text-[#14B8A6] bg-[#14B8A6]/15 px-2 py-0.5 rounded border border-[#14B8A6]/30 shrink-0">
                        {link.label || 'Account'}
                      </span>
                      <span className="text-[#F5F7F6] text-xs font-medium truncate">{link.url}</span>
                    </div>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#14B8A6] hover:underline text-xs font-medium flex items-center gap-1 shrink-0 ml-2"
                    >
                      <span>Open</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2 pt-1 text-xs text-[#94A3B8] italic p-2.5 rounded-xl bg-[#0D0F0F] border border-[#1A1D1D]/60">
                No specific user account links configured. Edit subscription to add custom personal or family account URLs.
              </div>
            )}
          </div>
        </div>

        {/* Card 5: History */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
            <Clock className="w-4 h-4 text-[#14B8A6]" />
            <span>Billing & Renewal History</span>
          </div>

          <div className="space-y-2 pt-1">
            {historyEntries.map((entry, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-[#0D0F0F] border border-[#1A1D1D]/60">
                <div className="flex items-center gap-2.5">
                  {entry.isUpcoming ? (
                    <Clock className="w-4 h-4 text-[#F59E0B] shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-[#14B8A6] shrink-0" />
                  )}
                  <div>
                    <span className="text-[#F5F7F6] font-medium block">{entry.date}</span>
                    <span className="text-[11px] text-[#94A3B8]">{entry.status}</span>
                  </div>
                </div>
                <span className="text-sm font-semibold text-[#F5F7F6]">{entry.amount}</span>
              </div>
            ))}
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

                <button
                  type="button"
                  onClick={handleManageWebsite}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] text-[#F5F7F6] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer border border-[#1A1D1D] min-h-[44px]"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#94A3B8]" />
                  <span>Manage Plan</span>
                </button>

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
