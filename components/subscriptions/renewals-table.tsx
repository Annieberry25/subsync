'use client';

import type { SubscriptionRow } from '@/lib/services/subscription-service';
import { cleanNotesUserText } from '@/lib/services/subscription-service';
import { formatCurrency } from '@/lib/utils/metrics-utils';
import { ServiceIcon } from '@/components/ui/service-icon';

/**
 * Shared renewals rows.
 *
 * The dashboard spotlight and the renewals page both list upcoming renewals, so
 * they share this table: the wrapper scrolls horizontally and the service column
 * is pinned, so a narrow screen scrolls the columns instead of crushing them.
 * The renewals page passes `pinFirstColumn={false}` because its rows are meant
 * to scroll together (the pinned column felt wrong there), while the small
 * dashboard widget keeps the service name anchored.
 */
export function getPlanName(sub: SubscriptionRow): string {
  const cleanNotes = cleanNotesUserText(sub?.notes).trim();
  if (cleanNotes) return cleanNotes;
  const nameLower = sub.name.toLowerCase();
  if (nameLower.includes('netflix')) return 'Basic Plan';
  if (nameLower.includes('spotify')) return 'Premium Plan';
  if (nameLower.includes('chatgpt') || nameLower.includes('openai')) return 'Plus Plan';
  if (nameLower.includes('icloud') || nameLower.includes('google')) return 'Storage Plan';

  const cycleName = sub.billing_cycle
    ? sub.billing_cycle.charAt(0).toUpperCase() + sub.billing_cycle.slice(1)
    : 'Monthly';
  return `${cycleName} Plan`;
}

export function getRenewalStatus(diffDays: number) {
  if (diffDays < 0) {
    const days = Math.abs(diffDays);
    return {
      text: days === 1 ? 'Overdue by 1 day' : `Overdue by ${days} days`,
      color: '#D9363E',
    };
  }
  if (diffDays === 0) return { text: 'Due today', color: '#D9363E' };
  if (diffDays === 1) return { text: 'In 1 day', color: '#D9363E' };
  if (diffDays <= 4) return { text: `In ${diffDays} days`, color: '#D9363E' };
  return { text: `In ${diffDays} days`, color: '#94A3B8' };
}

export function getCycleSuffix(billingCycle?: string): string {
  if (!billingCycle) return '/month';
  const lower = billingCycle.toLowerCase();
  if (lower === 'yearly' || lower === 'annual') return '/yr';
  if (lower === 'quarterly') return '/quarter';
  if (lower === 'weekly') return '/wk';
  return '/month';
}

export function RenewalsTable({
  items,
  pinFirstColumn = true,
}: {
  items: Array<{ sub: SubscriptionRow; diffDays: number }>;
  pinFirstColumn?: boolean;
}) {
  const stickyCol = pinFirstColumn ? 'table-sticky-col' : '';

  return (
    <div className="w-full table-scroll">
      <table className="w-full text-left border-collapse min-w-[560px]">
        <thead className="sticky top-0 z-20">
          <tr className="border-b border-[#1A1D1D] text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] bg-[#0B0D0D]">
            <th className={`py-3 px-4 font-semibold ${stickyCol}`}>Service</th>
            <th className="py-3 px-4 font-semibold">Plan</th>
            <th className="py-3 px-4 font-semibold">Renewal</th>
            <th className="py-3 px-4 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1A1D1D]">
          {items.map(({ sub, diffDays }) => {
            const status = getRenewalStatus(diffDays);
            const price = Number(sub.price) || 0;
            const cycleSuffix = getCycleSuffix(sub.billing_cycle);
            const planName = getPlanName(sub);

            return (
              <tr key={sub.id} className="group hover:bg-[#0F1111] transition-colors">
                <td className={`py-3.5 px-4 whitespace-nowrap ${stickyCol}`}>
                  <div className="flex items-center gap-3">
                    <ServiceIcon
                      name={sub.name}
                      category={sub.category}
                      providerUrl={sub.provider_url}
                      className="w-9 h-9 rounded-xl shrink-0 border border-[#1A1D1D]"
                    />
                    <span className="font-semibold text-[#F5F7F6] text-sm sm:text-base group-hover:text-[#14B8A6] transition-colors">
                      {sub.name}
                    </span>
                  </div>
                </td>

                <td className="py-3.5 px-4 max-w-[200px]">
                  <span
                    title={planName}
                    className="block truncate font-medium text-xs sm:text-sm text-[#94A3B8]"
                  >
                    {planName}
                  </span>
                </td>

                <td className="py-3.5 px-4 whitespace-nowrap text-xs sm:text-sm font-medium">
                  <span style={{ color: status.color }}>{status.text}</span>
                </td>

                <td className="py-3.5 px-4 whitespace-nowrap text-right font-bold text-[#F5F7F6] text-sm sm:text-base">
                  {formatCurrency(price, sub.currency || 'USD')}{' '}
                  <span className="text-xs font-normal text-[#94A3B8]">{cycleSuffix}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
