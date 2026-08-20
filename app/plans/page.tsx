'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, X, Loader2, CreditCard, ShieldCheck } from 'lucide-react';
import { useUserSettings } from '@/lib/contexts/user-settings-context';
import { useToast } from '@/lib/hooks/use-toast';
import { useInbox } from '@/lib/contexts/inbox-context';
import { recordActivity } from '@/lib/services/activity-service';
import { createSubscription } from '@/lib/services/subscription-service';
import { FREE_SUBSCRIPTION_LIMIT } from '@/lib/constants';
import { MastercardIcon } from '@/components/ui/card-icons';

function PlansContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isPlus, updatePlanTier } = useUserSettings();
  const { toast } = useToast();
  const { addInboxItem } = useInbox();

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleClose = () => {
    const from = searchParams.get('from');
    if (from) {
      router.push(from);
    } else {
      router.back();
    }
  };

  const handleOpenCheckout = () => {
    setIsCheckoutOpen(true);
  };

  const handleCompletePayment = async () => {
    setProcessing(true);
    try {
      // 1. Create real SubHalt subscription item in subscription state
      await createSubscription({
        name: 'SubHalt',
        price: 4.99,
        currency: 'USD',
        billing_cycle: 'monthly',
        category: 'Software',
        next_billing_date: '2026-09-15',
        start_date: new Date().toISOString().split('T')[0],
        status: 'active',
        payment_method: 'Mastercard •••• 6730',
        provider_url: 'https://subhalt.com',
        notes: 'SubHalt subscription auto-renews monthly at $4.99.',
      });

      // 2. Update user plan tier to plus
      await updatePlanTier('plus');

      // 3. Record activity in History
      recordActivity({
        subscriptionName: 'SubHalt',
        type: 'added',
        title: 'SubHalt Subscription Created',
        description: 'SubHalt — $4.99 — Paid',
        amount: 4.99,
        currency: 'USD',
      });

      // 4. Send notification to Inbox with 'View subscription' action
      addInboxItem({
        type: 'plan_update',
        title: 'SubHalt Subscription Active',
        description: 'You subscribed to SubHalt. Your SubHalt plan is now active and will renew according to your selected billing cycle.',
        actionType: 'view',
        actionLabel: 'View subscription',
        subscriptionName: 'SubHalt',
        subscriptionPrice: 4.99,
        currency: 'USD',
      });

      toast.success('Your SubHalt subscription was successfully created!', 'Subscribed to Plus');
      setIsCheckoutOpen(false);

      // 5. Redirect to Subscriptions page
      router.push('/subscriptions');
    } catch {
      toast.error('Failed to process payment. Please try again.', 'Payment Failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090A0B] text-[#F5F7F6] py-12 px-6 sm:px-12 lg:px-16 animate-fade-in relative">
      {/* Top Header Bar with Standalone Close (X) Icon */}
      <div className="max-w-6xl mx-auto flex items-center justify-end pb-8">
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close plans view"
          className="w-11 h-11 rounded-full bg-[#141718] hover:bg-[#1F2325] text-[#94A3B8] hover:text-[#F5F7F6] flex items-center justify-center transition-colors cursor-pointer border border-[#232729] shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="max-w-5xl mx-auto space-y-12 pb-16">
        {/* Main Hero Section */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#F5F7F6]">
            Choose a plan that works for you
          </h1>
          <p className="text-base sm:text-lg text-[#94A3B8] leading-relaxed">
            Track, manage, and optimize all your recurring subscriptions with SubHalt. Cancel anytime.
          </p>
        </div>

        {/* Side-by-Side Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto pt-4">
          {/* FREE PLAN CARD */}
          <div className="p-8 sm:p-10 rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] flex flex-col justify-between space-y-8">
            <div className="space-y-8">
              {/* Top Status Label */}
              <div className="min-h-[24px]">
                {!isPlus && (
                  <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                    Current plan
                  </span>
                )}
              </div>

              {/* Plan Name & Price */}
              <div className="space-y-3 border-b border-[#1A1D1D]/80 pb-8">
                <h2 className="text-3xl sm:text-4xl font-bold text-[#F5F7F6]">Free</h2>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl sm:text-5xl font-extrabold text-[#F5F7F6]">$0</span>
                  <span className="text-base text-[#94A3B8]">/month</span>
                </div>
              </div>

              {/* CTA Button placed BEFORE Feature List */}
              <div className="space-y-3">
                {!isPlus ? (
                  <button
                    type="button"
                    disabled
                    className="w-full py-4 rounded-xl bg-[#1A1D1D] text-[#94A3B8] text-sm font-semibold cursor-default text-center"
                  >
                    Current plan
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="w-full py-4 rounded-xl bg-[#1A1D1D] text-[#94A3B8] text-sm font-medium cursor-default text-center"
                  >
                    Free Tier
                  </button>
                )}
                <p className="text-xs text-[#94A3B8] text-center">
                  Track up to {FREE_SUBSCRIPTION_LIMIT} active subscriptions.
                </p>
              </div>

              {/* Feature List with Standalone Check Icons */}
              <div className="space-y-4 pt-2">
                <ul className="space-y-3.5 text-sm text-[#94A3B8]">
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-[#14B8A6] shrink-0 mt-0.5" />
                    <span>Track up to {FREE_SUBSCRIPTION_LIMIT} active subscriptions</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-[#14B8A6] shrink-0 mt-0.5" />
                    <span>Provider link, receipt import & manual entry</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-[#14B8A6] shrink-0 mt-0.5" />
                    <span>Renewal & trial date tracking</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-[#14B8A6] shrink-0 mt-0.5" />
                    <span>Basic payment reminders</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-[#14B8A6] shrink-0 mt-0.5" />
                    <span>Basic Smart Insights</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* PLUS PLAN CARD */}
          <div className="p-8 sm:p-10 rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] flex flex-col justify-between space-y-8">
            <div className="space-y-8">
              {/* Top Status Label */}
              <div className="min-h-[24px]">
                {isPlus ? (
                  <span className="text-xs font-semibold text-[#14B8A6] uppercase tracking-wider">
                    Current plan
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                    Recommended
                  </span>
                )}
              </div>

              {/* Plan Name & Price */}
              <div className="space-y-3 border-b border-[#1A1D1D]/80 pb-8">
                <h2 className="text-3xl sm:text-4xl font-bold text-[#F5F7F6]">Plus</h2>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl sm:text-5xl font-extrabold text-[#F5F7F6]">$4.99</span>
                  <span className="text-base text-[#94A3B8]">/month</span>
                </div>
              </div>

              {/* CTA Button placed BEFORE Feature List */}
              <div className="space-y-3">
                {isPlus ? (
                  <button
                    type="button"
                    disabled
                    className="w-full py-4 rounded-xl bg-[#1A1D1D] text-[#94A3B8] text-sm font-semibold cursor-default text-center"
                  >
                    Current plan
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleOpenCheckout}
                    className="w-full py-4 rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-base font-bold transition-opacity cursor-pointer text-center shadow-lg"
                  >
                    Upgrade to Plus
                  </button>
                )}
                <p className="text-xs text-[#94A3B8] text-center">
                  Unlimited subscriptions & advanced management tools.
                </p>
              </div>

              {/* Feature List with Standalone Check Icons */}
              <div className="space-y-4 pt-2">
                <ul className="space-y-3.5 text-sm text-[#94A3B8]">
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-[#14B8A6] shrink-0 mt-0.5" />
                    <span className="text-[#F5F7F6] font-semibold">Unlimited active subscriptions</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-[#14B8A6] shrink-0 mt-0.5" />
                    <span>Advanced reminder controls & alerts</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-[#14B8A6] shrink-0 mt-0.5" />
                    <span>Advanced Smart Insights & metrics</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-[#14B8A6] shrink-0 mt-0.5" />
                    <span>Portfolio data export (CSV/JSON)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-[#14B8A6] shrink-0 mt-0.5" />
                    <span>Family & shared subscription tracking</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Checkout Payment Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-md bg-[#0F1111] border border-[#1A1D1D] rounded-2xl p-6 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200 relative text-[#F5F7F6]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#1A1D1D]">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#F5F7F6]" />
                <h2 className="text-lg font-bold text-[#F5F7F6]">Confirm Subscription</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCheckoutOpen(false)}
                className="text-[#94A3B8] hover:text-[#F5F7F6] p-1 rounded-lg hover:bg-[#1A1D1D] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Plan Summary */}
            <div className="p-4 rounded-xl bg-[#141617] border border-[#232628] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-[#F5F7F6] text-base">SubHalt</h3>
                <p className="text-xs text-[#94A3B8]">Monthly Billing</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-extrabold text-[#F5F7F6]">$4.99</span>
                <span className="text-xs text-[#94A3B8] block">/ month</span>
              </div>
            </div>

            {/* Card Information */}
            <div className="space-y-3">
              <span className="text-xs font-medium text-[#94A3B8] block">Payment Details</span>
              <div className="p-3.5 rounded-xl bg-[#141617] border border-[#232628] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MastercardIcon className="w-8 h-5 shrink-0" />
                  <div>
                    <span className="text-xs font-semibold text-[#F5F7F6] block">Mastercard</span>
                    <span className="text-xs text-[#94A3B8]">•••• 6730</span>
                  </div>
                </div>
                <span className="text-[11px] text-[#94A3B8]">Expires 12/28</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
              <ShieldCheck className="w-4 h-4 text-[#94A3B8] shrink-0" />
              <span>Mock payment processing — no real charge will be made.</span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsCheckoutOpen(false)}
                className="px-4 py-2.5 rounded-full border border-[#232628] bg-[#141617] text-[#94A3B8] hover:text-[#F5F7F6] text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCompletePayment}
                disabled={processing}
                className="px-6 py-2.5 rounded-full bg-[#1A1D1D] hover:bg-[#27272A] border border-[#2D3135] text-[#F5F7F6] text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                {processing && <Loader2 className="w-4 h-4 animate-spin text-[#F5F7F6]" />}
                <span>Pay & Subscribe ($4.99)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlansPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#090A0B] flex items-center justify-center gap-2 text-sm text-[#94A3B8]">
          <Loader2 className="w-5 h-5 animate-spin text-[#14B8A6]" />
          <span>Loading plans...</span>
        </div>
      }
    >
      <PlansContent />
    </Suspense>
  );
}
