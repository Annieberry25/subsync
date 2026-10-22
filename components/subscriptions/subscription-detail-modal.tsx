'use client';

import { useMemo, useState } from 'react';
import { Calendar, DollarSign, FileText, Clock, Globe, Users, ChevronLeft } from 'lucide-react';
import Sheet from '@/components/ui/sheet';
import {
  type SubscriptionRow,
  parseAccountLinks,
  parseAttachedReceipts,
  cleanNotesUserText,
} from '@/lib/services/subscription-service';
import { formatCurrency } from '@/lib/utils/metrics-utils';
import { useToast } from '@/lib/hooks/use-toast';

interface SubscriptionDetailModalProps {
  subscription: SubscriptionRow | null;
  isOpen: boolean;
  /**
   * The account the sheet is showing.
   *
   * A subscription can carry more than one account, and the detail of a
   * subscription is the detail of one of them. The chooser form picks this
   * one before the sheet opens.
   */
  accountId?: string | null;
  onClose: () => void;
  /**
   * Back to the chooser.
   *
   * Only offered when the subscription has more than one account: that is the
   * only case where the sheet was opened from a choice, and the only case
   * where there is somewhere to go back to.
   */
  onBack?: () => void;
  /** The account the user is looking at is passed back, so the form can open on it. */
  onEdit: (subscription: SubscriptionRow, accountId?: string) => void;
  onDeleteRequest: (subscription: SubscriptionRow) => void;
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

const _statusBadgeStyles: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-[#10B981]/15 border-[#10B981]/30', text: 'text-[#10B981]', label: 'Active' },
  trial: { bg: 'bg-[#F59E0B]/15 border-[#F59E0B]/30', text: 'text-[#F59E0B]', label: 'Trial Period' },
  paused: { bg: 'bg-[#6B7280]/15 border-[#6B7280]/30', text: 'text-[#9CA3AF]', label: 'Paused' },
  canceled: { bg: 'bg-[#EF4444]/15 border-[#EF4444]/30', text: 'text-[#EF4444]', label: 'Canceled' },
};

export default function SubscriptionDetailModal({
  subscription,
  isOpen,
  accountId,
  onClose,
  onBack,
  onEdit,
  onDeleteRequest,
  onRestoreRequest,
  onCancellationAssistance,
}: SubscriptionDetailModalProps) {
  const { toast: _toast } = useToast();

  /**
   * The account being looked at.
   *
   * A subscription can have more than one account, and they are not the same
   * thing: a family plan and a work plan on the same service, or two
   * logins on one subscription. The sheet shows the one the chooser picked,
   * and it is the one the Edit action opens.
   */
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(accountId ?? null);

  const accountLinks = useMemo(
    () => (subscription ? parseAccountLinks(subscription) : []),
    [subscription]
  );

  /* A different subscription, a different set of accounts, or a different
     account being chosen, resets the choice to the one asked for. */
  const accountKey = `${subscription?.id ?? ''}:${accountId ?? ''}:${accountLinks
    .map((l) => l.id)
    .join(',')}`;
  const [prevAccountKey, setPrevAccountKey] = useState(accountKey);
  if (prevAccountKey !== accountKey) {
    setPrevAccountKey(accountKey);
    setSelectedAccountId(accountId ?? null);
  }

  if (!subscription) return null;

  const priceNum = Number(subscription.price) || 0;
  const attachedReceipts = parseAttachedReceipts(subscription);
  const cleanNotes = cleanNotesUserText(subscription.notes);

  /* The account in view. It falls back to the first one, so opening the sheet
     on a subscription with accounts always shows one of them. */
  const selectedLink =
    accountLinks.find((link) => link.id === selectedAccountId) ?? accountLinks[0] ?? null;

  /* The account's own values, falling back to the subscription's for the
     accounts that were added before it carried its own. */
  const shownPrice = selectedLink?.price ?? priceNum;
  const shownCurrency = selectedLink?.currency || subscription.currency || 'USD';
  const shownCycle = selectedLink?.billing_cycle || subscription.billing_cycle;
  const shownCategory = selectedLink?.category || subscription.category;
  const shownNextDate = selectedLink?.next_billing_date || subscription.next_billing_date;
  const shownStartDate = selectedLink?.start_date || subscription.start_date;

  const formattedPrice = formatCurrency(shownPrice, shownCurrency);
  const formattedAnnualCost = formatCurrency(
    calculateAnnualCost(shownPrice, shownCycle),
    shownCurrency
  );

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

  const rawNextDateObj = parseLocalDate(shownNextDate);
  const nextDate = rawNextDateObj || today;
  const diffTime = nextDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
  const formattedNextDate = rawNextDateObj
    ? rawNextDateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : shownNextDate;

  // Calculate start/created date
  const rawStartDateObj = parseLocalDate(shownStartDate || subscription.created_at);
  const formattedStartDate = rawStartDateObj
    ? rawStartDateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  /* Pinned in the Sheet footer so the actions stay reachable while the
     detail sections scroll behind them.

     Reminder and provider-management live on the subscription card rather than
     here: the card already carries a "Payment reminder" and a "Manage
     subscription" control for the same row, so repeating them here gave the
     same job two entry points and pushed the sheet's pinned footer past the
     width of a phone. This sheet keeps only what is specific to viewing a
     single subscription: edit, cancel, delete, restore.

     The row is pushed to the end rather than starting at the left edge so the
     actions line up with the sheet's own footer buttons (the cancel/save pair
     on sibling sheets) instead of floating against the opposite margin. */
  const actions = (
    <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-3 text-xs">
      {onRestoreRequest ? (
        <button
          type="button"
          onClick={() => {
            onClose();
            onRestoreRequest(subscription);
          }}
          className="min-h-[44px] text-[#10B981] hover:text-[#34D399] font-normal transition-colors cursor-pointer bg-transparent border-0 p-0"
        >
          Restore Subscription
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={() => {
              onClose();
              // The account the user was looking at is the one the form opens
              // on, so the edit starts where the eye already was.
              onEdit(subscription, selectedLink?.id);
            }}
            className="min-h-[44px] text-[#D1D5DB] hover:text-white font-normal transition-colors cursor-pointer bg-transparent border-0 p-0"
          >
            Edit Subscription
          </button>

          {onCancellationAssistance && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onCancellationAssistance(subscription);
              }}
              className="min-h-[44px] text-[#14B8A6] hover:text-[#2DD4BF] font-normal transition-colors cursor-pointer bg-transparent border-0 p-0"
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
            className="min-h-[44px] text-[#EF4444] hover:text-[#F87171] font-normal transition-colors cursor-pointer bg-transparent border-0 p-0"
          >
            Delete
          </button>
        </>
      )}
    </div>
  );

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      size="lg"
      title={subscription.name}
      description={`${shownCycle} billing`}
      headerLeading={
        onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to accounts"
            data-touch="compact"
            className="w-9 h-9 flex items-center justify-center text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        ) : null
      }
      footer={actions}
    >
        {/* The account in view was picked in the chooser form, before this
            sheet opened. There is nothing to choose here: this is the detail
            of one account. */}

