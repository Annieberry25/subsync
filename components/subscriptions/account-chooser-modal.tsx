'use client';

import { Calendar, CreditCard, Layers } from 'lucide-react';
import Sheet from '@/components/ui/sheet';
import {
  type AccountLink,
  type SubscriptionRow,
  parseAccountLinks,
} from '@/lib/services/subscription-service';
import { formatCurrency } from '@/lib/utils/metrics-utils';

interface AccountChooserModalProps {
  subscription: SubscriptionRow | null;
  isOpen: boolean;
  onClose: () => void;
  /** The account the user picked. The detail sheet then shows that one. */
  onChoose: (account: AccountLink) => void;
}

/**
 * The accounts of a subscription, and the choice between them.
 *
 * A subscription can carry more than one account — a personal plan and a
 * family plan on the same service — and the detail of a subscription is the
 * detail of one of its accounts. So the choice comes first: this sheet lists
 * the accounts, the user picks the one they are looking at, and the detail
 * opens on it.
 *
 * A subscription with one account has no choice to make, so the sheet does not
 * open for it.
 */
export default function AccountChooserModal({
  subscription,
  isOpen,
  onClose,
  onChoose,
}: AccountChooserModalProps) {
  if (!subscription) return null;

  const accounts = parseAccountLinks(subscription);

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      size="sm"
      title={subscription.name}
      description="This subscription has more than one account. Pick the one you want to see."
    >
      <div className="space-y-1">
        {accounts.map((account, idx) => {
          /* The account's own values, falling back to the subscription's for
             the accounts that were added before it carried its own. */
          const price = account.price ?? Number(subscription.price) ?? 0;
          const currency = account.currency || subscription.currency || 'USD';
          const date = account.next_billing_date || subscription.next_billing_date;
          const category = account.category || subscription.category;

          return (
            <button
              key={account.id}
              type="button"
              onClick={() => {
                onClose();
                onChoose(account);
              }}
              className="w-full text-left py-3 px-1 border-b border-[#1A1D1D] last:border-b-0 hover:bg-[#0F1111] transition-colors cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-[#F5F7F6] group-hover:text-[#14B8A6] transition-colors">
                  {account.label || 'Personal'}
                </span>
                <span className="text-sm font-bold text-[#F5F7F6]">
                  {formatCurrency(price, currency)}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#94A3B8]">
                {date && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3 h-3 shrink-0" />
                    {date}
                  </span>
                )}
                {category && (
                  <span className="inline-flex items-center gap-1">
                    <Layers className="w-3 h-3 shrink-0" />
                    {category}
                  </span>
                )}
                {account.billing_cycle && (
                  <span className="inline-flex items-center gap-1">
                    <CreditCard className="w-3 h-3 shrink-0" />
                    {account.billing_cycle}
                  </span>
                )}
                <span className="text-[#64748B]">Account {idx + 1}</span>
              </div>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
