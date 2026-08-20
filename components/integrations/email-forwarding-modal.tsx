'use client';

import React, { useState } from 'react';
import { X, Forward, Copy, Check, Info, ArrowRight, CheckCircle2, ArrowLeft } from 'lucide-react';
import { FREE_SUBSCRIPTION_LIMIT } from '@/lib/constants';
import { createSubscription, fetchSubscriptions, filterActiveSubscriptions } from '@/lib/services/subscription-service';
import { useUserSettings } from '@/lib/contexts/user-settings-context';
import { useInbox } from '@/lib/contexts/inbox-context';
import { useToast } from '@/lib/hooks/use-toast';

interface EmailForwardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  onSuccess?: () => void;
  onRequireUpgrade?: () => void;
}

export function EmailForwardingModal({ isOpen, onClose, onBack, onSuccess, onRequireUpgrade }: EmailForwardingModalProps) {
  const { isPlus } = useUserSettings();
  const { addInboxItem } = useInbox();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [simulating, setSimulating] = useState(false);

  const userForwardingAddress = 'receipts+user_8921@subhalt.app';

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(userForwardingAddress);
    setCopied(true);
    toast.success('Forwarding address copied to clipboard.', 'Copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSimulateForwardedReceipt = async () => {
    setSimulating(true);

    const { data: currentData } = await fetchSubscriptions();
    const activeCount = currentData ? filterActiveSubscriptions(currentData).length : 0;

    if (!isPlus && activeCount >= FREE_SUBSCRIPTION_LIMIT) {
      setSimulating(false);
      onClose();
      if (onRequireUpgrade) {
        onRequireUpgrade();
      }
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { error } = await createSubscription({
      name: 'Notion Team Plan',
      price: 10.0,
      currency: 'USD',
      billing_cycle: 'monthly',
      category: 'Software',
      next_billing_date: nextMonth,
      start_date: today,
      status: 'active',
      notes: '[Email Forwarding: Received forwarded receipt from user_8921@subhalt.app]',
    });

    setSimulating(false);

    if (error) {
      toast.error('Simulation failed.', 'Error');
    } else {
      addInboxItem({
        type: 'plan_update',
        title: 'Forwarded Receipt Processed',
        description: 'SubHalt received and extracted "Notion Team Plan" ($10.00/mo) from your forwarded email.',
        subscriptionName: 'Notion Team Plan',
        subscriptionPrice: 10.0,
        currency: 'USD',
        actionType: 'view',
        actionLabel: 'View Subscription',
      });

      toast.success('Forwarded receipt extracted and saved!', 'Receipt Processed');
      onSuccess?.();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-[#0B0D0D] border border-[#1A1D1D] rounded-2xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#1A1D1D] flex items-center justify-between bg-[#000000]">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label="Back to Add Subscription menu"
                className="w-8 h-8 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] flex items-center justify-center text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer border border-[#1A1D1D] shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-8 h-8 rounded-xl bg-[#14B8A6]/10 border border-[#14B8A6]/30 flex items-center justify-center text-[#14B8A6] shrink-0">
              <Forward className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#F5F7F6] tracking-tight">
                Receipt Email Forwarding
              </h3>
              <p className="text-[11px] text-[#94A3B8]">
                Manual Receipt Forwarding Address
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal completely"
            className="w-8 h-8 rounded-xl text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] transition-colors flex items-center justify-center cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* Distinction Callout Banner */}
          <div className="p-4 rounded-xl bg-[#121414] border border-[#14B8A6]/30 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-xs text-[#F5F7F6]">
              <Info className="w-4 h-4 text-[#14B8A6] shrink-0" />
              <span>Connect Gmail ≠ Email Forwarding</span>
            </div>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              <strong className="text-[#F5F7F6]">Connect Gmail</strong> lets SubHalt discover relevant billing emails through authorized access.
              <br />
              <strong className="text-[#F5F7F6]">Email Forwarding</strong> allows you to manually forward any receipt or invoice to your custom SubHalt receiving address.
            </p>
          </div>

          {/* Forwarding Address Box */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#F5F7F6] block">
              Your Personal SubHalt Receiving Address:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={userForwardingAddress}
                className="flex-1 bg-[#121414] border border-[#1A1D1D] rounded-xl px-3.5 py-2.5 text-xs text-[#14B8A6] font-mono select-all focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-2.5 rounded-xl bg-[#1A1D1D] hover:bg-[#262929] text-[#F5F7F6] border border-[#3F3F46]/40 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#14B8A6]" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Test simulation button */}
          <div className="p-4 rounded-xl bg-[#0F1111] border border-[#1A1D1D] flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-[#F5F7F6] block">
                Test Forwarding Flow
              </span>
              <span className="text-[11px] text-[#94A3B8]">
                Simulate sending a receipt for "Notion Team Plan"
              </span>
            </div>
            <button
              type="button"
              onClick={handleSimulateForwardedReceipt}
              disabled={simulating}
              className="px-3.5 py-2 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#091512] text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {simulating ? <span>Processing...</span> : <span>Send Test Receipt</span>}
            </button>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="px-4 py-2.5 rounded-xl bg-[#1A1D1D] hover:bg-[#262929] text-[#94A3B8] hover:text-[#F5F7F6] text-xs font-medium transition-colors cursor-pointer"
              >
                ← Back
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-[#1A1D1D] hover:bg-[#262929] text-[#F5F7F6] text-xs font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
