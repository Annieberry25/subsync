'use client';

import { useState } from 'react';
import { Check, Loader2, ShieldCheck } from 'lucide-react';
import { FREE_SUBSCRIPTION_LIMIT } from '@/lib/constants';
import { useToast } from '@/lib/hooks/use-toast';
import Sheet from '@/components/ui/sheet';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
}

export default function UpgradeModal({
  isOpen,
  onClose,
  title = `You’ve reached your ${FREE_SUBSCRIPTION_LIMIT}-subscription limit.`,
  description = "Upgrade to Plus to track unlimited subscriptions.",
}: UpgradeModalProps) {
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);

  const handleUpgrade = async () => {
    setProcessing(true);
    try {
      const res = await fetch('/api/paystack/initialize', { method: 'POST' });
      const data = await res.json().catch(() => null);

      // Checked before the authorizationUrl test below: an already-active plan
      // is a success the customer should be told about, not a failed checkout.
      if (data?.alreadyActive) {
        toast.success('Your SubHalt Plus plan is already active.', 'Already Subscribed');
        setProcessing(false);
        onClose();
        return;
      }

      if (!res.ok || !data?.authorizationUrl) {
        throw new Error(data?.error || 'Could not start secure checkout.');
      }

      // Redirect to Paystack's hosted checkout; on success the callback route
      // grants the plan server-side and lands the user back in Settings.
      window.location.assign(data.authorizationUrl);
    } catch (err) {
      setProcessing(false);
      toast.error(
        err instanceof Error ? err.message : 'Failed to start checkout. Please try again.',
        'Upgrade Failed'
      );
    }
  };

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      size="lg"
      title={title}
      description={description}
      footer={
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <a
            href="/plans?from=/settings?section=plan"
            onClick={onClose}
            className="text-xs text-[#94A3B8] hover:text-[#F5F7F6] underline transition-colors text-center sm:text-left min-h-[44px] flex items-center"
          >
            View Plans
          </a>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-3 min-h-[44px] rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] text-[#94A3B8] hover:text-[#F5F7F6] border border-[#1A1D1D] text-xs font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      }
    >
      {/* Plan Comparison Grid - single column on phones so both plans stay
          readable at 320px without horizontal scrolling. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
        {/* Free Plan Card */}
        <div className="p-5 rounded-xl bg-[#0B0D0D] border border-[#1A1D1D] space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-baseline justify-between border-b border-[#1A1D1D] pb-3">
              <div>
                <h3 className="text-base font-semibold text-[#F5F7F6]">Free</h3>
                <p className="text-[11px] text-[#94A3B8] mt-0.5">Track up to {FREE_SUBSCRIPTION_LIMIT} subscriptions</p>
              </div>
              <div className="text-right">
                <span className="text-xl font-bold text-[#F5F7F6]">$0</span>
                <span className="text-xs text-[#94A3B8] font-normal">/mo</span>
              </div>
            </div>

            {/* Action Button BEFORE Feature List */}
            <button
              type="button"
              disabled
              className="w-full py-3 min-h-[44px] rounded-xl bg-[#1A1D1D] text-[#94A3B8] text-xs font-medium cursor-default text-center"
            >
              Current plan
            </button>

            <div className="space-y-2 pt-1">
              <ul className="space-y-2 text-xs text-[#94A3B8]">
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-[#14B8A6] shrink-0 mt-0.5" />
                  <span>Track up to {FREE_SUBSCRIPTION_LIMIT} active subscriptions</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-[#14B8A6] shrink-0 mt-0.5" />
                  <span>Provider link, receipt import & manual entry</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-[#14B8A6] shrink-0 mt-0.5" />
                  <span>Renewal & trial date tracking</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-[#14B8A6] shrink-0 mt-0.5" />
                  <span>Basic payment reminders</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Plus Plan Card */}
        <div className="p-5 rounded-xl bg-[#0B0D0D] border border-[#1A1D1D] space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-baseline justify-between border-b border-[#1A1D1D] pb-3">
              <div>
                <h3 className="text-base font-semibold text-[#F5F7F6]">Plus</h3>
                <p className="text-[11px] text-[#94A3B8] mt-0.5">Unlimited management tools</p>
              </div>
              <div className="text-right">
                <span className="text-xl font-bold text-[#F5F7F6]">$3.99</span>
                <span className="text-xs text-[#94A3B8] font-normal">/mo</span>
              </div>
            </div>

            {/* Action Button BEFORE Feature List */}
            <button
              type="button"
              onClick={handleUpgrade}
              disabled={processing}
              className="w-full py-3 min-h-[44px] rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-semibold transition-opacity cursor-pointer shadow-sm text-center flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {processing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{processing ? 'Redirecting to checkout…' : 'Upgrade to Plus'}</span>
            </button>

            <p className="text-[11px] text-[#94A3B8] flex items-center gap-1.5 justify-center text-center">
              <ShieldCheck className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
              Secure checkout powered by Paystack. $3.99/month.
            </p>

            <div className="space-y-2 pt-1">
              <p className="text-[11px] font-medium text-[#F5F7F6]">Everything in Free, plus:</p>
              <ul className="space-y-2 text-xs text-[#94A3B8]">
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-[#14B8A6] shrink-0 mt-0.5" />
                  <span className="text-[#F5F7F6] font-medium">Unlimited subscriptions</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-[#14B8A6] shrink-0 mt-0.5" />
                  <span>Gmail Connect</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-[#14B8A6] shrink-0 mt-0.5" />
                  <span>Email Forwarding</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-[#14B8A6] shrink-0 mt-0.5" />
                  <span>Advanced reminder controls &amp; alerts</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-[#14B8A6] shrink-0 mt-0.5" />
                  <span>Advanced Smart Insights &amp; metrics</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-[#14B8A6] shrink-0 mt-0.5" />
                  <span>Portfolio data export (CSV/JSON)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-[#14B8A6] shrink-0 mt-0.5" />
                  <span>Family &amp; shared subscription tracking</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
