'use client';

import React, { useState } from 'react';
import { X, Mail, ShieldCheck, CheckCircle2, ArrowRight, RefreshCw, Check, ArrowLeft } from 'lucide-react';
import { useUserSettings } from '@/lib/contexts/user-settings-context';
import { useInbox } from '@/lib/contexts/inbox-context';
import { FREE_SUBSCRIPTION_LIMIT } from '@/lib/constants';
import { createSubscription, fetchSubscriptions, filterActiveSubscriptions, type SubscriptionRow } from '@/lib/services/subscription-service';
import { useToast } from '@/lib/hooks/use-toast';

interface GmailConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  onSuccess?: () => void;
  onRequireUpgrade?: () => void;
}

const MOCK_DISCOVERED_SUBS = [
  { name: 'Figma Pro', price: 15.0, currency: 'USD', billing_cycle: 'monthly', category: 'Software', provider_url: 'https://www.figma.com' },
  { name: 'ChatGPT Plus', price: 20.0, currency: 'USD', billing_cycle: 'monthly', category: 'Software', provider_url: 'https://chatgpt.com' },
  { name: 'Adobe Creative Cloud', price: 54.99, currency: 'USD', billing_cycle: 'monthly', category: 'Software', provider_url: 'https://www.adobe.com' },
  { name: 'YouTube Premium', price: 13.99, currency: 'USD', billing_cycle: 'monthly', category: 'Streaming', provider_url: 'https://www.youtube.com' },
];

