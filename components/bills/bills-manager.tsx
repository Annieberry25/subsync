'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Receipt, 
  AlertCircle,
} from 'lucide-react';
import Sheet from '@/components/ui/sheet';
import type { BillPayment, ExtractedBillReceiptData } from '@/lib/types/bills.types';
import type { ReceiptExtraction } from '@/lib/services/receipt-parser';
import { storeReceiptFile, attachReceiptMetadata } from '@/lib/services/receipt-storage';
import { logger } from '@/lib/logger';
import {
  fetchBillPayments,
  createBillPayment,
  updateBillPayment,
  deleteBillPayment,
  calculateBillSpendingSummary,
  toBillPaymentInsert,
} from '@/lib/services/bills-service';
import { usePlan, useCurrency } from '@/lib/contexts/user-settings-context';
import { getPlanLimits } from '@/lib/constants/plan-limits';
import { useToast } from '@/lib/hooks/use-toast';
import { CompactMonthlySummaryCard, BillAnalyticsInsights } from './bill-spending-summary';
import BillHistoryTable from './bill-history-table';
import BillModal from './bill-modal';
import ReceiptScanModal from './receipt-scan-modal';
import BillDetailModal from './bill-detail-modal';
import PayABillFlow from './pay-a-bill-flow';
import { AdBanner } from '@/components/dashboard/ad-banner';

interface BillsManagerProps {
  initialTab?: 'pay' | 'history';
}

