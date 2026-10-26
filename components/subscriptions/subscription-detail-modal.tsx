'use client';

import { useMemo, useState } from 'react';
import {
  DollarSign,
  FileText,
  ChevronLeft,
  PencilLine,
  RefreshCw,
} from 'lucide-react';
import Sheet from '@/components/ui/sheet';
import {
  type SubscriptionRow,
  parseAccountLinks,
  parseAttachedReceipts,
  cleanNotesUserText,
} from '@/lib/services/subscription-service';
import { formatCurrency } from '@/lib/utils/metrics-utils';
import { addCycleToDate } from '@/lib/utils/billing-dates';
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
  /** Flip the subscription's auto-renewal flag on or off from the detail sheet. */
  onToggleAutoRenew?: (subscription: SubscriptionRow, enabled: boolean, accountId?: string | null) => void;
  onDeleteRequest: (subscription: SubscriptionRow) => void;
  onRestoreRequest?: (subscription: SubscriptionRow) => void;
  onCancellationAssistance?: (subscription: SubscriptionRow) => void;
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
  onToggleAutoRenew,
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

  const attachedReceipts = parseAttachedReceipts(subscription);
  const cleanNotes = cleanNotesUserText(subscription.notes);

  /* The account in view. It falls back to the first one, so opening the sheet
     on a subscription with accounts always shows one of them. */
  const selectedLink =
    accountLinks.find((link) => link.id === selectedAccountId) ?? accountLinks[0] ?? null;

  /*
   * The account's own values where the user gave them: the amount, the
   * currency, the cycle, the category and the start date come from the
   * account in view, with the row's own values carrying an account that was
   * never given values of its own.
   */
  const shownPrice = selectedLink?.price;
  const shownCurrency = selectedLink?.currency || '';
  const shownCycle = selectedLink?.billing_cycle || subscription.billing_cycle || '';
  const shownCategory = selectedLink?.category || subscription.category || '';
  const shownStartDate = selectedLink?.start_date || '';

  /* The repayment date the sheet shows, in step with the edit form's box:
     the automatic date — one cycle after the start the row was made on, in
     the cycle it is billed in — instead of whatever day the stored record
     has been carrying. A subscription made on 23/10/2026 shows November 23
     as its repayment date and December 23 as the date auto-renewal carries
     it to, whether or not the stored day has been moved since. A row never
     given a start date has nothing automatic to answer from and keeps its
     stored day. */
  const repaymentStart = selectedLink?.start_date || subscription.start_date || '';
  const repaymentNext =
    repaymentStart && shownCycle ? addCycleToDate(repaymentStart, shownCycle) : null;
  const shownNextDate =
    repaymentNext ||
    selectedLink?.next_billing_date ||
    subscription.next_billing_date ||
    '';

  const formattedPrice =
    shownPrice === undefined ? '' : formatCurrency(shownPrice, shownCurrency || 'USD');

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

  /* The auto-renewal date the sheet shows while the flag is on: the day
     auto-renewal will carry the repayment to — the repayment date plus one
     of the cycle the row is billed in, so a repayment on November 23 has its
     auto renewal land on December 23. The repayment date itself is never
     moved by this: it stays the automatic date the user was given on the
     row above. */
  const autoRenewNextIso = shownNextDate
    ? addCycleToDate(shownNextDate, shownCycle || 'monthly')
    : null;
  const autoRenewDateObj = autoRenewNextIso
    ? parseLocalDate(autoRenewNextIso)
    : null;
  const autoRenewDateText = autoRenewDateObj
    ? autoRenewDateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

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
          <div className="flex items-center gap-2">
            {onToggleAutoRenew && (
              <button
                type="button"
                onClick={() => {
                  /* The sheet stays open, on purpose: the icon shows the new
                     state the moment the write lands, and the auto-renewal
                     line under the renewal date is taken away or put back
                     with it. */
                  onToggleAutoRenew?.(subscription, !(subscription.auto_renew === true), selectedLink?.id);
                }}
                aria-label={
                  subscription.auto_renew === true ? 'Turn auto renewal off' : 'Turn auto renewal on'
                }
                title={
                  subscription.auto_renew === true ? 'Turn auto renewal off' : 'Turn auto renewal on'
                }
                data-touch="compact"
                className={`w-9 h-9 -ml-1 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                  subscription.auto_renew === true
                    ? 'text-[#14B8A6] hover:text-[#2DD4BF]'
                    : 'text-[#94A3B8] hover:text-[#F5F7F6]'
                }`}
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onClose();
                // The account the user was looking at is the one the form opens
                // on, so the edit starts where the eye already was.
                onEdit(subscription, selectedLink?.id);
              }}
              aria-label="Edit Subscription"
              title="Edit Subscription"
              data-touch="compact"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer"
            >
              <PencilLine className="w-5 h-5" />
            </button>
          </div>

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

        {/* Detail Sections. The Sheet body owns the scroll. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Section 1: Costs & Billing */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#131617] border border-[#222728] space-y-3 col-span-1 md:col-span-2">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#9CA3AF]" />
              <span className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">Costs & Billing</span>
            </div>
            <div>
              <span className="text-2xl sm:text-3xl font-bold text-[#F5F7F6] tracking-tight">{formattedPrice}</span>
              {shownCycle && (
                <span className="text-xs text-[#9CA3AF] ml-1.5">/ {shownCycle}</span>
              )}
            </div>
          </div>

          {/* Section 2: Category, Website, Billing renewal, Start Date, Notes,
              Account Type, Auto renewal and Attached Receipts in one
              container. Every row is a hairline line: the label on the left,
              the value on the right. */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#131617] border border-[#222728] col-span-1 md:col-span-2">
            <div className="divide-y divide-[#1F2425]">
              <div className="py-3 flex items-center justify-between gap-4">
                <span className="text-xs text-[#9CA3AF] shrink-0">Category</span>
                {shownCategory ? (
                  <span className="text-sm font-semibold text-[#F5F7F6] text-right">{shownCategory}</span>
                ) : (
                  <span className="text-sm text-[#6B7280] italic text-right">Not set</span>
                )}
              </div>

              <div className="py-3 flex items-center justify-between gap-4">
                <span className="text-xs text-[#9CA3AF] shrink-0">Website</span>
                {activeProviderUrl ? (
                  <span className="text-sm font-semibold text-[#F5F7F6] text-right truncate max-w-[260px]">
                    {activeProviderUrl.replace(/^https?:\/\//, '')}
                  </span>
                ) : (
                  <span className="text-sm text-[#6B7280] italic text-right">Not set</span>
                )}
              </div>

              <div className="py-3 flex items-center justify-between gap-4">
                <span className="text-xs text-[#9CA3AF] shrink-0">Billing renewal</span>
                <div className="flex flex-col items-end gap-0.5 text-right min-w-0">
                  <span className="text-sm font-semibold text-[#F5F7F6]">{formattedNextDate}</span>
                  {diffDays < 0 ? (
                    <span className="text-[11px] font-bold text-[#EF4444]">Overdue by {Math.abs(diffDays)} {Math.abs(diffDays) === 1 ? 'day' : 'days'}</span>
                  ) : diffDays === 0 ? (
                    <span className="text-[11px] font-bold text-[#EF4444]">Renews Today</span>
                  ) : (
                    <span className="text-[11px] font-semibold text-[#10B981]">Renews in {diffDays} {diffDays === 1 ? 'day' : 'days'}</span>
                  )}
                </div>
              </div>

              {formattedStartDate && (
                <div className="py-3 flex items-center justify-between gap-4">
                  <span className="text-xs text-[#9CA3AF] shrink-0">{shownStartDate ? 'Start Date' : 'Created Date'}</span>
                  <span className="text-sm font-semibold text-[#F5F7F6] text-right">{formattedStartDate}</span>
                </div>
              )}

              {cleanNotes && (
                <div className="py-3">
                  <span className="text-xs text-[#9CA3AF] block">Notes</span>
                  <p className="text-sm text-[#F5F7F6] leading-relaxed whitespace-pre-wrap mt-1">{cleanNotes}</p>
                </div>
              )}

              <div className="py-3 flex items-center justify-between gap-4">
                <span className="text-xs text-[#9CA3AF] shrink-0">Account Type:</span>
                {selectedLink ? (
                  <span data-testid="account-type-value" className="text-sm font-medium text-[#F5F7F6] text-right">
                    {selectedLink.label || 'Personal'}
                  </span>
                ) : (
                  <span data-testid="account-type-value" className="text-sm text-[#6B7280] italic text-right">
                    Not set
                  </span>
                )}
              </div>

              {/* The auto-renewal information, directly below the account
                  type, as two rows in the sheet's plain shape: "Auto renewal
                  On", and under it "Auto renewal date" with the day the flag
                  renews the row next. This is not the billing renewal above
                  it, which stays the actual repayment date the user was
                  given; and the whole pair exists while auto-renewal is on
                  and is gone the moment it is switched off, so an extinct
                  flag leaves no dates behind on the sheet. */}
              {subscription.auto_renew === true && (
                <>
                  <div className="py-3 flex items-center justify-between gap-4">
                    <span className="text-xs text-[#9CA3AF] shrink-0">Auto renewal</span>
                    <span data-testid="auto-renew-state" className="text-sm font-semibold text-[#14B8A6]">On</span>
                  </div>
                  <div className="py-3 flex items-center justify-between gap-4">
                    <span className="text-xs text-[#9CA3AF] shrink-0">Auto renewal date</span>
                    <span data-testid="auto-renew-date" className="text-sm font-semibold text-[#F5F7F6] text-right">
                      {autoRenewDateText || 'Not set'}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Attached Receipts. The rows are plain lines of the card, not
                boxes inside it. */}
            <div className="mt-4 pt-4 border-t border-[#1F2425]">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#9CA3AF]" />
                <span className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">
                  Attached Receipts ({attachedReceipts.length})
                </span>
              </div>

              {attachedReceipts.length > 0 ? (
                <div className="divide-y divide-[#1A1D1D]/60 pt-1">
                  {attachedReceipts.map((receipt) => (
                    <div key={receipt.id} className="py-2.5 flex items-center gap-2.5 min-w-0">
                      <FileText className="w-4 h-4 text-[#9CA3AF] shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[#F5F7F6] text-xs font-medium block truncate">{receipt.fileName}</span>
                        <span className="text-[11px] text-[#9CA3AF] block">{receipt.uploadDate}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="pt-2 text-xs text-[#9CA3AF] leading-relaxed">
                  No receipts attached yet. Use &quot;Import Receipt&quot; to attach payment confirmation files or screenshots.
                </p>
              )}
            </div>
          </div>
        </div>
    </Sheet>
  );
}

