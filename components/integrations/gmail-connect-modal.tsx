'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Mail, ShieldCheck, CheckCircle2, ArrowRight, RefreshCw, Check, ArrowLeft, Link2, Link2Off } from 'lucide-react';
import { usePlan, useSettings } from '@/lib/contexts/user-settings-context';
import { useInbox } from '@/lib/contexts/inbox-context';
import { FREE_SUBSCRIPTION_LIMIT } from '@/lib/constants';
import { createSubscription, fetchSubscriptions, filterActiveSubscriptions, getKnownProviderWebsite } from '@/lib/services/subscription-service';
import { mapBillCategoryToSubscriptionCategory } from '@/lib/services/receipt-discovery';
import { useToast } from '@/lib/hooks/use-toast';
import type { DiscoveredSubscription } from '@/lib/types/gmail.types';

interface GmailConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  onSuccess?: () => void;
  onRequireUpgrade?: () => void;
  /** When true (set after a successful OAuth callback redirect) the modal opens straight into a scan. */
  autoScan?: boolean;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  NGN: '₦',
  EUR: '€',
  GBP: '£',
  CAD: 'C$',
  AUD: 'A$',
};

const BILLING_SUFFIX: Record<string, string> = {
  yearly: '/yr',
  weekly: '/wk',
  quarterly: '/qtr',
};

function formatCurrency(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] || `${currency} `;
  return `${symbol}${amount.toFixed(2)}`;
}

type BillingCycle = 'monthly' | 'yearly' | 'weekly' | 'quarterly' | 'custom';

function toBillingCycle(raw: string): BillingCycle {
  if (raw === 'yearly' || raw === 'weekly' || raw === 'quarterly') return raw;
  return 'monthly';
}

