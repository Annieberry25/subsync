'use client';

import { useState } from 'react';
import { X, Upload, CheckCircle2, Sparkles, AlertCircle, Edit3, FileSearch } from 'lucide-react';
import Sheet from '@/components/ui/sheet';
import type { ExtractedBillReceiptData } from '@/lib/types/bills.types';
import { STANDARD_BILL_CATEGORIES } from '@/lib/types/bills.types';
import { SUPPORTED_CURRENCIES } from '@/lib/services/currency-service';
import { useCurrency } from '@/lib/contexts/user-settings-context';
import { ACCEPT_ATTRIBUTE, TEXT_SOURCE_LABEL, useReceiptScan } from '@/lib/hooks/use-receipt-scan';
import { mapBillingCycleToBillFrequency } from '@/lib/services/receipt-discovery';
import type { ReceiptExtraction } from '@/lib/services/receipt-parser';
import ProviderLogo from './provider-logo';

interface ReceiptScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    extractedData: ExtractedBillReceiptData,
    file: File | null,
    extraction: ReceiptExtraction | null
  ) => Promise<void>;
}

/** Turns a confidence-scoped extraction into the editable confirm form. */
function toFormState(extraction: ReceiptExtraction, defaultCurrency: string): ExtractedBillReceiptData {
  return {
    providerName: extraction.providerName.value ?? '',
    amount: extraction.amount.value ?? 0,
    // Never invent a currency: fall back to the user's display setting, which
    // is a visible default in the form rather than a fabricated field.
    currency: extraction.currency.value ?? defaultCurrency ?? 'NGN',
    paymentDate: extraction.paymentDate.value ?? new Date().toISOString().split('T')[0],
    category: extraction.category.value ?? 'Utilities',
    customCategory: '',
    providerReference: extraction.providerReference.value ?? '',
    region: extraction.region.value ?? '',
    paymentFrequency: mapBillingCycleToBillFrequency(extraction.billingCycle.value),
  };
}

export default function ReceiptScanModal(props: ReceiptScanModalProps) {
  // Remounting on open is what resets the wizard; an effect that cleared state
  // on close would render one extra frame of the previous session.
  if (!props.isOpen) return null;
  return <ReceiptScanModalBody key="open" {...props} />;
}