export default function BillsManager({ initialTab = 'pay' }: BillsManagerProps) {
  const { planTier } = usePlan();
  const { defaultCurrency, exchangeRates } = useCurrency();
  const { toast } = useToast();
  const pathname = usePathname();

  // Determine active tab cleanly from route: '/bills/history' -> 'history', else -> 'pay'
  const activeTab = useMemo(() => {
    if (pathname.startsWith('/bills/history')) return 'history';
    return initialTab;
  }, [pathname, initialTab]);

  // Data states
  const [bills, setBills] = useState<BillPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllPayments, setShowAllPayments] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [visibleCountBills, setVisibleCountBills] = useState(20);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<BillPayment | null>(null);
  const [editingBill, setEditingBill] = useState<BillPayment | null>(null);
  const [prefillPaymentData, setPrefillPaymentData] = useState<{
    providerName?: string;
    category?: string;
    country?: string;
    amount?: number;
    currency?: string;
    officialUrl?: string;
  } | null>(null);

  const [showLimitWarning, setShowLimitWarning] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // planTier is already the effective tier (usePlan resolves admin to it), so the
  // bill cap is lifted for admins here without a second is_admin read.
  const limits = useMemo(() => getPlanLimits(planTier), [planTier]);

  const loadData = useCallback(async () => {
    const billsRes = await fetchBillPayments();
    if (billsRes.data) setBills(billsRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => loadData());

    const handleUpdate = () => loadData();
    window.addEventListener('subhalt_bills_updated', handleUpdate);
    return () => {
      window.removeEventListener('subhalt_bills_updated', handleUpdate);
    };
  }, [loadData]);

  const summary = useMemo(() => {
    return calculateBillSpendingSummary(bills, defaultCurrency, exchangeRates);
  }, [bills, defaultCurrency, exchangeRates]);

  const paginatedBills = useMemo(() => bills.slice(0, visibleCountBills), [bills, visibleCountBills]);
  const hasMoreBills = bills.length > visibleCountBills;

  const handleOpenAddManual = (prefill?: typeof prefillPaymentData) => {
    if (bills.length >= limits.maxBills) {
      setShowLimitWarning(true);
      return;
    }
    setEditingBill(null);
    setPrefillPaymentData(prefill || null);
    setIsAddModalOpen(true);
  };

  const handleOpenScan = () => {
    if (bills.length >= limits.maxBills) {
      setShowLimitWarning(true);
      return;
    }
    setIsScanModalOpen(true);
  };

  const handleSaveBill = async (billData: Partial<BillPayment>) => {
    if (editingBill) {
      const { error, synced } = await updateBillPayment(editingBill.id, billData);
      if (error) {
        toast.error(error.message, 'Error updating bill');
      } else if (synced) {
        toast.success('Bill updated successfully', 'Payment Saved');
      } else {
        toast.warning('Saved on this device only — it will sync when you are back online.', 'Offline Save');
      }
      loadData();
    } else {
      const { error, synced } = await createBillPayment(toBillPaymentInsert(billData));
      if (error) {
        toast.error(error.message, 'Error saving bill');
      } else if (synced) {
        toast.success('Payment recorded successfully', 'Payment Saved');
      } else {
        toast.warning('Added on this device only — it will sync when you are back online.', 'Offline Save');
      }
      loadData();
    }
  };

  const handleConfirmScan = async (
    extracted: ExtractedBillReceiptData,
    file: File | null,
    extraction: ReceiptExtraction | null
  ) => {
    const { data: bill, error, synced } = await createBillPayment({
      category: extracted.category || 'Utilities',
      custom_category: extracted.customCategory || null,
      provider_name: extracted.providerName,
      amount: extracted.amount,
      currency: extracted.currency || 'NGN',
      payment_date: extracted.paymentDate,
      payment_frequency: extracted.paymentFrequency || null,
      source: 'receipt_scan',
      provider_reference: extracted.providerReference || null,
      region: extracted.region || null,
      receipts: [],
      status: 'paid',
    });

    if (error) {
      toast.error(error.message, 'Error saving receipt payment');
      loadData();
      return;
    }

    if (!synced) {
      toast.warning(
        'Receipt saved on this device only — the file will upload when you are back online.',
        'Offline Save'
      );
      loadData();
      return;
    }

    if (file && bill) {
      const stored = await storeReceiptFile({
        file,
        parent: { kind: 'bill', billPaymentId: bill.id },
        extraction,
      });
      if (stored.error) {
        toast.warning(
          'Payment saved, but the receipt file could not be attached.',
          'File Not Attached'
        );
      } else if (stored.data) {
        const attachError = await attachReceiptMetadata(bill.id, stored.data, {
          amount: extracted.amount,
          currency: extracted.currency || 'NGN',
          provider: extracted.providerName,
        });
        if (attachError) {
          logger.warn('[bills-manager] receipt metadata not attached', {
            message: attachError.message,
          });
        }
      }
    }

    toast.success('Receipt scanned & payment saved successfully', 'Receipt Processed');
    loadData();
  };

  const handleDeleteBill = async (id: string) => {
    setDeletingId(id);
    const { error } = await deleteBillPayment(id);
    if (error) {
      toast.error(error.message, 'Error deleting record');
    } else {
      toast.success('Payment record deleted', 'Record Removed');
      loadData();
    }
    setDeletingId(null);
  };

  return (
    <div className="min-h-screen bg-[#000000] text-[#F5F7F6] p-3.5 sm:p-6 lg:p-8 space-y-5 max-w-5xl mx-auto pb-20">
      
      {/* 1. Header Section */}
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#F5F7F6] flex items-center gap-2">
          <Receipt className="w-5 h-5 text-[#F5F7F6]" />
          <span>{activeTab === 'history' ? 'Payment History' : 'Bills & Payments'}</span>
        </h1>
        <p className="text-xs sm:text-sm text-[#94A3B8]">
          {activeTab === 'history'
            ? 'Review your past bill and payment transactions.'
            : 'Keep your bills and everyday payments organized.'}
        </p>
      </div>

      {/* 2. SUBMENU PAGE CONTENT */}
      {activeTab === 'pay' ? (
        /* SUBMENU PAGE 1: PAY A BILL (CLEAN & FOCUSED ON MAKING A PAYMENT) */
        <PayABillFlow
          onOpenScanReceipt={handleOpenScan}
          onOpenManualAdd={(prefill) => handleOpenAddManual(prefill)}
        />
      ) : (
        /* SUBMENU PAGE 2: PAYMENT HISTORY (TRANSACTION RECORDS + INSIGHTS & ANALYTICS BELOW) */
        <div className="space-y-6">
          {/* 1. Small Total This Month Summary */}
          <CompactMonthlySummaryCard summary={summary} />

          {/* 2. Search, Filters, & Chronological Payment History List */}
          <BillHistoryTable
            bills={paginatedBills}
            onSelectBill={(b) => {
              setSelectedBill(b);
              setIsDetailModalOpen(true);
            }}
            onEditBill={(b) => {
              setEditingBill(b);
              setIsAddModalOpen(true);
            }}
            onDeleteBill={handleDeleteBill}
            deletingId={deletingId}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
          {hasMoreBills && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setVisibleCountBills((c) => c + 20)}
                className="px-6 py-2.5 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] text-[#94A3B8] hover:text-[#F5F7F6] text-xs font-semibold border border-[#161F1D] cursor-pointer transition-colors"
              >
                Load More
              </button>
            </div>
          )}

          {/* 3. Insights & Analytics (Positioned BELOW payment history records) */}
          <BillAnalyticsInsights
            summary={summary}
            onFilterCategory={(cat) => {
              setSelectedCategory(cat);
              setVisibleCountBills(bills.length);
            }}
          />

          {/* 4. SPONSOR ADVERTISEMENT (Bottom of payment history, never on the pay tab) */}
          {!loading && bills.length > 0 && <AdBanner planTier={planTier} />}
        </div>
      )}

      {/* Add / Edit Bill Modal */}
      <BillModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingBill(null);
          setPrefillPaymentData(null);
        }}
        onSave={handleSaveBill}
        initialData={editingBill}
        prefillData={prefillPaymentData}
      />

      {/* Receipt Upload Scan Modal */}
      <ReceiptScanModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        onConfirm={handleConfirmScan}
      />

      {/* Detail Modal */}
      <BillDetailModal
        bill={selectedBill}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedBill(null);
        }}
        onEdit={(b) => {
          setEditingBill(b);
          setIsAddModalOpen(true);
        }}
        onDelete={handleDeleteBill}
        deletingId={deletingId}
      />

      {/* Free Plan Limit Reached Warning Modal */}
      <Sheet
        open={showLimitWarning}
        onClose={() => setShowLimitWarning(false)}
        size="sm"
        title="Bill Record Limit Reached"
        description={`Free plan users can record up to ${limits.maxBills} bills & payments. Upgrade to SubHalt Plus for higher limits and receipt scanning.`}
        headerAction={
          <span className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <AlertCircle className="w-6 h-6" />
          </span>
        }
        footer={
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setShowLimitWarning(false)}
              className="px-4 py-2.5 min-h-[44px] rounded-xl border border-[#161F1D] text-xs font-medium text-[#94A3B8] hover:text-[#F5F7F6]"
            >
              Dismiss
            </button>
            <Link
              href="/plans"
              onClick={() => setShowLimitWarning(false)}
              className="px-5 py-2.5 min-h-[44px] rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#051310] text-xs font-bold transition-all shadow-md"
            >
              Upgrade Plan
            </Link>
          </div>
        }
      />
    </div>
  );
}