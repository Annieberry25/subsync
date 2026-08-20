'use client';

import { useState } from 'react';
import { X, Upload, FileText, CheckCircle2, Sparkles, AlertCircle, Edit3, ArrowRight, Camera } from 'lucide-react';
import type { ExtractedBillReceiptData } from '@/lib/types/bills.types';
import { parseBillReceiptText } from '@/lib/services/bill-receipt-parser';
import { STANDARD_BILL_CATEGORIES } from '@/lib/types/bills.types';
import { SUPPORTED_CURRENCIES } from '@/lib/services/currency-service';
import { useUserSettings } from '@/lib/contexts/user-settings-context';

interface ReceiptScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (extractedData: ExtractedBillReceiptData) => Promise<void>;
}

export default function ReceiptScanModal({
  isOpen,
  onClose,
  onConfirm,
}: ReceiptScanModalProps) {
  const { defaultCurrency } = useUserSettings();

  const [step, setStep] = useState<'upload' | 'confirm'>('upload');
  const [fileName, setFileName] = useState<string>('');
  const [pastedText, setPastedText] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('File size exceeds maximum allowed limit of 10MB.');
      return;
    }

    setFileName(file.name);
    setErrorMsg('');

    // Read text from file if text/plain or sample PDF
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        processExtraction(content, file.name);
      } else {
        processExtraction(`Receipt file uploaded: ${file.name}`, file.name);
      }
    };
    reader.onerror = () => {
      processExtraction(`Receipt file uploaded: ${file.name}`, file.name);
    };

    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      reader.readAsText(file);
    } else {
      // For images/PDFs, run deterministic parsing on file name and text snippet
      processExtraction(`Receipt file: ${file.name}`, file.name);
    }
  };

  const processExtraction = (textToParse: string, fName?: string) => {
    setIsAnalyzing(true);
    setErrorMsg('');

    setTimeout(() => {
      try {
        const parsed = parseBillReceiptText(textToParse, fName);
        setExtractedData({
          ...parsed,
          currency: parsed.currency || defaultCurrency || 'NGN',
          fileName: fName || fileName || 'receipt_scanned.pdf',
        });
        setStep('confirm');
      } catch (err: any) {
        setErrorMsg('Could not parse receipt text. Please try entering details manually.');
      } finally {
        setIsAnalyzing(false);
      }
    }, 600);
  };

  const handleAnalyzePastedText = () => {
    if (!pastedText.trim() && !fileName) {
      setErrorMsg('Please upload a receipt file or paste confirmation text.');
      return;
    }
    processExtraction(pastedText, fileName);
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

    setIsAnalyzing(true);
    try {
      await onConfirm(extractedData);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save confirmed payment.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-[#0B0D0D] border border-[#1A1D1D] rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-[#1A1D1D] flex items-center justify-between bg-[#0F1111]">
          <div>
            <h2 className="text-lg font-bold text-[#F5F7F6] tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#14B8A6]" />
              {step === 'upload' ? 'Scan Bill or Receipt' : "Here's What We Found"}
            </h2>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              {step === 'upload'
                ? 'Upload an invoice, screenshot, or paste receipt text to automatically extract details.'
                : 'Inspect and confirm the extracted values before permanently saving.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: Upload or Paste */}
          {step === 'upload' && (
            <div className="space-y-4">
              {/* File Upload Zone */}
              <div className="relative border-2 border-dashed border-[#1A1D1D] hover:border-[#14B8A6] rounded-2xl p-6 text-center transition-all bg-[#000000] group cursor-pointer">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-2xl bg-[#14B8A6]/10 border border-[#14B8A6]/30 flex items-center justify-center text-[#14B8A6] mb-3 group-hover:scale-105 transition-transform">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold text-[#F5F7F6]">
                    {fileName ? `Uploaded: ${fileName}` : 'Drop receipt file here or click to browse'}
                  </span>
                  <span className="text-[11px] text-[#94A3B8] mt-1">
                    Supports JPG, PNG, PDF invoices, or text confirmation files (max 10MB)
                  </span>
                </div>
              </div>

              {/* Paste Text Option */}
              <div>
                <label className="block text-xs font-semibold text-[#F5F7F6] mb-1.5">
                  Or Paste Receipt / Email Confirmation Text
                </label>
                <textarea
                  rows={4}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Paste your billing email snippet, token sms, or invoice text here (e.g. 'Ikeja Electric prepaid token ₦25,000 paid on 20 Aug 2026')..."
                  className="w-full px-3.5 py-2.5 bg-[#000000] border border-[#1A1D1D] rounded-xl text-xs text-[#F5F7F6] placeholder-[#64748B] focus:outline-none focus:border-[#14B8A6]"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#1A1D1D] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-[#1A1D1D] text-xs font-medium text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAnalyzePastedText}
                  disabled={isAnalyzing}
                  className="px-5 py-2.5 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#091512] text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isAnalyzing ? (
                    <span>Extracting...</span>
                  ) : (
                    <>
                      <span>Extract Receipt Details</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
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
                <span>Extracted payment information. You can review or edit before saving.</span>
              </div>

              {/* Provider Name */}
              <div>
                <label className="block text-xs font-semibold text-[#F5F7F6] mb-1">
                  Provider / Merchant Name
                </label>
                <input
                  type="text"
                  value={extractedData.providerName}
                  onChange={(e) => setExtractedData({ ...extractedData, providerName: e.target.value })}
                  className="w-full px-3 py-2 bg-[#000000] border border-[#1A1D1D] rounded-xl text-xs text-[#F5F7F6] focus:border-[#14B8A6]"
                />
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
                    className="w-full px-3 py-2 bg-[#000000] border border-[#1A1D1D] rounded-xl text-xs text-[#F5F7F6]"
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
                      className="w-full px-3 py-2 bg-[#000000] border border-[#14B8A6]/60 rounded-xl text-xs text-[#F5F7F6]"
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
                    className="w-full px-3 py-2 bg-[#000000] border border-[#1A1D1D] rounded-xl text-xs text-[#F5F7F6]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#F5F7F6] mb-1">
                    Currency
                  </label>
                  <select
                    value={extractedData.currency}
                    onChange={(e) => setExtractedData({ ...extractedData, currency: e.target.value })}
                    className="w-full px-3 py-2 bg-[#000000] border border-[#1A1D1D] rounded-xl text-xs text-[#F5F7F6]"
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
                    className="w-full px-3 py-2 bg-[#000000] border border-[#1A1D1D] rounded-xl text-xs text-[#F5F7F6]"
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
                    className="w-full px-3 py-2 bg-[#000000] border border-[#1A1D1D] rounded-xl text-xs text-[#F5F7F6]"
                  />
                </div>
              </div>

              {/* Footer Confirmation Buttons */}
              <div className="pt-3 border-t border-[#1A1D1D] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="px-3.5 py-2 rounded-xl border border-[#1A1D1D] text-xs font-medium text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Re-scan File</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-xs text-[#94A3B8] hover:text-[#F5F7F6]"
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveConfirmed}
                    className="px-5 py-2.5 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#091512] text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Save</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
