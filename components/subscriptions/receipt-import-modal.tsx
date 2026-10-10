'use client';

import { useState } from 'react';
import { Upload, ChevronLeft, AlertCircle, FileSearch } from 'lucide-react';
import { CustomSelect } from '@/components/ui/custom-select';
import Sheet from '@/components/ui/sheet';
import { SUPPORTED_CURRENCIES } from '@/lib/services/currency-service';
import { ACCEPT_ATTRIBUTE, TEXT_SOURCE_LABEL, useReceiptScan } from '@/lib/hooks/use-receipt-scan';
import type { ReceiptExtraction } from '@/lib/services/receipt-parser';

export interface ExtractedReceiptData {
  name: string;
  plan?: string;
  price: string;
  currency: string;
  billingCycle: 'monthly' | 'yearly' | 'weekly' | 'quarterly';
  category: 'Streaming' | 'Software' | 'Utilities' | 'Fitness' | 'Finance' | 'Education' | 'Gaming' | 'Other';
  nextBillingDate: string;
  trialEndDate?: string;
  providerUrl?: string;
}

interface ReceiptImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  onCancel?: () => void;
  onConfirm: (extracted: ExtractedReceiptData, file: File | null) => void;
  initialProviderName?: string;
}

const CATEGORY_ORDER: ExtractedReceiptData['category'][] = [
  'Streaming',
  'Software',
  'Utilities',
  'Fitness',
  'Finance',
  'Education',
  'Gaming',
  'Other',
];

/**
 * The same list the Edit Subscription form offers, so a receipt can be priced
 * in any supported currency instead of only the four this modal used to carry.
 */
const CURRENCY_OPTIONS = SUPPORTED_CURRENCIES.map((c) => ({
  value: c.code,
  label: `${c.code} (${c.symbol})`,
}));

function toCategory(value: string | null | undefined): ExtractedReceiptData['category'] {
  if (!value) return 'Other';
  const match = CATEGORY_ORDER.find((c) => c.toLowerCase() === value.toLowerCase());
  return match ?? 'Other';
}

function toBillingCycle(value: string | undefined): ExtractedReceiptData['billingCycle'] {
  if (value === 'yearly' || value === 'quarterly' || value === 'weekly') return value;
  return 'monthly';
}

/**
 * Maps the shared extraction onto the subscription form. Anything the parser
 * could not read is left blank rather than guessed — a wrong renewal date is
 * worse than an empty field the user fills in.
 */
function toReviewData(
  extraction: ReceiptExtraction,
  initialProviderName?: string
): ExtractedReceiptData {
  return {
    name: extraction.providerName.value ?? initialProviderName ?? '',
    plan: extraction.plan.value ?? undefined,
    price: extraction.amount.value != null ? String(extraction.amount.value) : '',
    currency: extraction.currency.value ?? 'USD',
    billingCycle: toBillingCycle(extraction.billingCycle.value),
    category: toCategory(extraction.category.value),
    nextBillingDate: extraction.nextBillingDate.value ?? '',
    providerUrl: extraction.providerUrl.value ?? undefined,
  };
}

