'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Receipt, 
  AlertCircle,
} from 'lucide-react';
import type { BillPayment, ExtractedBillReceiptData } from '@/lib/types/bills.types';
import {
  fetchBillPayments,
  createBillPayment,
  updateBillPayment,
  deleteBillPayment,
  calculateBillSpendingSummary,
} from '@/lib/services/bills-service';
import { useUserSettings } from '@/lib/contexts/user-settings-context';
import { getPlanLimits } from '@/lib/constants/plan-limits';
import { useToast } from '@/lib/hooks/use-toast';
import { CompactMonthlySummaryCard, BillAnalyticsInsights } from './bill-spending-summary';
import BillHistoryTable from './bill-history-table';
import BillModal from './bill-modal';
import ReceiptScanModal from './receipt-scan-modal';
import BillDetailModal from './bill-detail-modal';
import PayABillFlow from './pay-a-bill-flow';

interface BillsManagerProps {
  initialTab?: 'pay' | 'history';
}

export default function BillsManager({ initialTab = 'pay' }: BillsManagerProps) {
  const { planTier, defaultCurrency, exchangeRates } = useUserSettings();
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
  const limits = useMemo(() => getPlanLimits(planTier), [planTier]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const billsRes = await fetchBillPayments();
    if (billsRes.data) setBills(billsRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('subsync_bills_updated', handleUpdate);
    return () => {
      window.removeEventListener('subsync_bills_updated', handleUpdate);
    };
  }, [loadData]);

  const summary = useMemo(() => {
    return calculateBillSpendingSummary(bills, defaultCurrency, exchangeRates);
  }, [bills, defaultCurrency, exchangeRates]);

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
      const { error } = await updateBillPayment(editingBill.id, billData);
      if (error) {
        toast.error(error.message, 'Error updating bill');
      } else {
        toast.success('Bill updated successfully', 'Payment Saved');
        loadData();
      }
    } else {
      const { error } = await createBillPayment(billData as any);
      if (error) {
        toast.error(error.message, 'Error saving bill');
      } else {
        toast.success('Payment recorded successfully', 'Payment Saved');
        loadData();
      }
    }
  };

  const handleConfirmScan = async (extracted: ExtractedBillReceiptData) => {
    const { error } = await createBillPayment({
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
      receipts: extracted.fileName
        ? [
            {
              id: `rec_${Date.now()}`,
              fileName: extracted.fileName,
              uploadDate: new Date().toISOString(),
              price: extracted.amount,
              currency: extracted.currency,
              provider: extracted.providerName,
            },
          ]
        : [],
      status: 'paid',
    });

    if (error) {
      toast.error(error.message, 'Error saving receipt payment');
    } else {
      toast.success('Receipt scanned & payment saved successfully', 'Receipt Processed');
      loadData();
    }
  };

  const handleDeleteBill = async (id: string) => {
    const { error } = await deleteBillPayment(id);
    if (error) {
      toast.error(error.message, 'Error deleting record');
    } else {
      toast.success('Payment record deleted', 'Record Removed');
      loadData();
    }
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
            bills={bills}
            onSelectBill={(b) => {
              setSelectedBill(b);
              setIsDetailModalOpen(true);
            }}
            onEditBill={(b) => {
              setEditingBill(b);
              setIsAddModalOpen(true);
            }}
            onDeleteBill={handleDeleteBill}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            limitDisplayCount={showAllPayments ? undefined : 12}
            onViewAll={() => setShowAllPayments(true)}
          />

          {/* 3. Insights & Analytics (Positioned BELOW payment history records) */}
          <BillAnalyticsInsights
            summary={summary}
            onFilterCategory={(cat) => {
              setSelectedCategory(cat);
              setShowAllPayments(true);
            }}
          />
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
      />

      {/* Free Plan Limit Reached Warning Modal */}
      {showLimitWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#090C0B] border border-[#161F1D] rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-[#F5F7F6]">Bill Record Limit Reached</h3>
              <p className="text-xs text-[#94A3B8] mt-1.5 leading-relaxed">
                Free plan users can record up to {limits.maxBills} bills & payments. Upgrade to SubHalt Plus for higher limits and receipt scanning.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowLimitWarning(false)}
                className="px-4 py-2.5 rounded-xl border border-[#161F1D] text-xs font-medium text-[#94A3B8] hover:text-[#F5F7F6]"
              >
                Dismiss
              </button>
              <Link
                href="/plans"
                onClick={() => setShowLimitWarning(false)}
                className="px-5 py-2.5 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#051310] text-xs font-bold transition-all shadow-md"
              >
                Upgrade Plan
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
