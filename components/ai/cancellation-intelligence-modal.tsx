'use client';

import React, { useState } from 'react';
import { X, ExternalLink, Calendar, ShieldAlert, CheckCircle, Clock, ArrowRight } from 'lucide-react';
import {
  getKnownProviderManagementUrl,
  updateSubscription,
  type SubscriptionRow,
} from '@/lib/services/subscription-service';
import { useUserSettings } from '@/lib/contexts/user-settings-context';
import { formatCurrency, getNormalizedMonthlyPrice } from '@/lib/utils/metrics-utils';
import { useToast } from '@/lib/hooks/use-toast';
import { useInbox } from '@/lib/contexts/inbox-context';

interface CancellationIntelligenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscription: SubscriptionRow | null;
  onStatusUpdated?: () => void;
}

export function CancellationIntelligenceModal({
  isOpen,
  onClose,
  subscription,
  onStatusUpdated,
}: CancellationIntelligenceModalProps) {
  const { defaultCurrency } = useUserSettings();
  const { toast } = useToast();
  const { addInboxItem } = useInbox();
  const [updating, setUpdating] = useState(false);

  if (!isOpen || !subscription) return null;

  const mgmtUrl = getKnownProviderManagementUrl(subscription.name) || subscription.provider_url || 'https://google.com';
  const monthlyCost = getNormalizedMonthlyPrice(subscription);
  const annualCost = monthlyCost * 12;
  const daysUntilRenewal = Math.max(
    0,
    Math.ceil((new Date(subscription.next_billing_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24))
  );

  const handleUpdateStatus = async (newStatus: 'canceled' | 'paused') => {
    setUpdating(true);
    const { error } = await updateSubscription(subscription.id, {
      status: newStatus,
    });
    setUpdating(false);

    if (error) {
      toast.error('Failed to update status.', 'Error');
    } else {
      toast.success(
        `Subscription marked as ${newStatus === 'canceled' ? 'Canceled' : 'Paused'}.`,
        'Cancellation Tracked'
      );

      addInboxItem({
        type: 'plan_update',
        title: `Subscription ${newStatus === 'canceled' ? 'Canceled' : 'Paused'}`,
        description: `Successfully tracked status update for "${subscription.name}". You will save ${formatCurrency(monthlyCost, defaultCurrency)}/month.`,
        subscriptionName: subscription.name,
        subscriptionPrice: subscription.price,
        currency: subscription.currency,
        actionType: 'view',
        actionLabel: 'View Subscription',
      });

      onStatusUpdated?.();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-[#0B0D0D] border border-[#1A1D1D] rounded-2xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#1A1D1D] flex items-center justify-between bg-[#000000]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#14B8A6]/10 border border-[#14B8A6]/30 flex items-center justify-center text-[#14B8A6]">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#F5F7F6] tracking-tight">
                Cancellation Intelligence
              </h3>
              <p className="text-[11px] text-[#94A3B8]">
                {subscription.name} Guidance & Route
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] transition-colors flex items-center justify-center cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* Key Metrics / Savings Banner */}
          <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-[#121414] border border-[#1A1D1D]">
            <div>
              <span className="text-[11px] font-medium text-[#94A3B8] block">Potential Monthly Savings</span>
              <span className="text-lg font-bold text-[#14B8A6]">{formatCurrency(monthlyCost, subscription.currency || defaultCurrency)}</span>
            </div>
            <div>
              <span className="text-[11px] font-medium text-[#94A3B8] block">Projected Annual Savings</span>
              <span className="text-lg font-bold text-[#F5F7F6]">{formatCurrency(annualCost, subscription.currency || defaultCurrency)}</span>
            </div>
          </div>

          {/* Renewal timing banner */}
          <div className="p-3 rounded-xl bg-[#0F1111] border border-[#1A1D1D] flex items-center gap-3 text-xs">
            <Clock className="w-4 h-4 text-[#14B8A6] shrink-0" />
            <div>
              <span className="font-semibold text-[#F5F7F6]">Renews on {subscription.next_billing_date}</span>
              <span className="text-[#94A3B8] block">
                {daysUntilRenewal === 0
                  ? 'Renews today! Cancel now to avoid being charged.'
                  : `Cancel within the next ${daysUntilRenewal} days to avoid the next charge.`}
              </span>
            </div>
          </div>

          {/* Cancellation Route instructions */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-[#F5F7F6]">Official Cancellation Route</h4>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              SubHalt identified the verified management route for {subscription.name}. Click below to visit the official account management settings:
            </p>
            <a
              href={mgmtUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-xl bg-[#121414] hover:bg-[#1A1D1D] border border-[#1A1D1D] text-xs font-medium text-[#14B8A6] hover:text-white flex items-center justify-between transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span>Manage & Cancel on Provider Site</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#14B8A6] transition-colors" />
            </a>
          </div>

          {/* SubHalt Status Tracking */}
          <div className="space-y-2 pt-2 border-t border-[#1A1D1D]">
            <h4 className="text-xs font-semibold text-[#F5F7F6]">Track Cancellation Status in SubHalt</h4>
            <p className="text-xs text-[#94A3B8]">
              Once you've requested cancellation on the provider's website, update your status here so SubHalt accurately reflects your portfolio savings:
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleUpdateStatus('paused')}
                disabled={updating}
                className="px-3.5 py-2.5 rounded-xl bg-[#1A1D1D] hover:bg-[#262929] text-[#F5F7F6] border border-[#3F3F46]/40 text-xs font-medium transition-colors cursor-pointer"
              >
                Mark as Paused
              </button>
              <button
                type="button"
                onClick={() => handleUpdateStatus('canceled')}
                disabled={updating}
                className="px-3.5 py-2.5 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#091512] text-xs font-semibold transition-colors cursor-pointer"
              >
                Confirm Canceled
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