function ReceiptScanModalBody({
  isOpen,
  onClose,
  onConfirm,
}: ReceiptScanModalProps) {
  const { defaultCurrency } = useCurrency();
  const scan = useReceiptScan();

  const [step, setStep] = useState<'upload' | 'confirm'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lowConfidence, setLowConfidence] = useState<string[]>([]);
  const [showReadText, setShowReadText] = useState(false);

  // Extracted Form State for Step 2 ("Here's what we found")
  const [extractedData, setExtractedData] = useState<ExtractedBillReceiptData>({
    providerName: '',
    amount: 0,
    currency: defaultCurrency || 'NGN',
    paymentDate: new Date().toISOString().split('T')[0],
    category: 'Electricity',
    customCategory: '',
    providerReference: '',
    region: '',
  });

  const applyResult = (extraction: ReceiptExtraction) => {
    setExtractedData(toFormState(extraction, defaultCurrency || 'NGN'));
    // Only surface the fields the server flagged as unreliable, so the banner
    // stays short and actionable.
    const flagged: string[] = [];
    if (extraction.amount.confidence === 'low' || extraction.amount.confidence === 'none') {
      flagged.push('amount');
    }
    if (extraction.paymentDate.confidence === 'low') flagged.push('payment date');
    if (extraction.providerName.confidence === 'low' || extraction.providerName.confidence === 'none') {
      flagged.push('provider name');
    }
    setLowConfidence(flagged);
    setStep('confirm');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    // Reset the input so re-picking the same file fires change again.
    e.target.value = '';

    if (selected.size > 10 * 1024 * 1024) {
      setErrorMsg('File size exceeds maximum allowed limit of 10MB.');
      return;
    }

    setFile(selected);
    setPastedText('');
    setErrorMsg('');
  };

  const handleAnalyze = async () => {
    if (!file && !pastedText.trim()) {
      setErrorMsg('Please upload a receipt file or paste confirmation text.');
      return;
    }
    const result = await scan.run({ kind: 'bill', file, text: pastedText });
    if (result) applyResult(result.extraction);
  };

  const handleSaveConfirmed = async () => {
    if (!extractedData.providerName.trim()) {
      setErrorMsg('Provider name cannot be empty.');
      return;
    }
    if (!extractedData.amount || extractedData.amount <= 0) {
      setErrorMsg('Please enter a valid amount.');
      return;
    }

    setIsSaving(true);
    try {
      await onConfirm(extractedData, file, scan.result?.extraction ?? null);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save confirmed payment.');
    } finally {
      setIsSaving(false);
    }
  };

  const isBusy = scan.isScanning || isSaving;
  const scanError = scan.error || errorMsg;
  const sourceLabel = scan.result ? TEXT_SOURCE_LABEL[scan.result.textSource] : null;

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      size="lg"
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#14B8A6]" />
          {step === 'upload' ? 'Scan Bill or Receipt' : "Here's What We Found"}
        </span>
      }
      description={
        step === 'upload'
          ? 'Upload an invoice, screenshot, or paste receipt text to automatically extract details.'
          : 'Inspect and confirm the extracted values before permanently saving.'
      }
      footer={
        step === 'confirm' ? (
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setStep('upload')}
              className="px-3.5 py-2 min-h-[44px] rounded-xl border border-[#161F1D] text-xs font-medium text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#161F1D] transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Re-scan File</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 min-h-[44px] rounded-xl text-xs text-[#94A3B8] hover:text-[#F5F7F6]"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleSaveConfirmed}
                className="px-5 py-2.5 min-h-[44px] rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#051310] text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm & Save</span>
              </button>
            </div>
          </div>
        ) : null
      }
    >
        <div className="space-y-5">
          {scanError && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="flex-1">{scanError}</span>
              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  scan.clearError();
                }}
                className="shrink-0 text-red-300 hover:text-white transition-colors cursor-pointer"
                aria-label="Dismiss error"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* STEP 1: Upload or Paste */}
          {step === 'upload' && (
            <div className="space-y-4">
              {/* File Upload Zone */}
              <div className="relative border-2 border-dashed border-[#161F1D] hover:border-[#14B8A6] rounded-2xl p-6 text-center transition-all bg-[#050706] group cursor-pointer">
                <input
                  type="file"
                  accept={ACCEPT_ATTRIBUTE}
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-2xl bg-[#14B8A6]/10 border border-[#14B8A6]/30 flex items-center justify-center text-[#14B8A6] mb-3 group-hover:scale-105 transition-transform">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold text-[#F5F7F6]">
                    {file ? `Selected: ${file.name}` : 'Drop receipt file here or click to browse'}
                  </span>
                  <span className="text-[11px] text-[#94A3B8] mt-1">
                    PDF invoices, screenshots, photos, or text files (max 10MB)
                  </span>
                </div>
              </div>

              {/* What the text we read looks like */}
              {scan.result && (
                <div className="rounded-xl border border-[#161F1D] bg-[#050706] p-3">
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-[#94A3B8] mb-1.5">
                    <FileSearch className="w-3.5 h-3.5" />
                    <span>{TEXT_SOURCE_LABEL[scan.result.textSource]}</span>
                    {scan.result.pageCount > 1 && <span>· {scan.result.pageCount} pages</span>}
                    <button
                      type="button"
                      onClick={() => setShowReadText((v) => !v)}
                      className="ml-auto text-[#14B8A6] hover:underline"
                    >
                      {showReadText ? 'Hide' : 'View'} text
                    </button>
                  </div>
                  {showReadText && (
                    <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-[11px] text-[#94A3B8] font-mono">
                      {scan.result.text}
                    </pre>
                  )}
                </div>
              )}

              {/* Paste Text Option */}
              <div>
                <label className="block text-xs font-semibold text-[#F5F7F6] mb-1.5">
                  Or Paste Receipt / Email Confirmation Text
                </label>
                <textarea
                  rows={4}
                  value={pastedText}
                  onChange={(e) => {
                    setPastedText(e.target.value);
                    if (e.target.value.trim()) setFile(null);
                  }}
                  placeholder="Paste your billing email snippet, token sms, or invoice text here (e.g. 'Ikeja Electric prepaid token ₦25,000 paid on 20 Aug 2026')..."
                  className="w-full px-3.5 py-2.5 bg-[#050706] border border-[#161F1D] rounded-xl text-xs text-[#F5F7F6] placeholder-[#64748B] focus:outline-none focus:border-[#14B8A6]"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#161F1D] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isBusy}
                  className="px-4 py-2.5 rounded-xl border border-[#161F1D] text-xs font-medium text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#161F1D] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={isBusy || (!file && !pastedText.trim())}
                  className="px-5 py-2.5 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#051310] text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {scan.isScanning ? (
                    <span className="animate-pulse">Reading receipt…</span>
                  ) : (
                    <span>Extract Receipt Details</span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: "Here's what we found" Confirmation Form */}
          {step === 'confirm' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-3.5 rounded-xl bg-[#14B8A6]/10 border border-[#14B8A6]/30 flex items-center gap-2.5 text-[#14B8A6] text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  {sourceLabel ? `Read from ${sourceLabel.toLowerCase()}. ` : ''}
                  Review every value before saving.
                </span>
              </div>

              {lowConfidence.length > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5 text-amber-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    We could not read the {lowConfidence.join(', ')} clearly, so{' '}
                    {lowConfidence.length === 1 ? 'it is' : 'they are'} a best guess. Please check{' '}
                    {lowConfidence.length === 1 ? 'it' : 'them'} against the receipt.
                  </span>
                </div>
              )}

              {/* Provider Name */}
              <div>
                <label className="block text-xs font-semibold text-[#F5F7F6] mb-1">
                  Provider / Merchant Name
                </label>
                <div className="flex items-center gap-2">
                  <ProviderLogo name={extractedData.providerName} size="md" />
                  <input
                    type="text"
                    value={extractedData.providerName}
                    onChange={(e) => setExtractedData({ ...extractedData, providerName: e.target.value })}
                    className="w-full px-3 py-2 bg-[#050706] border border-[#161F1D] rounded-xl text-xs text-[#F5F7F6] focus:border-[#14B8A6]"
                  />
                </div>
              </div>

              {/* Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#F5F7F6] mb-1">
                    Category
                  </label>
                  <select
                    value={extractedData.category}
                    onChange={(e) => setExtractedData({ ...extractedData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-[#050706] border border-[#161F1D] rounded-xl text-xs text-[#F5F7F6]"
                  >
                    {STANDARD_BILL_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {extractedData.category === 'Other' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#14B8A6] mb-1">
                      Custom Category
                    </label>
                    <input
                      type="text"
                      value={extractedData.customCategory || ''}
                      onChange={(e) => setExtractedData({ ...extractedData, customCategory: e.target.value })}
                      placeholder="e.g. Water, Security..."
                      className="w-full px-3 py-2 bg-[#050706] border border-[#14B8A6]/60 rounded-xl text-xs text-[#F5F7F6]"
                    />
                  </div>
                )}
              </div>

              {/* Amount & Currency */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#F5F7F6] mb-1">
                    Amount
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={extractedData.amount || ''}
                    onChange={(e) => setExtractedData({ ...extractedData, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-[#050706] border border-[#161F1D] rounded-xl text-xs text-[#F5F7F6]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#F5F7F6] mb-1">
                    Currency
                  </label>
                  <select
                    value={extractedData.currency}
                    onChange={(e) => setExtractedData({ ...extractedData, currency: e.target.value })}
                    className="w-full px-3 py-2 bg-[#050706] border border-[#161F1D] rounded-xl text-xs text-[#F5F7F6]"
                  >
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} ({c.symbol})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date & Reference */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#F5F7F6] mb-1">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    value={extractedData.paymentDate}
                    onChange={(e) => setExtractedData({ ...extractedData, paymentDate: e.target.value })}
                    className="w-full px-3 py-2 bg-[#050706] border border-[#161F1D] rounded-xl text-xs text-[#F5F7F6]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#F5F7F6] mb-1">
                    Reference Number
                  </label>
                  <input
                    type="text"
                    value={extractedData.providerReference || ''}
                    onChange={(e) => setExtractedData({ ...extractedData, providerReference: e.target.value })}
                    placeholder="Ref or Txn ID"
                    className="w-full px-3 py-2 bg-[#050706] border border-[#161F1D] rounded-xl text-xs text-[#F5F7F6]"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
    </Sheet>
  );
}
