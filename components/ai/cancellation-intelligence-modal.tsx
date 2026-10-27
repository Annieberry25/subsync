'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle, Eye, Loader2, PiggyBank, Undo2 } from 'lucide-react';
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

/*
   Providers that offer an annual plan typically discount it about 15–20%
   below paying monthly (Disney+ ~15%, Spotify ~16%, YouTube Premium ~16–23%,
   Notion ~20%). 15% is the conservative end of that band, so the estimate
   stays defensible and we never over-promise savings. Every annual-swap
   suggestion is explicitly labeled an estimate.
   */
export const TYPICAL_ANNUAL_DISCOUNT = 0.15;

export const MIN_MONTHLY_FOR_ANNUAL_SUGGESTION = 10;

export type SavingRecommendationType = 'annual-swap' | 'downgrade';

export interface SavingRecommendation {
  type: SavingRecommendationType;
  monthlySavings: number;
  annualSavings: number;
  headline: string;
  description: string;
  estimate: boolean;
  /* Provider-site URL to switch plans on, or null when we have nowhere to
     send the user. */
  actionUrl: string | null;
}

export function buildSavingRecommendations(
  subscription: SubscriptionRow,
  defaultCurrency: string
): SavingRecommendation[] {
  const currentMonthly = getNormalizedMonthlyPrice(subscription, defaultCurrency);
  const providerUrl =
    getKnownProviderManagementUrl(subscription.name) ||
    subscription.provider_url ||
    null;
  const items: SavingRecommendation[] = [];

  // 1. Downgrade to a cheaper tier — only when the row actually carries both
  //    halves, so every figure is real user-recorded data rather than an estimate.
  const cheaperPlanName = subscription.cheaper_plan_name?.trim() || '';
  const cheaperPlanPrice = subscription.cheaper_plan_price;
  if (
    cheaperPlanName &&
    cheaperPlanPrice != null &&
    Number.isFinite(cheaperPlanPrice) &&
    cheaperPlanPrice >= 0
  ) {
    const cheaperMonthly = getNormalizedMonthlyPrice(
      { ...subscription, price: cheaperPlanPrice as number },
      defaultCurrency
    );
    const saving = currentMonthly - cheaperMonthly;
    if (saving >= 0.01) {
      items.push({
        type: 'downgrade',
        monthlySavings: saving,
        annualSavings: saving * 12,
        headline: `Save ${formatCurrency(saving, defaultCurrency)}/mo`,
        description: `Switch ${subscription.name} to the “${cheaperPlanName}” plan at ${formatCurrency(cheaperMonthly, defaultCurrency)}/mo instead of ${formatCurrency(currentMonthly, defaultCurrency)}/mo. That’s about ${formatCurrency(saving * 12, defaultCurrency)}/yr.`,
        estimate: false,
        actionUrl: providerUrl,
      });
    }
  }

  // 2. Switch to annual billing — estimated discount band.
  if (
    subscription.billing_cycle === 'monthly' &&
    currentMonthly >= MIN_MONTHLY_FOR_ANNUAL_SUGGESTION
  ) {
    const monthlySaving = currentMonthly * TYPICAL_ANNUAL_DISCOUNT;
    items.push({
      type: 'annual-swap',
      monthlySavings: monthlySaving,
      annualSavings: monthlySaving * 12,
      headline: `Save up to ${formatCurrency(monthlySaving, defaultCurrency)}/mo`,
      description: `Switching ${subscription.name} to an annual plan could save about ${formatCurrency(monthlySaving * 12, defaultCurrency)}/yr on your current ${formatCurrency(currentMonthly * 12, defaultCurrency)}/yr. Most providers discount annual plans by 15–20% below monthly. This is an estimate based on your billing, not a guarantee.`,
      estimate: true,
      actionUrl: providerUrl,
    });
  }

  items.sort((a, b) => b.monthlySavings - a.monthlySavings);
  return items;
}

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

  const recommendations = buildSavingRecommendations(subscription, defaultCurrency);

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

  const hasAnyRecommendation = recommendations.length > 0;
  const top = recommendations[0];

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
        {/* No genuine saving recommendation for this subscription: show nothing
            rather than inventing a cancel/delete pitch. */}
        {!hasAnyRecommendation && !appliedChange && (
          <div className="py-6 text-center">
            <PiggyBank className="w-8 h-8 mx-auto mb-3 text-[#94A3B8] shrink-0" />
            <h3 className="text-sm font-semibold text-[#F5F7F6]">
              No saving recommendation right now
            </h3>
            <p className="text-xs text-[#94A3B8] mt-2 max-w-xs mx-auto leading-relaxed">
              We couldn’t find a cheaper way to pay for {subscription.name} — no
              recorded cheaper tier and no annual-billing estimate applies. Keep an
              eye on the renewal date instead.
            </p>
            <button
              type="button"
              onClick={handleKeep}
              className="mt-4 px-3.5 py-2 rounded-lg bg-[#14B8A6] text-[#091512] text-xs font-semibold hover:bg-[#0D9488] transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        )}

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
              className="w-full px-3.5 py-3 min-h-[44px] rounded-xl bg-[#1A1D1D] hover:bg-[#262929] text-[#F5F7F6] border border-[#3F3F46]/40 text-xs font-medium transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
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
            {hasAnyRecommendation && (
              <>
                {/* 1. Savings — plain stacked text, label above its figure. No card. */}
                <div>
                  <span className="text-[11px] font-medium text-[#94A3B8] block">
                    Potential Monthly Savings
                  </span>
                  <span className="text-[11px] font-medium text-[#14B8A6] block">
                    {formatCurrency(top.monthlySavings, currency)}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] font-medium text-[#94A3B8] block">
                    Projected Annual Savings
                  </span>
                  <span className="text-[11px] font-medium text-[#F5F7F6] block">
                    {formatCurrency(top.annualSavings, currency)}
                  </span>
                </div>

                {/* 2. Recommended action */}
                <div>
                  <span className="block text-xl sm:text-3xl font-bold text-[#F5F7F6] tracking-tight leading-tight">
                    {top.headline}
                  </span>

                  <p className="text-xs text-[#94A3B8] leading-relaxed mt-2">
                    {top.description}
                  </p>
                </div>

                {/* 3. Links — go to the provider's own page to switch plans. */}
                <div>
                  {top.actionUrl != null && (
                    <a
                      href={top.actionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setVisitedProvider(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#14B8A6] hover:text-white transition-colors group cursor-pointer mt-2 block"
                    >
                      Switch on provider site
                    </a>
                  )}

                  {!top.actionUrl && (
                    <p className="text-xs text-[#94A3B8] leading-relaxed">
                      We don&apos;t have a management link for {subscription.name} yet. Edit this
                      subscription and add the provider&apos;s account or billing URL.
                    </p>
                  )}

                  {onReviewSubscription && (
                    <button
                      type="button"
                      onClick={() => {
                        onReviewSubscription(subscription);
                        onClose();
                      }}
                      className="block text-xs font-medium text-[#14B8A6] hover:text-white transition-colors cursor-pointer mt-3"
                    >
                      Review subscription
                    </button>
                  )}
                </div>
              </>
            )}

            {!hasAnyRecommendation && (
              <div className="pt-2 border-t border-[#1A1D1D]">
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  There’s no specific saving recommendation for {subscription.name} right now.
                </p>
              </div>
            )}

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
                    {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>
                      {hasCheaperPlan ? 'Confirm Downgraded' : 'Confirm Canceled'}
                    </span>
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
