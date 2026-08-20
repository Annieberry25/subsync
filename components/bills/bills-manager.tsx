'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { 
  Plus, 
  Upload, 
  Receipt, 
  Sparkles, 
  Zap, 
  PieChart, 
  ShieldCheck, 
  ArrowUpCircle, 
  AlertCircle,
  Megaphone,
  Check
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
import BillSpendingSummaryComponent from './bill-spending-summary';
import BillHistoryTable from './bill-history-table';
import BillModal from './bill-modal';
import ReceiptScanModal from './receipt-scan-modal';
import BillDetailModal from './bill-detail-modal';

export default function BillsManager() {
  const { planTier, defaultCurrency, exchangeRates } = useUserSettings();
  const { toast } = useToast();

  const [bills, setBills] = useState<BillPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<BillPayment | null>(null);
  const [editingBill, setEditingBill] = useState<BillPayment | null>(null);
  const [showLimitWarning, setShowLimitWarning] = useState(false);

  const limits = useMemo(() => getPlanLimits(planTier), [planTier]);

  const loadBills = useCallback(async () => {
    setLoading(true);
    const { data } = await fetchBillPayments();
    if (data) {
      setBills(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadBills();

    const handleUpdate = () => loadBills();
    window.addEventListener('subsync_bills_updated', handleUpdate);
    return () => {
      window.removeEventListener('subsync_bills_updated', handleUpdate);
    };
  }, [loadBills]);

  const summary = useMemo(() => {
    return calculateBillSpendingSummary(bills, defaultCurrency, exchangeRates);
  }, [bills, defaultCurrency, exchangeRates]);

  const handleOpenAdd = () => {
    if (bills.length >= limits.maxBills) {
      setShowLimitWarning(true);
      return;
    }
    setEditingBill(null);
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
        loadBills();
      }
    } else {
      const { error } = await createBillPayment(billData as any);
      if (error) {
        toast.error(error.message, 'Error saving bill');
      } else {
        toast.success('Payment recorded successfully', 'Payment Saved');
        loadBills();
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
      loadBills();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await deleteBillPayment(id);
    if (error) {
      toast.error(error.message, 'Error deleting record');
    } else {
      toast.success('Payment record deleted', 'Record Removed');
      loadBills();
    }
  };

  return (
    <div className="min-h-screen bg-[#000000] text-[#F5F7F6] p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner Ad Placement for FREE Users only */}
      {limits.showAds && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-[#0F1111] via-[#141718] to-[#0F1111] border border-[#14B8A6]/30 shadow-xl flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#14B8A6]/10 border border-[#14B8A6]/30 flex items-center justify-center text-[#14B8A6] shrink-0">
              <Megaphone className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#F5F7F6] block">
                SubHalt Plus — Unlock Unlimited Bills & Automatic Receipt Forwarding
              </span>
              <span className="text-[11px] text-[#94A3B8]">
                Get higher monthly limits, receipt OCR, and zero ads on Plus.
              </span>
            </div>
          </div>

          <Link
            href="/plans"
            className="px-4 py-2 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#091512] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <ArrowUpCircle className="w-3.5 h-3.5" />
            <span>Upgrade to Plus</span>
          </Link>
        </div>
      )}

      {/* Main Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#1A1D1D]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#F5F7F6] flex items-center gap-2.5">
              <Receipt className="w-6 h-6 text-[#14B8A6]" />
              Bills & Payments
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#1A1D1D] text-[#94A3B8] text-xs font-semibold uppercase tracking-wider">
              {planTier} Plan ({bills.length} / {limits.maxBills === Infinity ? '∞' : limits.maxBills})
            </span>
          </div>
          <p className="text-xs text-[#94A3B8] mt-1">
            Organize utility payments, internet, mobile data, rent, education, and custom charges.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleOpenScan}
            className="px-3.5 py-2.5 rounded-xl border border-[#1A1D1D] bg-[#0B0D0D] hover:bg-[#1A1D1D] text-[#F5F7F6] text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-[#14B8A6]" />
            <span>Scan Receipt</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2.5 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#091512] text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Bill or Payment</span>
          </button>
        </div>
      </div>

      {/* Sub Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#1A1D1D] pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-[#1A1D1D] text-[#F5F7F6] border border-[#1A1D1D]'
              : 'text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#0B0D0D]'
          }`}
        >
          Overview & Insights
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === 'history'
              ? 'bg-[#1A1D1D] text-[#F5F7F6] border border-[#1A1D1D]'
              : 'text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#0B0D0D]'
          }`}
        >
          Payment History ({bills.length})
        </button>
      </div>

      {/* TAB 1: OVERVIEW & INSIGHTS */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <BillSpendingSummaryComponent
            summary={summary}
            onFilterCategory={(cat) => {
              setSelectedCategory(cat);
              setActiveTab('history');
            }}
          />

          {/* Quick History List underneath Overview */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-[#F5F7F6] flex items-center justify-between">
              <span>Recent Payments</span>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className="text-xs text-[#14B8A6] hover:underline cursor-pointer"
              >
                View all history →
              </button>
            </h3>

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
              onDeleteBill={handleDelete}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
          </div>
        </div>
      )}

      {/* TAB 2: PAYMENT HISTORY */}
      {activeTab === 'history' && (
        <div className="animate-in fade-in duration-200">
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
            onDeleteBill={handleDelete}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
        </div>
      )}

      {/* Add / Edit Bill Modal */}
      <BillModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingBill(null);
        }}
        onSave={handleSaveBill}
        initialData={editingBill}
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
        onDelete={handleDelete}
      />

      {/* Free Plan Limit Reached Warning Modal */}
      {showLimitWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#0B0D0D] border border-[#1A1D1D] rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-[#F5F7F6]">Bill Record Limit Reached</h3>
              <p className="text-xs text-[#94A3B8] mt-1.5 leading-relaxed">
                Free plan users can record up to {limits.maxBills} bills & payments. Upgrade to SubHalt Plus for higher limits and receipt scanning.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowLimitWarning(false)}
                className="px-4 py-2.5 rounded-xl border border-[#1A1D1D] text-xs font-medium text-[#94A3B8] hover:text-[#F5F7F6]"
              >
                Dismiss
              </button>
              <Link
                href="/plans"
                onClick={() => setShowLimitWarning(false)}
                className="px-5 py-2.5 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#091512] text-xs font-bold transition-all shadow-md"
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