export function GmailConnectModal({ isOpen, onClose, onBack, onSuccess, onRequireUpgrade }: GmailConnectModalProps) {
  const { isGmailConnected, setIsGmailConnected, isPlus } = useUserSettings();
  const { addInboxItem } = useInbox();
  const { toast } = useToast();

  const [step, setStep] = useState<'auth' | 'scanning' | 'results' | 'done'>('auth');
  const [selectedDiscovered, setSelectedDiscovered] = useState<string[]>(
    MOCK_DISCOVERED_SUBS.map((s) => s.name)
  );
  const [importing, setImporting] = useState(false);

  if (!isOpen) return null;

  const handleStartOAuth = () => {
    setStep('scanning');
    setTimeout(() => {
      setStep('results');
    }, 1800);
  };

  const handleImportSelected = async () => {
    setImporting(true);

    const { data: currentData } = await fetchSubscriptions();
    const activeCount = currentData ? filterActiveSubscriptions(currentData).length : 0;

    if (!isPlus && activeCount >= FREE_SUBSCRIPTION_LIMIT) {
      setImporting(false);
      onClose();
      if (onRequireUpgrade) {
        onRequireUpgrade();
      }
      return;
    }

    const toImport = MOCK_DISCOVERED_SUBS.filter((s) => selectedDiscovered.includes(s.name));

    for (const item of toImport) {
      const today = new Date();
      const nextMonth = new Date(today);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      await createSubscription({
        name: item.name,
        price: item.price,
        currency: item.currency,
        billing_cycle: item.billing_cycle as any,
        category: item.category as any,
        next_billing_date: nextMonth.toISOString().split('T')[0],
        start_date: today.toISOString().split('T')[0],
        status: 'active',
        provider_url: item.provider_url,
        notes: '[Gmail Discovery: Auto-linked from connected Gmail inbox]',
      });
    }

    setIsGmailConnected(true);

    addInboxItem({
      type: 'plan_update',
      title: 'Gmail Discovery Complete',
      description: `Successfully discovered and imported ${toImport.length} subscriptions from connected Gmail account.`,
      actionType: 'view',
      actionLabel: 'View Subscriptions',
    });

    toast.success(`Imported ${toImport.length} subscriptions from Gmail.`, 'Gmail Connected');
    setImporting(false);
    setStep('done');
    onSuccess?.();
  };

  const toggleSelect = (name: string) => {
    if (selectedDiscovered.includes(name)) {
      setSelectedDiscovered(selectedDiscovered.filter((n) => n !== name));
    } else {
      setSelectedDiscovered([...selectedDiscovered, name]);
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
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#F5F7F6] tracking-tight">
                Connect Gmail
              </h3>
              <p className="text-[11px] text-[#94A3B8]">
                Automatic Email Receipt Discovery
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
          {/* Step 1: Authorization info */}
          {step === 'auth' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-[#F5F7F6]">
                  Connect Gmail
                </h4>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  “Let SubHalt find subscription receipts and billing emails automatically.”
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#121414] border border-[#1A1D1D] space-y-3">
                <div className="flex items-start gap-2.5 text-xs text-[#94A3B8]">
                  <ShieldCheck className="w-4 h-4 text-[#14B8A6] shrink-0 mt-0.5" />
                  <span>
                    SubHalt uses read-only authorization strictly to locate subscription receipts and invoices. Your private messages remain private.
                  </span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-[#94A3B8]">
                  <CheckCircle2 className="w-4 h-4 text-[#14B8A6] shrink-0 mt-0.5" />
                  <span>
                    No manual forwarding required once authorized. SubHalt runs background checks automatically.
                  </span>
                </div>
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
                  className="px-4 py-2.5 rounded-xl bg-[#1A1D1D] hover:bg-[#262929] text-[#94A3B8] hover:text-[#F5F7F6] text-xs font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStartOAuth}
                  className="px-4 py-2.5 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#091512] font-semibold text-xs transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <span>Authorize Google Account</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Scanning */}
          {step === 'scanning' && (
            <div className="py-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-[#14B8A6]/10 border border-[#14B8A6]/30 flex items-center justify-center text-[#14B8A6] mx-auto animate-spin">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-[#F5F7F6]">
                  Scanning Gmail Inbox...
                </h4>
                <p className="text-xs text-[#94A3B8]">
                  Discovering subscription receipts and active billing confirmations.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Discovered items review */}
          {step === 'results' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-[#F5F7F6]">
                  Discovered Subscriptions ({MOCK_DISCOVERED_SUBS.length})
                </h4>
                <p className="text-xs text-[#94A3B8]">
                  Select subscriptions found in your Gmail receipt history to import into SubHalt.
                </p>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {MOCK_DISCOVERED_SUBS.map((item) => {
                  const isSelected = selectedDiscovered.includes(item.name);
                  return (
                    <div
                      key={item.name}
                      onClick={() => toggleSelect(item.name)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-[#121414] border-[#14B8A6]/60 text-[#F5F7F6]'
                          : 'bg-[#0F1111] border-[#1A1D1D] text-[#94A3B8]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                            isSelected
                              ? 'bg-[#14B8A6] border-[#14B8A6] text-[#091512]'
                              : 'border-[#3F3F46]'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-[#F5F7F6] block">
                            {item.name}
                          </span>
                          <span className="text-[10px] text-[#94A3B8]">
                            Category: {item.category}
                          </span>
                        </div>
                      </div>

                      <span className="text-xs font-semibold text-[#14B8A6]">
                        ${item.price.toFixed(2)}/mo
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-[#1A1D1D] hover:bg-[#262929] text-[#94A3B8] hover:text-[#F5F7F6] text-xs font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleImportSelected}
                  disabled={importing || selectedDiscovered.length === 0}
                  className="px-4 py-2.5 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] disabled:opacity-40 text-[#091512] font-semibold text-xs transition-colors flex items-center gap-2 cursor-pointer"
                >
                  {importing ? (
                    <span>Importing...</span>
                  ) : (
                    <span>Import {selectedDiscovered.length} Subscriptions</span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 'done' && (
            <div className="py-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-[#14B8A6]/10 border border-[#14B8A6]/30 flex items-center justify-center text-[#14B8A6] mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-[#F5F7F6]">
                  Gmail Connected Successfully
                </h4>
                <p className="text-xs text-[#94A3B8]">
                  SubHalt will now automatically monitor your inbox for new subscription receipts and price changes.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#091512] font-semibold text-xs transition-colors cursor-pointer"
              >
                Return to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