        {/* 6 Detailed Sections Grid. The Sheet body owns the scroll. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Section 1: Costs & Billing */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#131617] border border-[#222728] space-y-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#9CA3AF]" />
              <span className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">Costs & Billing</span>
            </div>
            <div>
              <span className="text-2xl sm:text-3xl font-bold text-[#F5F7F6] tracking-tight">{formattedPrice}</span>
              <span className="text-xs text-[#9CA3AF] ml-1.5">/ {shownCycle}</span>
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
                <span>{shownStartDate ? 'Start Date:' : 'Created Date:'}</span>
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
              {/* The values, without labels. The section is called "Category &
                  Website", so saying "Category" next to the category is
                  saying it twice. */}
              <div className="p-3 rounded-xl bg-[#0D0F10] border border-[#1F2425]">
                <span className="text-[#F5F7F6] font-semibold">{shownCategory}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#0D0F10] border border-[#1F2425]">
                {activeProviderUrl ? (
                  /* Plain text. The detail sheet is for reading, not for
                     clicking: a link in here takes the user off the page they
                     opened it to look at. */
                  <span className="text-[#F5F7F6] font-medium truncate max-w-[180px] block">
                    {activeProviderUrl.replace(/^https?:\/\//, '')}
                  </span>
                ) : (
                  <span className="text-[#6B7280] italic">Not set</span>
                )}
              </div>
            </div>
          </div>

          {/* Section 4: Account Type */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#131617] border border-[#222728] space-y-3 col-span-1 md:col-span-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#9CA3AF]" />
              <span className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">
                Account Type
              </span>
            </div>

            {selectedLink ? (
              /* The type, and nothing to click. The account's own link is on
                 the account row in the form, and the detail sheet is for
                 reading. */
              <div
                data-testid="account-type-value"
                className="p-3 rounded-xl bg-[#0D0F10] border border-[#1F2425] text-xs"
              >
                <span className="text-[#F5F7F6] font-semibold">
                  {selectedLink.label || 'Personal'}
                </span>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-[#0D0F10] border border-[#1F2425] text-xs text-[#9CA3AF] leading-relaxed">
                No account type has been set. You can add one by clicking Edit Subscription.
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
                  <span className="text-[11px] text-[#9CA3AF] capitalize">{shownCycle}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
    </Sheet>
  );
}

