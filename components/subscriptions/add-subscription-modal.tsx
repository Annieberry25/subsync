'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import LinkSubscriptionModal from './link-subscription-modal';
import ReceiptImportModal from './receipt-import-modal';
import type { ExtractedReceiptData } from './receipt-import-modal';
import type { SubscriptionRow, SubscriptionInsert } from '@/lib/services/subscription-service';

interface AddSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectManual: (prefillData?: Partial<Omit<SubscriptionInsert, 'user_id'>>) => void;
  onSelectExistingDetails?: (subscription: SubscriptionRow) => void;
  existingSubscriptions?: SubscriptionRow[];
}

export default function AddSubscriptionModal({
  isOpen,
  onClose,
  onSelectManual,
  onSelectExistingDetails,
  existingSubscriptions,
}: AddSubscriptionModalProps) {
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptProviderName, setReceiptProviderName] = useState<string | undefined>(undefined);

  if (!isOpen) return null;

  const handleExitAll = () => {
    setIsLinkModalOpen(false);
    setIsReceiptModalOpen(false);
    setReceiptProviderName(undefined);
    onClose();
  };

  const handleCancelReceipt = () => {
    setIsReceiptModalOpen(false);
    if (receiptProviderName) {
      setIsLinkModalOpen(true);
    }
  };

  const handleStartReceiptFromProvider = (providerName: string) => {
    setIsLinkModalOpen(false);
    setReceiptProviderName(providerName);
    setIsReceiptModalOpen(true);
  };

  const handleLinkSuccess = (data: Partial<Omit<SubscriptionInsert, 'user_id'>>) => {
    setIsLinkModalOpen(false);
    onClose();
    onSelectManual(data);
  };

  const handleReceiptConfirm = (extracted: ExtractedReceiptData) => {
    setIsReceiptModalOpen(false);
    onClose();
    
    // Map extracted receipt data to prefill form
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
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-sub-title"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-xl bg-[#0F1111] border border-[#1A1D1D] rounded-2xl sm:rounded-3xl p-5 sm:p-7 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#1A1D1D] pb-4">
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

          {/* Three Path Options Grid (Restored Commit 65d8026 exact UI) */}
          <div className="grid grid-cols-1 gap-3.5">
            {/* Path 1: Link Subscription / Subscribe through Provider */}
            <button
              type="button"
              onClick={() => {
                setReceiptProviderName(undefined);
                setIsLinkModalOpen(true);
              }}
              className="p-4 sm:p-5 rounded-2xl bg-[#0D0F0F] hover:bg-[#141717] border border-[#1A1D1D] hover:border-[#14B8A6] transition-all duration-200 text-left group cursor-pointer shadow-sm hover:shadow-md"
            >
              <div className="w-full min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-[#F5F7F6] group-hover:text-[#14B8A6] transition-colors">
                  Subscribe through Provider
                </h3>
                <p className="text-xs text-[#94A3B8] leading-relaxed mt-1">
                  Connect a supported provider/account and import available subscription information.
                </p>
              </div>
            </button>

            {/* Path 2: Import Receipt */}
            <button
              type="button"
              onClick={() => {
                setReceiptProviderName(undefined);
                setIsReceiptModalOpen(true);
              }}
              className="p-4 sm:p-5 rounded-2xl bg-[#0D0F0F] hover:bg-[#141717] border border-[#1A1D1D] hover:border-[#14B8A6] transition-all duration-200 text-left group cursor-pointer shadow-sm hover:shadow-md"
            >
              <div className="w-full min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-[#F5F7F6] group-hover:text-[#14B8A6] transition-colors">
                  Import Receipt
                </h3>
                <p className="text-xs text-[#94A3B8] leading-relaxed mt-1">
                  Upload a receipt, screenshot, PDF, or paste a subscription confirmation/receipt.
                </p>
              </div>
            </button>

            {/* Path 3: Add Manually */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onSelectManual();
              }}
              className="p-4 sm:p-5 rounded-2xl bg-[#0D0F0F] hover:bg-[#141717] border border-[#1A1D1D] hover:border-[#14B8A6] transition-all duration-200 text-left group cursor-pointer shadow-sm hover:shadow-md"
            >
              <div className="w-full min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-[#F5F7F6] group-hover:text-[#14B8A6] transition-colors">
                  Add Manually
                </h3>
                <p className="text-xs text-[#94A3B8] leading-relaxed mt-1">
                  Enter the subscription information yourself.
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Nested Flow Modals */}
      <LinkSubscriptionModal
        isOpen={isLinkModalOpen}
        onClose={handleExitAll}
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
        isOpen={isReceiptModalOpen}
        onClose={handleExitAll}
        onCancel={handleCancelReceipt}
        onConfirm={handleReceiptConfirm}
        initialProviderName={receiptProviderName}
      />
    </>
  );
}
