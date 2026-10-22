'use client';

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
      size="lg"
      title={subscription.name}
    >
      <div className="space-y-1 min-h-[220px]">
        {accounts.map((account, idx) => {
          /* The account's own amount, falling back to the subscription's for
             the accounts that were added before it carried its own. */
          const price = account.price ?? Number(subscription.price) ?? 0;
          const currency = account.currency || subscription.currency || 'USD';

          return (
            <button
              key={account.id}
              type="button"
              onClick={() => {
                onClose();
                onChoose(account);
              }}
              className="w-full text-left py-4 px-1 hover:bg-[#0F1111] transition-colors cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-[#F5F7F6] group-hover:text-[#14B8A6] transition-colors">
                  Account {idx + 1}
                  <span className="ml-2 font-normal text-[#94A3B8]">
                    {account.label || 'Personal'}
                  </span>
                </span>
                <span className="text-sm font-bold text-[#F5F7F6]">
                  {formatCurrency(price, currency)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
