'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import Sheet from '@/components/ui/sheet';
import { PlusBadge } from '@/components/ui/plus-badge';
import { GmailConnectModal } from '@/components/integrations/gmail-connect-modal';
import { EmailForwardingModal } from '@/components/integrations/email-forwarding-modal';
import LinkSubscriptionModal from './link-subscription-modal';
import ReceiptImportModal, { type ExtractedReceiptData } from './receipt-import-modal';
import { usePlan } from '@/lib/contexts/user-settings-context';
import { hasPlanFeature } from '@/lib/constants/plan-limits';
import type { SubscriptionRow, SubscriptionInsert } from '@/lib/services/subscription-service';

type AddPath = 'gmail' | 'forwarding' | 'link' | 'receipt';

interface AddSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectManual: (
    prefillData?: Partial<Omit<SubscriptionInsert, 'user_id'>>,
    receiptFile?: File | null
  ) => void;
  onSelectExistingDetails?: (subscription: SubscriptionRow) => void;
  existingSubscriptions?: SubscriptionRow[];
  onRequireUpgrade?: () => void;
  /** Opens straight into one of the sub-flows instead of the option menu. */
  initialPath?: AddPath | null;
}

function parsePriceSafely(raw?: string): number | undefined {
  if (!raw) return undefined;
  const match = raw.replace(/[,\s]/g, '').match(/\d+(?:\.\d+)?/);
  return match ? parseFloat(match[0]) : undefined;
}

export default function AddSubscriptionModal({
  isOpen,
  onClose,
  onSelectManual,
  onSelectExistingDetails,
  existingSubscriptions,
  onRequireUpgrade,
  initialPath = null,
}: AddSubscriptionModalProps) {
  const { planTier } = usePlan();
  const [activeSubModal, setActiveSubModal] = useState<'none' | AddPath>('none');
  const [receiptProviderName, setReceiptProviderName] = useState<string | undefined>(undefined);
  const [appliedInitialPath, setAppliedInitialPath] = useState<AddPath | null>(null);

  // Adjusting state during render (rather than in an effect) so the sub-flow
  // opens on the same paint as the modal instead of a second cascading render.
  if (!isOpen) {
    if (appliedInitialPath !== null) setAppliedInitialPath(null);
  } else if (initialPath && initialPath !== appliedInitialPath) {
    setAppliedInitialPath(initialPath);
    setActiveSubModal(initialPath);
  }

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

  const handleReceiptConfirm = (extracted: ExtractedReceiptData, file: File | null) => {
    handleExitAll();

    let notes = '';
    if (extracted.plan) notes += `Plan: ${extracted.plan}\n`;

    const prefill: Partial<Omit<SubscriptionInsert, 'user_id'>> = {
      name: extracted.name,
      price: parsePriceSafely(extracted.price),
      currency: extracted.currency || 'USD',
      billing_cycle: extracted.billingCycle || 'monthly',
      category: extracted.category || 'Streaming',
      next_billing_date: extracted.nextBillingDate || undefined,
      provider_url: extracted.providerUrl,
      notes: notes.trim() || undefined,
    };
    onSelectManual(prefill, file);
  };

  return (
    <>
      <Sheet
        open={isOpen && activeSubModal === 'none'}
        onClose={onClose}
        size="md"
        title="Add Subscription"
        description="Choose how you want to add a subscription to SubHalt."
      >
            {/* Five Options Menu. The Sheet body owns the scroll. */}
            <div className="pt-1 divide-y divide-[#1A1D1D]/50">
              {/* Option 1: Connect Gmail (Plus). A free user sees the "Plus"
                  marker and is sent to upgrade instead of the OAuth flow. */}
              <button
                type="button"
                onClick={() => {
                  if (!hasPlanFeature(planTier, 'gmail')) {
                    onClose();
                    onRequireUpgrade?.();
                    return;
                  }
                  setActiveSubModal('gmail');
                }}
                className="w-full p-3.5 sm:p-4 rounded-xl hover:bg-[#1A1D1D] transition-colors duration-200 text-left group cursor-pointer my-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="text-sm sm:text-base font-semibold text-[#F5F7F6] group-hover:text-[#F5F7F6] transition-colors">
                      Connect Gmail
                    </h3>
                    {!hasPlanFeature(planTier, 'gmail') && <PlusBadge />}
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#F5F7F6] group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-xs text-[#94A3B8] leading-relaxed mt-1">
                  Connect your Gmail account to automatically detect recurring subscription and billing emails.
                </p>
              </button>

              {/* Option 2: Email Forwarding (Plus). */}
              <button
                type="button"
                onClick={() => {
                  if (!hasPlanFeature(planTier, 'emailForwarding')) {
                    onClose();
                    onRequireUpgrade?.();
                    return;
                  }
                  setActiveSubModal('forwarding');
                }}
                className="w-full p-3.5 sm:p-4 rounded-xl hover:bg-[#1A1D1D] transition-colors duration-200 text-left group cursor-pointer my-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="text-sm sm:text-base font-semibold text-[#F5F7F6] group-hover:text-[#F5F7F6] transition-colors">
                      Email Forwarding
                    </h3>
                    {!hasPlanFeature(planTier, 'emailForwarding') && <PlusBadge />}
                  </div>
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
      </Sheet>

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
