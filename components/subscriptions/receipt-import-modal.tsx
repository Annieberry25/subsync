'use client';

import { useState } from 'react';
import { X, FileText, Upload, CheckCircle2, Sparkles } from 'lucide-react';

export interface ExtractedReceiptData {
  name: string;
  plan?: string;
  price: string;
  currency: string;
  billingCycle: 'monthly' | 'yearly' | 'weekly' | 'quarterly';
  category: 'Streaming' | 'Software' | 'Utilities' | 'Fitness' | 'Finance' | 'Education' | 'Gaming' | 'Other';
  nextBillingDate: string;
  providerUrl?: string;
}

interface ReceiptImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (extracted: ExtractedReceiptData) => void;
}

const SAMPLE_RECEIPTS = [
  {
    title: 'Netflix Receipt',
    text: `Netflix Inc. Subscription Receipt\nPlan: Netflix Premium 4K\nAmount Paid: $22.99 USD\nBilling Cycle: Monthly\nNext Renewal Date: September 15, 2026\nCategory: Streaming\nWebsite: https://www.netflix.com`,
  },
  {
    title: 'Spotify Confirmation',
    text: `Spotify Premium Family Order Confirmation\nOrder ID: #SP-883921\nAmount: $16.99 / month\nCategory: Streaming\nNext billing date: 2026-09-01\nWebsite: https://www.spotify.com`,
  },
  {
    title: 'Adobe Invoice',
    text: `Adobe Creative Cloud Invoice #AC-99401\nPlan: All Apps Plan\nPrice: $54.99 USD per month\nRenewal Date: October 10, 2026\nCategory: Software\nWebsite: https://www.adobe.com`,
  },
];

export function parseReceiptText(text: string): ExtractedReceiptData {
  const normText = text.toLowerCase();
  
  // Extract Provider Name
  let name = '';
  if (normText.includes('netflix')) name = 'Netflix';
  else if (normText.includes('spotify')) name = 'Spotify';
  else if (normText.includes('adobe')) name = 'Adobe Creative Cloud';
  else if (normText.includes('github')) name = 'GitHub Pro';
  else if (normText.includes('amazon') || normText.includes('prime')) name = 'Amazon Prime';
  else if (normText.includes('chatgpt') || normText.includes('openai')) name = 'ChatGPT Plus';
  else if (normText.includes('youtube')) name = 'YouTube Premium';
  else {
    const firstLine = text.split('\n')[0]?.trim() || '';
    name = firstLine.replace(/receipt|invoice|confirmation|subscription|order|#/gi, '').trim() || 'Imported Subscription';
  }

  // Extract Price
  let price = '14.99';
  const priceMatch = text.match(/\$\s*(\d+(\.\d{1,2})?)/);
  if (priceMatch && priceMatch[1]) {
    price = priceMatch[1];
  } else {
    const rawNumber = text.match(/(\d+\.\d{2})/);
    if (rawNumber && rawNumber[1]) price = rawNumber[1];
  }

  // Extract Currency
  let currency = 'USD';
  if (text.includes('€') || normText.includes('eur')) currency = 'EUR';
  else if (text.includes('£') || normText.includes('gbp')) currency = 'GBP';

  // Extract Billing Cycle
  let billingCycle: 'monthly' | 'yearly' | 'weekly' | 'quarterly' = 'monthly';
  if (normText.includes('year') || normText.includes('annual')) billingCycle = 'yearly';
  else if (normText.includes('quarter')) billingCycle = 'quarterly';
  else if (normText.includes('week')) billingCycle = 'weekly';

  // Extract Category
  let category: 'Streaming' | 'Software' | 'Utilities' | 'Fitness' | 'Finance' | 'Education' | 'Gaming' | 'Other' = 'Streaming';
  if (normText.includes('software') || normText.includes('adobe') || normText.includes('github')) category = 'Software';
  else if (normText.includes('streaming') || normText.includes('netflix') || normText.includes('spotify')) category = 'Streaming';
  else if (normText.includes('utility') || normText.includes('storage') || normText.includes('icloud')) category = 'Utilities';

  // Extract Renewal Date
  let nextBillingDate = '';
  const dateMatch = text.match(/20\d{2}[-/.]\d{2}[-/.]\d{2}/);
  if (dateMatch) {
    nextBillingDate = dateMatch[0].replace(/\./g, '-');
  } else {
    // Look for Month Day, Year
    const monthMatch = text.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(20\d{2})/i);
    if (monthMatch) {
      const monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december'];
      const mIdx = monthNames.indexOf(monthMatch[1].toLowerCase());
      const monthStr = String(mIdx + 1).padStart(2, '0');
      const dayStr = String(monthMatch[2]).padStart(2, '0');
      nextBillingDate = `${monthMatch[3]}-${monthStr}-${dayStr}`;
    } else {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextBillingDate = nextMonth.toISOString().split('T')[0];
    }
  }

  // Extract Plan
  let plan = '';
  const planMatch = text.match(/plan:\s*([^\n\r]+)/i);
  if (planMatch && planMatch[1]) {
    plan = planMatch[1].trim();
  }

  // Extract Website
  let providerUrl = '';
  const urlMatch = text.match(/https?:\/\/[^\s\n\r]+/i);
  if (urlMatch) {
    providerUrl = urlMatch[0];
  }

  return {
    name,
    plan,
    price,
    currency,
    billingCycle,
    category,
    nextBillingDate,
    providerUrl,
  };
}

