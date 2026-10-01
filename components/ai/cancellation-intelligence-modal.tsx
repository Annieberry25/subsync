'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, CheckCircle, ArrowRight, Loader2, TrendingDown, Undo2 } from 'lucide-react';
import {
  getKnownProviderManagementUrl,
  updateSubscription,
  type SubscriptionRow,
} from '@/lib/services/subscription-service';
import { useCurrency } from '@/lib/contexts/user-settings-context';
import { formatCurrency, getNormalizedMonthlyPrice } from '@/lib/utils/metrics-utils';
import { useToast } from '@/lib/hooks/use-toast';
import Sheet from '@/components/ui/sheet';
import ConfirmDialog from '@/components/ui/confirm-dialog';

const UNDO_WINDOW_MS = 8000;

interface CancellationIntelligenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscription: SubscriptionRow | null;
  onStatusUpdated?: () => void;
  /* Opens the subscription detail sheet. Rendered as a plain text link, not a
     button, so the sheet reads as information rather than a second action bar. */
  onReviewSubscription?: (sub: SubscriptionRow) => void;
}

export function CancellationIntelligenceModal({
  isOpen,
  onClose,
  subscription,
  onStatusUpdated,
  onReviewSubscription,
}: CancellationIntelligenceModalProps) {
  const { defaultCurrency } = useCurrency();
  const { toast } = useToast();
  const [updating, setUpdating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  /* The sheet opens as guidance. The status buttons appear only once the user
     has opened the provider's own route, so nobody confirms a cancellation
     without having been sent to the site that performs it. */
  const [visitedProvider, setVisitedProvider] = useState(false);
  const [appliedChange, setAppliedChange] = useState<{ endDate: string } | null>(null);
  const undoTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  if (!isOpen || !subscription) return null;

  const currency = subscription.currency || defaultCurrency;
  const monthlySavings = getNormalizedMonthlyPrice(subscription, defaultCurrency);
  const annualSavings = monthlySavings * 12;

  /* A cheaper tier is only recommended when the row actually carries both
     halves. A name with no price cannot produce a "save $X/mo" figure, so it
     falls through to recommending a straight cancellation. */
  const cheaperPlanName = subscription.cheaper_plan_name?.trim() || '';
  const cheaperPlanPrice = subscription.cheaper_plan_price;
  const hasCheaperPlan =
    cheaperPlanName.length > 0 &&
    cheaperPlanPrice != null &&
    Number.isFinite(cheaperPlanPrice) &&
    cheaperPlanPrice >= 0;

  const downgradeMonthlySavings = hasCheaperPlan
    ? Math.max(0, monthlySavings - getNormalizedMonthlyPrice(
        { ...subscription, price: cheaperPlanPrice as number, billing_cycle: subscription.billing_cycle },
        defaultCurrency
      ))
    : 0;

  /* The provider link is identical in both branches — a downgrade still has to
     be arranged on the provider's own site. */
  const mgmtUrl =
    getKnownProviderManagementUrl(subscription.name) || subscription.provider_url || null;

  const clearUndoTimer = () => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  };

  const applyStatusChange = async (
    patch: { status: SubscriptionRow['status']; end_date: string }
  ) => {
    setUpdating(true);
    const { error } = await updateSubscription(subscription.id, patch);
    setUpdating(false);
    setConfirmOpen(false);

    if (error) {
      toast.error('Failed to update status.', 'Error');
      return;
    }

    onStatusUpdated?.();
    setAppliedChange({ endDate: patch.end_date });
    clearUndoTimer();
    undoTimerRef.current = setTimeout(() => {
      undoTimerRef.current = null;
      setAppliedChange(null);
      onClose();
    }, UNDO_WINDOW_MS);
  };

  const handleConfirmRecommendation = () => {
    const today = new Date().toISOString().split('T')[0];
    applyStatusChange({ status: 'canceled', end_date: today });
  };

  const handleUndo = () => {
    setUpdating(true);
    // Restores the row's previous status and clears the end date that marked
    // the cancellation, which also reverses the derived Total Savings figure.
    updateSubscription(subscription.id, { status: 'active', end_date: null }).then(({ error }) => {
      setUpdating(false);
      if (error) {
        toast.error('Failed to undo the change.', 'Error');
        return;
      }
      onStatusUpdated?.();
      clearUndoTimer();
      setAppliedChange(null);
      onClose();
      toast.success('Change undone.', 'Reverted');
    });
  };

  const handleKeep = () => {
    onClose();
  };

  return (
    <>
      <Sheet
        open={isOpen}
        onClose={onClose}
        size="md"
        title="Savings Intelligence"
        description={
          <span className="font-semibold text-[#F5F7F6]">{subscription.name}</span>
        }
      >
        {appliedChange ? (
          /* Undo replaces the whole body so the recommendation cannot be
             confirmed twice, and the sheet closes itself when the window ends. */
          <div className="space-y-5 pt-1">
            <div className="p-4 rounded-xl bg-[#121414] border border-[#1A1D1D] space-y-2">
              <div className="flex items-center gap-2.5">
                <CheckCircle className="w-4 h-4 text-[#14B8A6] shrink-0" />
                <span className="text-sm font-semibold text-[#F5F7F6]">
                  {subscription.name} marked as done
                </span>
              </div>
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                {formatCurrency(annualSavings, currency)} a year added to your total savings. Renewal
                reminders have stopped and it has moved out of your active subscriptions.
              </p>
            </div>

            <button
              type="button"
              onClick={handleUndo}
              disabled={updating}
              className="w-full px-3.5 py-3 min-h-[44px] rounded-xl bg-[#1A1D1D] hover:bg-[#262929] text-[#F5F7F6] border border-[#3F3F46]/40 text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
              <span>Undo</span>
            </button>
            <p className="text-[11px] text-[#64748B] text-center">
              This option disappears in a few seconds.
            </p>
          </div>
        ) : (
          <div className="space-y-6 py-3 sm:py-4">
            {/* 1. Savings — plain stacked text, label above its figure. No card. */}
            <div>
              <span className="text-[11px] font-medium text-[#94A3B8] block">
                Potential Monthly Savings
              </span>
              <span className="text-[11px] font-medium text-[#14B8A6] block">
                {formatCurrency(monthlySavings, currency)}
              </span>
            </div>

            <div>
              <span className="text-[11px] font-medium text-[#94A3B8] block">
                Projected Annual Savings
              </span>
              <span className="text-[11px] font-medium text-[#F5F7F6] block">
                {formatCurrency(annualSavings, currency)}
              </span>
            </div>

            {/* 2. Recommended action */}
            <div>
              <h4 className="text-[11px] font-medium text-[#94A3B8]">Recommended Action:</h4>
              {hasCheaperPlan && (
                <p className="text-xs text-[#94A3B8] leading-relaxed flex items-start gap-2 mt-1.5">
                  <TrendingDown className="w-4 h-4 text-[#14B8A6] shrink-0 mt-px" />
                  <span>
                    <span className="font-semibold text-[#F5F7F6]">Downgrade to {cheaperPlanName}</span>{' '}
                    — save {formatCurrency(downgradeMonthlySavings, currency)}/mo
                  </span>
                </p>
              )}
            </div>

            {/* 3. Links, stacked, each on its own line with no wrapper box. */}
            <div>
              {onReviewSubscription && (
                <button
                  type="button"
                  onClick={() => {
                    onReviewSubscription(subscription);
                    onClose();
                  }}
                  className="block text-xs font-medium text-[#14B8A6] hover:text-white transition-colors cursor-pointer"
                >
                  Review subscription
                </button>
              )}

              {mgmtUrl && (
                <a
                  href={mgmtUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setVisitedProvider(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#14B8A6] hover:text-white transition-colors group cursor-pointer mt-2"
                >
                  <span>Cancel on provider site</span>
                  <ExternalLink className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#14B8A6] transition-colors" />
                </a>
              )}

              {!mgmtUrl && (
                /* Kept deliberately: without it a row with no URL gives the user
                   no way to discover how to add one. */
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  We don&apos;t have a management link for {subscription.name} yet. Edit this
                  subscription and add the provider&apos;s account or billing URL, and this will
                  link straight to their cancellation page.
                </p>
              )}
            </div>

            {/* The status buttons stay hidden until the provider route has been
                opened, so the sheet opens as guidance rather than a status form.
                With no route on file there is nothing to visit, so the buttons
                are shown immediately rather than stranding the user. */}
            {(!mgmtUrl || visitedProvider) && (
            <div className="pt-2 border-t border-[#1A1D1D]">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleKeep}
                  disabled={updating}
                  className="px-3.5 py-3 min-h-[44px] rounded-xl bg-transparent hover:bg-[#1A1D1D] text-[#F5F7F6] border border-[#3F3F46]/60 text-xs font-medium transition-colors cursor-pointer disabled:opacity-60"
                >
                  Keep it
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  disabled={updating}
                  className="px-3.5 py-3 min-h-[44px] rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#091512] text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                  <span>{hasCheaperPlan ? 'Confirm Downgraded' : 'Confirm Canceled'}</span>
                </button>
              </div>
            </div>
            )}
          </div>
        )}
      </Sheet>

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmRecommendation}
        title={`Did you complete cancellation on ${subscription.name}'s site?`}
        description={
          hasCheaperPlan
            ? `Confirming marks the downgrade to ${cheaperPlanName} as done and adds the savings to your total.`
            : 'Confirming marks this subscription as canceled, stops renewal reminders, and adds the annual savings to your total.'
        }
        confirmText="Yes, I canceled"
        cancelText="Cancel"
        variant="info"
        loading={updating}
      />
    </>
  );
}