export function GmailConnectModal({ isOpen, onClose, onBack, onSuccess, onRequireUpgrade, autoScan }: GmailConnectModalProps) {
  const { isGmailConnected, gmailEmail, setGmailConnection } = useSettings();
  const { isPlus } = usePlan();
  const { addInboxItem } = useInbox();
  const { toast } = useToast();

  const [step, setStep] = useState<'auth' | 'connecting' | 'scanning' | 'results' | 'done'>('auth');
  const [discovered, setDiscovered] = useState<DiscoveredSubscription[]>([]);
  const [selectedDiscovered, setSelectedDiscovered] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const autoScanStarted = React.useRef(false);

  const startScan = useCallback(async () => {
    setError(null);
    setStep('scanning');
    try {
      const res = await fetch('/api/gmail/scan', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Gmail scan failed. Please try again.');
        setStep('auth');
        return;
      }
      const list: DiscoveredSubscription[] = Array.isArray(data.discovered) ? data.discovered : [];
      setDiscovered(list);
      setSelectedDiscovered(list.map((d) => d.providerName));
      setStep('results');
    } catch {
      setError('Gmail scan failed. Please try again.');
      setStep('auth');
    }
  }, []);

  const [prevOpen, setPrevOpen] = useState(isOpen);
  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen);
    if (isOpen) {
      setError(null);
      setStep('auth');
      setDiscovered([]);
      setSelectedDiscovered([]);
      setImporting(false);
      setDisconnecting(false);
    }
  }

  useEffect(() => {
    if (!isOpen) {
      autoScanStarted.current = false;
      return;
    }
    if (autoScan && isGmailConnected && !autoScanStarted.current) {
      autoScanStarted.current = true;
      void startScan();
    }
  }, [isOpen, autoScan, isGmailConnected, startScan]);

  if (!isOpen) return null;

  const handleStartOAuth = async () => {
    setError(null);
    setStep('connecting');
    try {
      const res = await fetch('/api/gmail/auth');
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Failed to start Gmail authorization.');
        setStep('auth');
        return;
      }
      window.location.href = data.url;
    } catch {
      setError('Failed to start Gmail authorization.');
      setStep('auth');
    }
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

    const toImport = discovered.filter((d) => selectedDiscovered.includes(d.providerName));

    for (const item of toImport) {
      const today = new Date();
      const nextMonth = new Date(today);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      await createSubscription({
        name: item.providerName,
        price: item.amount,
        currency: item.currency || 'USD',
        billing_cycle: toBillingCycle(item.billingCycle),
        category: mapBillCategoryToSubscriptionCategory(item.category),
        next_billing_date: nextMonth.toISOString().split('T')[0],
        start_date: today.toISOString().split('T')[0],
        status: 'active',
        provider_url: getKnownProviderWebsite(item.providerName),
        notes: `[Gmail Discovery: Auto-linked from connected Gmail inbox — ${item.from || 'receipt email'}]`,
      });
    }

    setGmailConnection(true, gmailEmail);

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

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch('/api/gmail/disconnect', { method: 'POST' });
      if (!res.ok) {
        setError('Failed to disconnect Gmail.');
        return;
      }
      setGmailConnection(false);
      setDiscovered([]);
      setSelectedDiscovered([]);
      setStep('auth');
      toast.success('Gmail disconnected.', 'Gmail Disconnected');
    } catch {
      setError('Failed to disconnect Gmail.');
    } finally {
      setDisconnecting(false);
    }
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
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Connect Gmail"
        className="w-full max-w-lg bg-[#0B0D0D] border border-[#1A1D1D] rounded-2xl shadow-2xl overflow-hidden"
      >
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
          {error && (
            <div className="p-3 rounded-xl bg-[#D9363E]/10 border border-[#D9363E]/25 text-[#F87171] text-xs leading-relaxed">
              {error}
            </div>
          )}

          {/* Step 1: Authorization info / connected state */}
          {step === 'auth' && !isGmailConnected && (
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
                    You will be redirected to Google to approve access, then returned here to review what we found.
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

          {/* Step 1b: Connected state */}
          {step === 'auth' && isGmailConnected && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-[#F5F7F6]">
                  Gmail Connected
                </h4>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  SubHalt can scan this inbox for subscription receipts.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#0F1414] border border-[#14B8A6]/30 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#14B8A6]/15 border border-[#14B8A6]/30 flex items-center justify-center text-[#14B8A6] shrink-0">
                    <Link2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#F5F7F6] truncate">
                      {gmailEmail || 'Connected Gmail account'}
                    </p>
                    <p className="text-[11px] text-[#94A3B8] flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-[#14B8A6]" />
                      Read-only access
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="px-4 py-2.5 rounded-xl bg-[#1A1D1D] hover:bg-[#2A2224] text-[#F87171] hover:text-[#FCA5A5] text-xs font-medium transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Link2Off className="w-3.5 h-3.5" />
                  {disconnecting ? 'Disconnecting...' : 'Disconnect Gmail'}
                </button>
                <button
                  type="button"
                  onClick={startScan}
                  className="px-4 py-2.5 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#091512] font-semibold text-xs transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Scan receipts again</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-[#1A1D1D] hover:bg-[#262929] text-[#94A3B8] hover:text-[#F5F7F6] text-xs font-medium transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Redirecting / Scanning */}
          {(step === 'connecting' || step === 'scanning') && (
            <div className="py-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-[#14B8A6]/10 border border-[#14B8A6]/30 flex items-center justify-center text-[#14B8A6] mx-auto animate-spin">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-[#F5F7F6]">
                  {step === 'connecting' ? 'Redirecting to Google...' : 'Scanning Gmail Inbox...'}
                </h4>
                <p className="text-xs text-[#94A3B8]">
                  {step === 'connecting'
                    ? 'Approving read-only access to find subscription receipts.'
                    : 'Discovering subscription receipts and active billing confirmations.'}
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Discovered items review */}
          {step === 'results' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-[#F5F7F6]">
                  {discovered.length > 0
                    ? `Discovered Subscriptions (${discovered.length})`
                    : 'No Subscriptions Found'}
                </h4>
                <p className="text-xs text-[#94A3B8]">
                  {discovered.length > 0
                    ? 'Select subscriptions found in your Gmail receipt history to import into SubHalt.'
                    : 'We scanned your inbox for receipts and invoices but did not find any recurring subscriptions. Try adding one manually.'}
                </p>
              </div>

              {discovered.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {discovered.map((item) => {
                    const isSelected = selectedDiscovered.includes(item.providerName);
                    return (
                      <div
                        key={item.providerName}
                        onClick={() => toggleSelect(item.providerName)}
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
                              {item.providerName}
                            </span>
                            <span className="text-[10px] text-[#94A3B8]">
                              Category: {item.category}
                            </span>
                          </div>
                        </div>

                        <span className="text-xs font-semibold text-[#14B8A6]">
                          {formatCurrency(item.amount, item.currency)}
                          {BILLING_SUFFIX[item.billingCycle] || '/mo'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-[#1A1D1D] border border-[#1A1D1D] flex items-center justify-center text-[#94A3B8] mx-auto">
                    <Mail className="w-6 h-6" />
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#091512] font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              )}

              {discovered.length > 0 && (
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
              )}
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
                  SubHalt will now monitor your inbox for new subscription receipts and price changes.
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