export default function ReceiptImportModal({
  isOpen,
  onClose,
  onBack,
  onCancel,
  onConfirm,
  initialProviderName,
}: ReceiptImportModalProps) {
  const scan = useReceiptScan();
  const [receiptText, setReceiptText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [reviewData, setReviewData] = useState<ExtractedReceiptData | null>(null);
  const [showReadText, setShowReadText] = useState(false);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    e.target.value = '';
    if (selected.size > 10 * 1024 * 1024) {
      scan.clearError();
      return;
    }
    setFile(selected);
    if (receiptText.trim()) setReceiptText('');
  };

  const handleAnalyze = async () => {
    const result = await scan.run({ kind: 'subscription', file, text: receiptText });
    if (result) setReviewData(toReviewData(result.extraction, initialProviderName));
  };

  const handleConfirmExtracted = () => {
    if (reviewData) {
      onConfirm(reviewData, file);
      onClose();
    }
  };

  const isAnalyzeDisabled = scan.isScanning || (!receiptText.trim() && !file);

  /**
   * True when the parser left something blank or guessed it.
   *
   * Only used to decide whether to warn. The notice deliberately does not name
   * the fields: the form already shows which ones are empty, and listing them
   * as "price, renewal date" read as a parser error rather than a blank form.
   */
  const hasUnreadableFields = (() => {
    if (!scan.result) return false;
    const e = scan.result.extraction;
    return (
      e.amount.confidence === 'low' ||
      e.amount.confidence === 'none' ||
      e.providerName.confidence === 'low' ||
      e.providerName.confidence === 'none' ||
      !e.nextBillingDate.value
    );
  })();

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      size="md"
      title="Import Subscription Receipt"
      description={
        <span className="text-xs">
          Extract provider details from receipt files or text confirmation
        </span>
      }
      headerLeading={
        (onBack || onCancel) ? (
          <button
            type="button"
            onClick={() => {
              if (reviewData) {
                setReviewData(null);
              } else if (onBack) {
                onBack();
              } else if (onCancel) {
                onCancel();
              }
            }}
            aria-label="Go back"
            data-touch="compact"
            className="w-9 h-9 flex items-center justify-center text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        ) : null
      }
      /* Primary action is pinned so it stays reachable while the form scrolls.
         It sits right so it lines up with the action row on the form it
         feeds, instead of floating against the left edge. */
      footer={
        <div className="flex justify-end">
          {!reviewData ? (
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isAnalyzeDisabled}
              className="w-full sm:w-auto px-5 min-h-[44px] rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>{scan.isScanning ? 'Reading receipt…' : 'Extract Receipt'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConfirmExtracted}
              /* Both responsive labels are in the DOM at once, so the accessible
                 name needs stating or it reads "Add Add Subscription". */
              aria-label="Add Subscription"
              className="w-full sm:w-auto px-6 min-h-[44px] rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span className="sm:hidden">Add</span>
              <span className="hidden sm:inline">Add Subscription</span>
            </button>
          )}
        </div>
      }
    >
        {/* Content Body. The Sheet body owns the scroll. */}
        <div className="space-y-4 pt-1">
          {!reviewData ? (
            <>
              {/* Step 1: Upload or Paste Receipt */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider block">
                  1. Upload Receipt File (PDF, Text, Image)
                </label>
                <div className="relative border-2 border-dashed border-[#1A1D1D] hover:border-[#14B8A6] rounded-2xl p-4 text-center bg-[#0D0F0F]/50 transition-colors">
                  <input
                    type="file"
                    accept={ACCEPT_ATTRIBUTE}
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center space-y-1.5 pointer-events-none">
                    <Upload className="w-6 h-6 text-[#14B8A6]" />
                    <span className="text-xs font-semibold text-[#F5F7F6]">
                      {file ? `Selected: ${file.name}` : 'Click or drop subscription receipt here'}
                    </span>
                    <span className="text-[11px] text-[#94A3B8]">
                      PDF invoices, screenshots, photos, or text files (max 10MB)
                    </span>
                  </div>
                </div>
              </div>

              {scan.result && (
                <div className="rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] p-3">
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-[#94A3B8]">
                    <FileSearch className="w-3.5 h-3.5" />
                    <span>{TEXT_SOURCE_LABEL[scan.result.textSource]}</span>
                    <button
                      type="button"
                      onClick={() => setShowReadText((v) => !v)}
                      className="ml-auto text-[#14B8A6] hover:underline"
                    >
                      {showReadText ? 'Hide' : 'View'} text
                    </button>
                  </div>
                  {showReadText && (
                    <pre className="mt-1.5 max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-[11px] text-[#94A3B8] font-mono">
                      {scan.result.text}
                    </pre>
                  )}
                </div>
              )}

              {scan.error && (
                /* Container stays on the app's black surface; only the message
                   and its icon carry the danger colour. */
                <div className="p-3 rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#D9363E]" />
                  <span className="flex-1 text-[#D9363E]">{scan.error}</span>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider block">
                  Or Paste Receipt / Confirmation Text
                </label>
                <textarea
                  rows={5}
                  placeholder="Paste your receipt or subscription confirmation text here..."
                  value={receiptText}
                  onChange={(e) => {
                    setReceiptText(e.target.value);
                    if (e.target.value.trim()) setFile(null);
                  }}
                  className="w-full px-4 py-3 text-xs rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#F5F7F6] placeholder:text-[11px] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors resize-none"
                />
              </div>

              {isAnalyzeDisabled && (
                <p className="text-xs text-[#94A3B8] italic text-center pt-1">
                  Upload a receipt file or paste receipt text above to extract subscription details.
                </p>
              )}
            </>
          ) : (
            /* Step 2: Extraction Review & Confirmation */
            <div className="space-y-4">
              {hasUnreadableFields && (
                <div className="p-3 rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#F59E0B]" />
                  <span className="flex-1 text-[#F59E0B]">
                    We could not read all the information clearly, so they are blank. Please check
                    to fill it out.
                  </span>
                </div>
              )}

              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                  Extracted Subscription Data
                </h3>

                {/* Standard form: plain label on top, pill input below. These
                    fields used to sit inside their own bordered boxes inside a
                    bordered group, so every value read as its own card. */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1.5">
                    <span className="text-[#94A3B8] block text-[11px]">Provider Name</span>
                    <input
                      type="text"
                      value={reviewData.name}
                      onChange={(e) => setReviewData({ ...reviewData, name: e.target.value })}
                      placeholder="e.g. Netflix"
                      className="w-full h-11 px-4 rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#F5F7F6] font-semibold text-sm placeholder:text-[11px] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[#94A3B8] block text-[11px]">Price &amp; Currency</span>
{/* Currency and amount share one pill, matching how the rest of the app
                      pairs a select with a free-text value. */}
                    <div className="flex items-stretch rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] focus-within:border-[#14B8A6] transition-colors overflow-hidden">
                      <div className="flex items-center border-r border-[#1A1D1D]">
                        <CustomSelect
                          options={CURRENCY_OPTIONS}
                          value={reviewData.currency}
                          onChange={(val) => setReviewData({ ...reviewData, currency: val })}
                          ariaLabel="Currency"
                          variant="borderless"
                          showCheckmark={false}
                        />
                      </div>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={reviewData.price}
                        onChange={(e) => setReviewData({ ...reviewData, price: e.target.value })}
                        placeholder="0.00"
                        className="flex-1 min-w-0 h-11 px-4 rounded-none bg-transparent border-0 text-[#F5F7F6] font-semibold text-sm placeholder:text-[11px] placeholder-[#94A3B8] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[#94A3B8] block text-[11px]">Billing Cycle</span>
                    <select
                      value={reviewData.billingCycle}
                      onChange={(e) =>
                        setReviewData({
                          ...reviewData,
                          billingCycle: e.target.value as ExtractedReceiptData['billingCycle'],
                        })
                      }
                      aria-label="Billing cycle"
                      className="w-full h-11 !pl-4 !pr-12 rounded-xl bg-[#0D0F0D] border border-[#1A1D1D] text-[#F5F7F6] font-semibold text-xs capitalize focus:outline-none focus:border-[#14B8A6] transition-colors"
                    >
                      {(['monthly', 'yearly', 'quarterly', 'weekly'] as const).map((c) => (
                        <option key={c} value={c} className="bg-[#0B0D0D] capitalize">
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[#94A3B8] block text-[11px]">Next Billing Date</span>
                    <input
                      type="date"
                      value={reviewData.nextBillingDate}
                      onChange={(e) => setReviewData({ ...reviewData, nextBillingDate: e.target.value })}
                      className="w-full h-11 px-4 rounded-xl bg-[#0D0F0D] border border-[#1A1D1D] text-[#F5F7F6] font-semibold text-xs focus:outline-none focus:border-[#14B8A6] transition-colors"
                    />
                    {!reviewData.nextBillingDate && (
                      <span className="block text-[10px] text-[#F59E0B]/80">
                        Not found on the receipt. Enter it yourself.
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[#94A3B8] block text-[11px]">Category</span>
                    <select
                      value={reviewData.category}
                      onChange={(e) =>
                        setReviewData({ ...reviewData, category: e.target.value as ExtractedReceiptData['category'] })
                      }
                      aria-label="Category"
                      className="w-full h-11 !pl-4 !pr-12 rounded-xl bg-[#0D0F0D] border border-[#1A1D1D] text-[#F5F7F6] font-semibold text-xs focus:outline-none focus:border-[#14B8A6] transition-colors"
                    >
                      {CATEGORY_ORDER.map((c) => (
                        <option key={c} value={c} className="bg-[#0B0D0D]">
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[#94A3B8] block text-[11px]">Plan / Tier</span>
                    <input
                      type="text"
                      value={reviewData.plan || ''}
                      onChange={(e) => setReviewData({ ...reviewData, plan: e.target.value })}
                      placeholder="e.g. Premium, Family, Basic"
                      className="w-full h-11 px-4 rounded-xl bg-[#0D0F0D] border border-[#1A1D1D] text-[#F5F7F6] font-semibold text-xs placeholder:text-[11px] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
    </Sheet>
  );
}
