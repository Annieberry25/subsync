'use client';

import { useState } from 'react';
import { X, Mail, Forward, Link2, Sparkles, PlusCircle, ArrowRight } from 'lucide-react';
import { GmailConnectModal } from '@/components/integrations/gmail-connect-modal';
import { EmailForwardingModal } from '@/components/integrations/email-forwarding-modal';
import LinkSubscriptionModal from './link-subscription-modal';
import ReceiptImportModal, { type ExtractedReceiptData } from './receipt-import-modal';
import type { SubscriptionRow, SubscriptionInsert } from '@/lib/services/subscription-service';

interface AddSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectManual: (prefillData?: Partial<Omit<SubscriptionInsert, 'user_id'>>) => void;
  onSelectExistingDetails?: (subscription: SubscriptionRow) => void;
  existingSubscriptions?: SubscriptionRow[];
  onRequireUpgrade?: () => void;
}

export default function AddSubscriptionModal({
  isOpen,
  onClose,
  onSelectManual,
  onSelectExistingDetails,
  existingSubscriptions,
  onRequireUpgrade,
}: AddSubscriptionModalProps) {
  const [activeSubModal, setActiveSubModal] = useState<
    'none' | 'gmail' | 'forwarding' | 'link' | 'receipt'
  >('none');
  const [receiptProviderName, setReceiptProviderName] = useState<string | undefined>(undefined);

  if (!isOpen && activeSubModal === 'none') return null;

  const handleExitAll = () => {
    setActiveSubModal('none');
    setReceiptProviderName(undefined);
    onClose();
  };

  const handleBackToMenu = () => {
    setActiveSubModal('none');
    setReceiptProviderName(undefined);
  };

  const handleCancelReceipt = () => {
    if (receiptProviderName) {
      setActiveSubModal('link');
    } else {
      handleBackToMenu();
    }
  };

  const handleStartReceiptFromProvider = (providerName: string) => {
    setReceiptProviderName(providerName);
    setActiveSubModal('receipt');
  };

  const handleLinkSuccess = (data: Partial<Omit<SubscriptionInsert, 'user_id'>>) => {
    handleExitAll();
    onSelectManual(data);
  };

  const handleReceiptConfirm = (extracted: ExtractedReceiptData) => {
    handleExitAll();

    let notes = '';
    if (extracted.plan) notes += `Plan: ${extracted.plan}\n`;
    if (extracted.trialEndDate) notes += `Trial End Date: ${extracted.trialEndDate}\n`;

    const prefill: Partial<Omit<SubscriptionInsert, 'user_id'>> = {
      name: extracted.name,
      price: extracted.price ? parseFloat(extracted.price) : undefined,
      currency: extracted.currency || 'USD',
      billing_cycle: extracted.billingCycle || 'monthly',
      category: extracted.category || 'Streaming',
      next_billing_date: extracted.nextBillingDate,
      provider_url: extracted.providerUrl,
      notes: notes.trim() || undefined,
    };
    onSelectManual(prefill);
  };

  return (
    <>
      {isOpen && activeSubModal === 'none' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-sub-title"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-[#0F1111] border border-[#1A1D1D] rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh] sm:max-h-[80vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#1A1D1D] pb-4 shrink-0 mb-2">
              <div>
                <h2 id="add-sub-title" className="text-xl sm:text-2xl font-bold text-[#F5F7F6] tracking-tight">
                  Add Subscription
                </h2>
                <p className="text-xs sm:text-sm text-[#94A3B8] mt-0.5">
                  Choose how you want to add a subscription to SubHalt.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="w-9 h-9 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] flex items-center justify-center text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer border border-[#1A1D1D]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Five Options Menu (Vertically Scrollable Text-Based Menu) */}
            <div className="overflow-y-auto pr-1.5 sm:pr-2.5 flex-1 custom-scrollbar divide-y divide-[#1A1D1D]/50">
              {/* Option 1: Connect Gmail */}
              <button
                type="button"
                onClick={() => setActiveSubModal('gmail')}
                className="w-full p-3.5 sm:p-4 rounded-xl hover:bg-[#1A1D1D] transition-colors duration-200 text-left group cursor-pointer my-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm sm:text-base font-semibold text-[#F5F7F6] group-hover:text-[#F5F7F6] transition-colors">
                    Connect Gmail
                  </h3>
                  <ArrowRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#F5F7F6] group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-xs text-[#94A3B8] leading-relaxed mt-1">
                  Connect your Gmail account to automatically detect recurring subscription and billing emails.
                </p>
              </button>

              {/* Option 2: Email Forwarding */}
              <button
                type="button"
                onClick={() => setActiveSubModal('forwarding')}
                className="w-full p-3.5 sm:p-4 rounded-xl hover:bg-[#1A1D1D] transition-colors duration-200 text-left group cursor-pointer my-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm sm:text-base font-semibold text-[#F5F7F6] group-hover:text-[#F5F7F6] transition-colors">
                    Email Forwarding
                  </h3>
                  <ArrowRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#F5F7F6] group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-xs text-[#94A3B8] leading-relaxed mt-1">
                  View your personal SubHalt auto-import email address to forward billing receipts.
                </p>
              </button>

              {/* Option 3: Subscribe through Provider */}
              <button
                type="button"
                onClick={() => {
                  setReceiptProviderName(undefined);
                  setActiveSubModal('link');
                }}
                className="w-full p-3.5 sm:p-4 rounded-xl hover:bg-[#1A1D1D] transition-colors duration-200 text-left group cursor-pointer my-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm sm:text-base font-semibold text-[#F5F7F6] group-hover:text-[#F5F7F6] transition-colors">
                    Subscribe through Provider
                  </h3>
                  <ArrowRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#F5F7F6] group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-xs text-[#94A3B8] leading-relaxed mt-1">
                  Subscribe through the provider page, then confirm the subscription with the receipt or details.
                </p>
              </button>

              {/* Option 4: Import Receipt */}
              <button
                type="button"
                onClick={() => {
                  setReceiptProviderName(undefined);
                  setActiveSubModal('receipt');
                }}
                className="w-full p-3.5 sm:p-4 rounded-xl hover:bg-[#1A1D1D] transition-colors duration-200 text-left group cursor-pointer my-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm sm:text-base font-semibold text-[#F5F7F6] group-hover:text-[#F5F7F6] transition-colors">
                    Import Receipt
                  </h3>
                  <ArrowRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#F5F7F6] group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-xs text-[#94A3B8] leading-relaxed mt-1">
                  Upload a receipt, screenshot, PDF, or paste subscription confirmation/receipt text.
                </p>
              </button>

              {/* Option 5: Add Manually */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSelectManual();
                }}
                className="w-full p-3.5 sm:p-4 rounded-xl hover:bg-[#1A1D1D] transition-colors duration-200 text-left group cursor-pointer my-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm sm:text-base font-semibold text-[#F5F7F6] group-hover:text-[#F5F7F6] transition-colors">
                    Add Manually
                  </h3>
                  <ArrowRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#F5F7F6] group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-xs text-[#94A3B8] leading-relaxed mt-1">
                  Enter subscription name, price, billing cycle, renewal date, etc.
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-flow Modals */}
      <GmailConnectModal
        isOpen={activeSubModal === 'gmail'}
        onClose={handleExitAll}
        onBack={handleBackToMenu}
        onRequireUpgrade={() => {
          handleExitAll();
          onRequireUpgrade?.();
        }}
      />

      <EmailForwardingModal
        isOpen={activeSubModal === 'forwarding'}
        onClose={handleExitAll}
        onBack={handleBackToMenu}
        onRequireUpgrade={() => {
          handleExitAll();
          onRequireUpgrade?.();
        }}
      />

      <LinkSubscriptionModal
        isOpen={activeSubModal === 'link'}
        onClose={handleExitAll}
        onBack={handleBackToMenu}
        onSelectReceiptFlow={handleStartReceiptFromProvider}
        onConfirmLinkedData={handleLinkSuccess}
        onSelectExistingDetails={(sub) => {
          handleExitAll();
          if (onSelectExistingDetails) {
            onSelectExistingDetails(sub);
          }
        }}
        existingSubscriptions={existingSubscriptions}
      />

      <ReceiptImportModal
        isOpen={activeSubModal === 'receipt'}
        onClose={handleExitAll}
        onBack={handleBackToMenu}
        onCancel={handleCancelReceipt}
        onConfirm={handleReceiptConfirm}
        initialProviderName={receiptProviderName}
      />
    </>
  );
}
