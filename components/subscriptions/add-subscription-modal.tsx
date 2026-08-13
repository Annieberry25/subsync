'use client';

import { useState } from 'react';
import { X, Link2, Sparkles, PlusCircle, ArrowRight } from 'lucide-react';
import LinkSubscriptionModal from './link-subscription-modal';
import ReceiptImportModal from './receipt-import-modal';
import type { ExtractedReceiptData } from './receipt-import-modal';
import type { SubscriptionInsert } from '@/lib/services/subscription-service';

interface AddSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectManual: (prefillData?: Partial<Omit<SubscriptionInsert, 'user_id'>>) => void;
}

export default function AddSubscriptionModal({
  isOpen,
  onClose,
  onSelectManual,
}: AddSubscriptionModalProps) {
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  if (!isOpen) return null;

  const handleLinkSuccess = (data: Partial<Omit<SubscriptionInsert, 'user_id'>>) => {
    setIsLinkModalOpen(false);
    onClose();
    onSelectManual(data);
  };

  const handleReceiptConfirm = (extracted: ExtractedReceiptData) => {
    setIsReceiptModalOpen(false);
    onClose();
    
    // Map extracted receipt data to prefill form
    const prefill: Partial<Omit<SubscriptionInsert, 'user_id'>> = {
      name: extracted.name,
      price: extracted.price ? parseFloat(extracted.price) : undefined,
      currency: extracted.currency || 'USD',
      billing_cycle: extracted.billingCycle || 'monthly',
      category: extracted.category || 'Streaming',
      next_billing_date: extracted.nextBillingDate,
      provider_url: extracted.providerUrl,
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
                Choose how you want to add a subscription to SubSync.
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

          {/* Three Path Options Grid */}
          <div className="grid grid-cols-1 gap-3.5">
            {/* Path 1: Link Subscription */}
            <button
              type="button"
              onClick={() => setIsLinkModalOpen(true)}
              className="p-4 sm:p-5 rounded-2xl bg-[#0D0F0F] hover:bg-[#141717] border border-[#1A1D1D] hover:border-[#14B8A6] flex items-start gap-4 transition-all duration-200 text-left group cursor-pointer shadow-sm hover:shadow-md"
            >
              <div className="w-11 h-11 rounded-xl bg-[#14B8A6]/15 border border-[#14B8A6]/30 flex items-center justify-center text-[#14B8A6] shrink-0 group-hover:scale-105 transition-transform">
                <Link2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-[#F5F7F6] group-hover:text-[#14B8A6] transition-colors">
                    Link Subscription
                  </h3>
                  <ArrowRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#14B8A6] group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-xs text-[#94A3B8] leading-relaxed mt-1">
                  Connect a supported provider/account and import available subscription information.
                </p>
              </div>
            </button>

            {/* Path 2: Import Receipt */}
            <button
              type="button"
              onClick={() => setIsReceiptModalOpen(true)}
              className="p-4 sm:p-5 rounded-2xl bg-[#0D0F0F] hover:bg-[#141717] border border-[#1A1D1D] hover:border-[#14B8A6] flex items-start gap-4 transition-all duration-200 text-left group cursor-pointer shadow-sm hover:shadow-md"
            >
              <div className="w-11 h-11 rounded-xl bg-[#F59E0B]/15 border border-[#F59E0B]/30 flex items-center justify-center text-[#F59E0B] shrink-0 group-hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-[#F5F7F6] group-hover:text-[#F59E0B] transition-colors">
                    Import Receipt
                  </h3>
                  <ArrowRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#F59E0B] group-hover:translate-x-1 transition-all" />
                </div>
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
              className="p-4 sm:p-5 rounded-2xl bg-[#0D0F0F] hover:bg-[#141717] border border-[#1A1D1D] hover:border-[#14B8A6] flex items-start gap-4 transition-all duration-200 text-left group cursor-pointer shadow-sm hover:shadow-md"
            >
              <div className="w-11 h-11 rounded-xl bg-[#6366F1]/15 border border-[#6366F1]/30 flex items-center justify-center text-[#6366F1] shrink-0 group-hover:scale-105 transition-transform">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-[#F5F7F6] group-hover:text-[#6366F1] transition-colors">
                    Add Manually
                  </h3>
                  <ArrowRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#6366F1] group-hover:translate-x-1 transition-all" />
                </div>
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
        onClose={() => setIsLinkModalOpen(false)}
        onConfirmLinkedData={handleLinkSuccess}
      />

      <ReceiptImportModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        onConfirm={handleReceiptConfirm}
      />
    </>
  );
}
