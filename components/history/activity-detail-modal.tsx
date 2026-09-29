'use client';

import { ExternalLink } from 'lucide-react';
import Sheet from '@/components/ui/sheet';
import { type ActivityRecord } from '@/lib/services/activity-service';
import { formatCurrency } from '@/lib/utils/metrics-utils';
import { ServiceIcon } from '@/components/ui/service-icon';

interface ActivityDetailModalProps {
  activity: ActivityRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onViewSubscription?: (subscriptionName: string) => void;
}

export default function ActivityDetailModal({
  activity,
  isOpen,
  onClose,
  onViewSubscription,
}: ActivityDetailModalProps) {
  if (!activity) return null;

  const dateFormatted = new Date(activity.timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <Sheet
      open={isOpen && Boolean(activity)}
      onClose={onClose}
      size="sm"
      title={activity.title}
      description={dateFormatted}
      footer={
        <div className="flex items-center justify-end gap-3">
          {onViewSubscription && (
            <button
              type="button"
              onClick={() => onViewSubscription(activity.subscriptionName)}
              className="px-4 py-3 min-h-[44px] rounded-xl bg-[#14B8A6] hover:opacity-90 text-xs font-semibold text-[#091512] transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>View Subscription</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 min-h-[44px] rounded-xl bg-[#0D0F0D] hover:bg-[#1A1D1D] text-xs font-semibold text-[#F5F7F6] border border-[#1A1D1D] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      }
    >
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2.5">
            <ServiceIcon
              name={activity.subscriptionName}
              className="w-6 h-6 rounded-lg shrink-0"
            />
            <span className="text-base font-semibold text-[#F5F7F6]">
              {activity.subscriptionName}
            </span>
          </div>
        </div>

        {/* Full Message Body */}
        <div className="space-y-2 mt-4 pt-4 border-t border-[#1A1D1D]">
          <span className="text-xs font-medium text-[#94A3B8] block">
            Message
          </span>
          <div className="text-sm text-[#F5F7F6] bg-[#0F1111] p-4 rounded-xl border border-[#1A1D1D]/90 leading-relaxed font-normal">
            {activity.description}
          </div>
        </div>

        {/* Other Details (Amount, etc.) */}
        {activity.amount !== undefined && (
          <div className="flex items-center justify-between text-xs text-[#94A3B8] bg-[#0F1111] px-4 py-3 rounded-xl border border-[#1A1D1D]/90 mt-4">
            <span className="font-medium">Amount Processed</span>
            <span className="font-semibold text-[#F5F7F6]">
              {formatCurrency(activity.amount, activity.currency || 'USD')}
            </span>
          </div>
        )}
    </Sheet>
  );
}
