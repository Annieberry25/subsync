'use client';

import { useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';
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
  useEffect(() => {
    if (isOpen && activity) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, activity, onClose]);

  if (!isOpen || !activity) return null;

  const dateFormatted = new Date(activity.timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] shadow-2xl shadow-black/90 p-6 space-y-6 text-[#F5F7F6]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-[#94A3B8] hover:text-[#F5F7F6] p-1.5 rounded-xl hover:bg-[#1A1D1D] transition-colors cursor-pointer"
          aria-label="Close activity details"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Primary Information Header */}
        <div className="space-y-2 pr-8">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block">
              Activity Event
            </span>
            <h2 className="text-xl font-bold text-[#F5F7F6] tracking-tight">
              {activity.title}
            </h2>
          </div>

          <div className="flex items-center gap-2.5 pt-1">
            <ServiceIcon
              name={activity.subscriptionName}
              className="w-6 h-6 rounded-lg shrink-0"
            />
            <span className="text-base font-semibold text-[#F5F7F6]">
              {activity.subscriptionName}
            </span>
          </div>

          <p className="text-xs text-[#94A3B8] font-normal pt-0.5">
            {dateFormatted}
          </p>
        </div>

        {/* Full Message Body */}
        <div className="space-y-2 border-t border-[#1A1D1D] pt-4">
          <span className="text-xs font-medium text-[#94A3B8] block">
            Message
          </span>
          <div className="text-sm text-[#F5F7F6] bg-[#0F1111] p-4 rounded-xl border border-[#1A1D1D]/90 leading-relaxed font-normal">
            {activity.description}
          </div>
        </div>

        {/* Other Details (Amount, etc.) */}
        {activity.amount !== undefined && (
          <div className="flex items-center justify-between text-xs text-[#94A3B8] bg-[#0F1111] px-4 py-3 rounded-xl border border-[#1A1D1D]/90">
            <span className="font-medium">Amount Processed</span>
            <span className="font-semibold text-[#F5F7F6]">
              {formatCurrency(activity.amount, activity.currency || 'USD')}
            </span>
          </div>
        )}

        {/* Actions Footer */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1A1D1D]">
          {onViewSubscription && (
            <button
              type="button"
              onClick={() => onViewSubscription(activity.subscriptionName)}
              className="py-2 px-4 rounded-xl bg-[#14B8A6] hover:opacity-90 text-xs font-semibold text-[#091512] transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>View Subscription</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 rounded-xl bg-[#0B0D0D] hover:bg-[#1A1D1D] text-xs font-semibold text-[#F5F7F6] border border-[#1A1D1D] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
