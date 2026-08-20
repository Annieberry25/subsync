'use client';

import { X, ExternalLink, ShieldCheck, Calendar, MapPin, Tag, FileText, Trash2, Edit3, CheckCircle2, Clock, Info } from 'lucide-react';
import type { BillPayment } from '@/lib/types/bills.types';
import { formatCurrencyAmount, convertAmount } from '@/lib/services/currency-service';
import { useUserSettings } from '@/lib/contexts/user-settings-context';
import { getVerifiedProvider } from '@/lib/constants/verified-providers';

interface BillDetailModalProps {
  bill: BillPayment | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (bill: BillPayment) => void;
  onDelete: (id: string) => void;
}

export default function BillDetailModal({
  bill,
  isOpen,
  onClose,
  onEdit,
  onDelete,
}: BillDetailModalProps) {
  const { defaultCurrency, exchangeRates } = useUserSettings();

  if (!isOpen || !bill) return null;

  const verified = getVerifiedProvider(bill.providerName);
  const isVerified = Boolean(verified);

  const convertedDisplay = convertAmount(bill.amount, bill.currency, defaultCurrency, exchangeRates);
  const originalFormatted = formatCurrencyAmount(bill.amount, bill.currency);
  const convertedFormatted = formatCurrencyAmount(convertedDisplay, defaultCurrency);

  const isDifferentCurrency = (bill.currency || 'NGN').toUpperCase() !== (defaultCurrency || 'USD').toUpperCase();

  const handleVisitProvider = () => {
    if (bill.officialProviderUrl) {
      window.open(bill.officialProviderUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-[#0B0D0D] border border-[#1A1D1D] rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#1A1D1D] flex items-center justify-between bg-[#0F1111]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#14B8A6]/10 border border-[#14B8A6]/30 flex items-center justify-center text-[#14B8A6] font-bold text-sm">
              {bill.providerName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[#F5F7F6] tracking-tight">
                  {bill.providerName}
                </h2>
                {isVerified && (
                  <span className="px-2 py-0.5 rounded-full bg-[#14B8A6]/15 border border-[#14B8A6]/40 text-[#14B8A6] text-[10px] font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Verified Biller
                  </span>
                )}
              </div>
              <p className="text-xs text-[#94A3B8] mt-0.5 flex items-center gap-2">
                <span>{bill.category === 'Other' && bill.customCategory ? bill.customCategory : bill.category}</span>
                <span>•</span>
                <span className="capitalize">{bill.status}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Amount Card */}
          <div className="p-5 rounded-2xl bg-[#000000] border border-[#1A1D1D] flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-[#94A3B8] block">Payment Amount</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-[#F5F7F6] tracking-tight">
                  {originalFormatted}
                </span>
                <span className="text-xs font-bold text-[#14B8A6] bg-[#14B8A6]/10 px-2 py-0.5 rounded-md border border-[#14B8A6]/20">
                  {bill.currency}
                </span>
              </div>
              {isDifferentCurrency && (
                <span className="text-xs text-[#94A3B8] mt-1 block">
                  Converted Display: <strong className="text-[#F5F7F6]">{convertedFormatted}</strong>
                </span>
              )}
            </div>

            {/* Visit Provider Portal Button if Verified */}
            {bill.officialProviderUrl && (
              <button
                type="button"
                onClick={handleVisitProvider}
                className="px-4 py-2.5 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#091512] text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <span>Visit Provider</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Key Information Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl bg-[#0F1111] border border-[#1A1D1D]">
              <span className="text-[11px] font-medium text-[#94A3B8] block mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#14B8A6]" />
                Payment Date
              </span>
              <span className="text-xs font-semibold text-[#F5F7F6]">{bill.paymentDate}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0F1111] border border-[#1A1D1D]">
              <span className="text-[11px] font-medium text-[#94A3B8] block mb-1 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#14B8A6]" />
                Frequency
              </span>
              <span className="text-xs font-semibold text-[#F5F7F6] capitalize">
                {bill.isRecurring ? bill.paymentFrequency || 'Recurring' : 'One-time payment'}
              </span>
            </div>

            {bill.region || bill.country ? (
              <div className="p-3.5 rounded-xl bg-[#0F1111] border border-[#1A1D1D]">
                <span className="text-[11px] font-medium text-[#94A3B8] block mb-1 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#14B8A6]" />
                  Location
                </span>
                <span className="text-xs font-semibold text-[#F5F7F6]">
                  {[bill.city, bill.region, bill.country].filter(Boolean).join(', ')}
                </span>
              </div>
            ) : null}

            <div className="p-3.5 rounded-xl bg-[#0F1111] border border-[#1A1D1D]">
              <span className="text-[11px] font-medium text-[#94A3B8] block mb-1 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-[#14B8A6]" />
                Source Record
              </span>
              <span className="text-xs font-semibold text-[#F5F7F6] capitalize">
                {bill.source === 'receipt_scan'
                  ? 'Receipt Scanned'
                  : bill.source === 'email_discovered'
                  ? 'Email Discovered'
                  : 'Manually Entered'}
              </span>
            </div>
          </div>

          {/* Reference ID */}
          {bill.providerReference && (
            <div className="p-3.5 rounded-xl bg-[#0F1111] border border-[#1A1D1D]">
              <span className="text-[11px] font-medium text-[#94A3B8] block mb-1">
                Transaction / Meter / Account Reference
              </span>
              <code className="text-xs font-mono font-semibold text-[#14B8A6] bg-[#000000] px-2.5 py-1 rounded border border-[#1A1D1D] inline-block">
                {bill.providerReference}
              </code>
            </div>
          )}

          {/* Notes */}
          {bill.notes && (
            <div className="p-3.5 rounded-xl bg-[#0F1111] border border-[#1A1D1D]">
              <span className="text-[11px] font-medium text-[#94A3B8] block mb-1">
                Notes & Description
              </span>
              <p className="text-xs text-[#F5F7F6] leading-relaxed whitespace-pre-line">{bill.notes}</p>
            </div>
          )}

          {/* Attached Receipts */}
          {bill.receipts && bill.receipts.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-[#F5F7F6] flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#14B8A6]" />
                Attached Receipts ({bill.receipts.length})
              </span>
              <div className="space-y-2">
                {bill.receipts.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-3 rounded-xl bg-[#000000] border border-[#1A1D1D] flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-[#94A3B8] shrink-0" />
                      <span className="text-[#F5F7F6] truncate font-medium">{rec.fileName}</span>
                    </div>
                    <span className="text-[10px] text-[#94A3B8]">{rec.uploadDate.split('T')[0]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions Footer */}
          <div className="pt-4 border-t border-[#1A1D1D] flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                onClose();
                onDelete(bill.id);
              }}
              className="px-3.5 py-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Record</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs text-[#94A3B8] hover:text-[#F5F7F6]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(bill);
                }}
                className="px-4 py-2 rounded-xl bg-[#1A1D1D] hover:bg-[#262A2B] text-[#F5F7F6] text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit Payment</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