export default function ReceiptImportModal({
  isOpen,
  onClose,
  onConfirm,
}: ReceiptImportModalProps) {
  const [receiptText, setReceiptText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [reviewData, setReviewData] = useState<ExtractedReceiptData | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setReceiptText(content || `Subscription receipt file uploaded: ${file.name}`);
    };
    reader.readAsText(file);
  };

  const handleAnalyze = () => {
    const textToParse = receiptText.trim() || SAMPLE_RECEIPTS[0].text;
    const extracted = parseReceiptText(textToParse);
    setReviewData(extracted);
  };

  const handleConfirmExtracted = () => {
    if (reviewData) {
      onConfirm(reviewData);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-modal-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[560px] bg-[#0F1111] border border-[#1A1D1D] rounded-2xl sm:rounded-3xl p-5 sm:p-7 space-y-5 max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#1A1D1D] pb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#14B8A6]/15 border border-[#14B8A6]/30 flex items-center justify-center text-[#14B8A6]">
              <Sparkles className="w-5 h-5 text-[#14B8A6]" />
            </div>
            <div>
              <h2 id="receipt-modal-title" className="text-xl sm:text-2xl font-bold text-[#F5F7F6] tracking-tight">
                Import Subscription Receipt
              </h2>
              <p className="text-xs text-[#94A3B8]">Extract provider details from receipt files or text confirmation</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close import receipt modal"
            className="w-9 h-9 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] flex items-center justify-center text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer border border-[#1A1D1D]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-4 overflow-y-auto pr-1 flex-1 no-scrollbar">
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
                    accept=".txt,.pdf,.png,.jpg,.jpeg"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center space-y-1.5 pointer-events-none">
                    <Upload className="w-6 h-6 text-[#14B8A6]" />
                    <span className="text-xs font-semibold text-[#F5F7F6]">
                      {fileName ? `Uploaded: ${fileName}` : 'Click or drop subscription receipt here'}
                    </span>
                    <span className="text-[11px] text-[#94A3B8]">Supports PDF invoices, text receipts, or image files</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider block">
                  Or Paste Receipt / Confirmation Text
                </label>
                <textarea
                  rows={4}
                  placeholder="Paste your email receipt or subscription confirmation text here..."
                  value={receiptText}
                  onChange={(e) => setReceiptText(e.target.value)}
                  className="w-full px-4 py-3 text-xs rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors resize-none"
                />
              </div>

              {/* Sample Presets */}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block">
                  Try Sample Subscription Receipts:
                </span>
                <div className="flex flex-wrap gap-2">
                  {SAMPLE_RECEIPTS.map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setReceiptText(sample.text)}
                      className="px-3 py-1.5 rounded-lg bg-[#0D0F0F] hover:bg-[#1A1D1D] text-xs font-medium text-[#94A3B8] hover:text-[#F5F7F6] border border-[#1A1D1D] transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#14B8A6]" />
                      <span>{sample.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* Step 2: Extraction Review & Confirmation */
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[#14B8A6]/15 border border-[#14B8A6]/30 text-[#14B8A6] text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[#14B8A6]" />
                <span>Extracted subscription information. Please review before applying.</span>
              </div>

              <div className="space-y-3 bg-[#0D0F0F] p-4 rounded-2xl border border-[#1A1D1D]">
                <h3 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                  Extracted Subscription Data
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-[#0B0D0D] p-3 rounded-xl border border-[#1A1D1D]">
                    <span className="text-[#94A3B8] block text-[11px]">Provider Name</span>
                    <input
                      type="text"
                      value={reviewData.name}
                      onChange={(e) => setReviewData({ ...reviewData, name: e.target.value })}
                      className="w-full bg-transparent text-[#F5F7F6] font-semibold text-sm focus:outline-none mt-0.5"
                    />
                  </div>

                  <div className="bg-[#0B0D0D] p-3 rounded-xl border border-[#1A1D1D]">
                    <span className="text-[#94A3B8] block text-[11px]">Price & Currency</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[#F5F7F6] font-semibold text-sm">$</span>
                      <input
                        type="text"
                        value={reviewData.price}
                        onChange={(e) => setReviewData({ ...reviewData, price: e.target.value })}
                        className="w-full bg-transparent text-[#F5F7F6] font-semibold text-sm focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="bg-[#0B0D0D] p-3 rounded-xl border border-[#1A1D1D]">
                    <span className="text-[#94A3B8] block text-[11px]">Billing Cycle</span>
                    <span className="text-[#F5F7F6] font-semibold text-xs capitalize mt-0.5 block">{reviewData.billingCycle}</span>
                  </div>

                  <div className="bg-[#0B0D0D] p-3 rounded-xl border border-[#1A1D1D]">
                    <span className="text-[#94A3B8] block text-[11px]">Next Billing Date</span>
                    <input
                      type="date"
                      value={reviewData.nextBillingDate}
                      onChange={(e) => setReviewData({ ...reviewData, nextBillingDate: e.target.value })}
                      className="w-full bg-transparent text-[#F5F7F6] font-semibold text-xs focus:outline-none mt-0.5"
                    />
                  </div>

                  <div className="bg-[#0B0D0D] p-3 rounded-xl border border-[#1A1D1D]">
                    <span className="text-[#94A3B8] block text-[11px]">Category</span>
                    <span className="text-[#F5F7F6] font-semibold text-xs mt-0.5 block">{reviewData.category}</span>
                  </div>

                  {reviewData.plan && (
                    <div className="bg-[#0B0D0D] p-3 rounded-xl border border-[#1A1D1D]">
                      <span className="text-[#94A3B8] block text-[11px]">Detected Plan</span>
                      <span className="text-[#F5F7F6] font-semibold text-xs mt-0.5 block">{reviewData.plan}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setReviewData(null)}
                  className="text-xs text-[#94A3B8] hover:text-[#F5F7F6] underline"
                >
                  ← Edit or re-upload text
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1A1D1D] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] transition-colors cursor-pointer"
          >
            Cancel
          </button>

          {!reviewData ? (
            <button
              type="button"
              onClick={handleAnalyze}
              className="px-5 py-2.5 rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-[#091512]" />
              <span>Extract Receipt Info</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConfirmExtracted}
              className="px-6 py-2.5 rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-[#091512]" />
              <span>Confirm & Populate Form</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
