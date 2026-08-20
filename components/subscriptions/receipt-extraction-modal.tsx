'use client';

import React, { useState } from 'react';
import { X, UploadCloud, FileText, CheckCircle2, Sparkles, AlertCircle, ArrowRight } from 'lucide-react';
import { useUserSettings } from '@/lib/contexts/user-settings-context';
import { useInbox } from '@/lib/contexts/inbox-context';
import { createSubscription } from '@/lib/services/subscription-service';
import { useToast } from '@/lib/hooks/use-toast';

interface ReceiptExtractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ExtractedReceiptData {
  merchant: string;
  subscriptionName: string;
  amount: number;
  currency: string;
  billingFrequency: 'monthly' | 'yearly' | 'quarterly';
  renewalDate: string;
  category: string;
}

const SAMPLE_EXTRACTED: ExtractedReceiptData = {
  merchant: 'Midjourney Inc.',
  subscriptionName: 'Midjourney Standard Plan',
  amount: 30.0,
  currency: 'USD',
  billingFrequency: 'monthly',
  renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  category: 'Software',
};

export function ReceiptExtractionModal({ isOpen, onClose, onSuccess }: ReceiptExtractionModalProps) {
  const { defaultCurrency, allCategories } = useUserSettings();
  const { addInboxItem } = useInbox();
  const { toast } = useToast();

  const [step, setStep] = useState<'upload' | 'extracting' | 'review'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [formData, setFormData] = useState<ExtractedReceiptData>(SAMPLE_EXTRACTED);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSimulateUpload = (selectedFile?: File) => {
    if (selectedFile) setFile(selectedFile);
    setStep('extracting');
    setTimeout(() => {
      setStep('review');
    }, 1500);
  };

  const handleSaveSubscription = async () => {
    setSaving(true);

    const today = new Date().toISOString().split('T')[0];

    const { error } = await createSubscription({
      name: formData.subscriptionName || formData.merchant,
      price: formData.amount,
      currency: formData.currency,
      billing_cycle: formData.billingFrequency,
      category: formData.category as any,
      next_billing_date: formData.renewalDate,
      start_date: today,
      status: 'active',
      notes: `[AttachedReceipts: ${JSON.stringify([{ fileName: file?.name || 'receipt_sample.pdf', uploadDate: today, price: formData.amount, currency: formData.currency, provider: formData.merchant }])}]`,
    });

    setSaving(false);

    if (error) {
      toast.error('Failed to save extracted subscription.', 'Error');
    } else {
      addInboxItem({
        type: 'plan_update',
        title: 'New Subscription Extracted from Receipt',
        description: `SubHalt AI extracted "${formData.subscriptionName}" ($${formData.amount.toFixed(2)}/mo) from your uploaded receipt.`,
        subscriptionName: formData.subscriptionName,
        subscriptionPrice: formData.amount,
        currency: formData.currency,
        actionType: 'view',
        actionLabel: 'View Subscription',
      });

      toast.success(`Saved "${formData.subscriptionName}" to subscriptions.`, 'AI Extraction Success');
      onSuccess?.();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-[#0B0D0D] border border-[#1A1D1D] rounded-2xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#1A1D1D] flex items-center justify-between bg-[#000000]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#14B8A6]/10 border border-[#14B8A6]/30 flex items-center justify-center text-[#14B8A6]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#F5F7F6] tracking-tight">
                Receipt AI Extraction
              </h3>
              <p className="text-[11px] text-[#94A3B8]">
                Upload Invoice or Billing Receipt
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] transition-colors flex items-center justify-center cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 sm:p-6 space-y-5">
          {step === 'upload' && (
            <div className="space-y-4">
              {/* Dropzone */}
              <div
                onClick={() => handleSimulateUpload()}
                className="p-8 border-2 border-dashed border-[#1A1D1D] hover:border-[#14B8A6]/60 bg-[#121414] rounded-2xl text-center space-y-3 cursor-pointer transition-colors group"
              >
                <div className="w-12 h-12 rounded-full bg-[#1A1D1D] group-hover:bg-[#14B8A6]/10 text-[#94A3B8] group-hover:text-[#14B8A6] border border-[#3F3F46]/40 flex items-center justify-center mx-auto transition-colors">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[#F5F7F6]">
                    Drop receipt here or click to browse
                  </p>
                  <p className="text-[11px] text-[#94A3B8]">
                    Supports PDF, PNG, JPG, or email invoice receipts
                  </p>
                </div>
              </div>

              {/* Sample Receipt Quick Action for demo */}
              <div className="p-3 rounded-xl bg-[#0F1111] border border-[#1A1D1D] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-[#14B8A6]" />
                  <span className="text-xs text-[#94A3B8]">Test with sample receipt (Midjourney invoice)</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleSimulateUpload()}
                  className="px-3 py-1.5 rounded-lg bg-[#14B8A6]/10 text-[#14B8A6] border border-[#14B8A6]/20 text-xs font-medium hover:bg-[#14B8A6]/20 transition-colors cursor-pointer"
                >
                  Run Demo
                </button>
              </div>
            </div>
          )}

          {step === 'extracting' && (
            <div className="py-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-[#14B8A6]/10 border border-[#14B8A6]/30 flex items-center justify-center text-[#14B8A6] mx-auto animate-pulse">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-[#F5F7F6]">
                  Analyzing Receipt Document...
                </h4>
                <p className="text-xs text-[#94A3B8]">
                  SubHalt AI is extracting merchant details, pricing, frequency, and renewal dates.
                </p>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-[#14B8A6] font-medium bg-[#14B8A6]/10 p-2.5 rounded-xl border border-[#14B8A6]/20">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>AI extracted details ready for review before saving:</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[#94A3B8] block mb-1 font-medium">Merchant / Service</label>
                  <input
                    type="text"
                    value={formData.merchant}
                    onChange={(e) => setFormData({ ...formData, merchant: e.target.value })}
                    className="w-full bg-[#121414] border border-[#1A1D1D] rounded-xl px-3 py-2 text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6]"
                  />
                </div>

                <div>
                  <label className="text-[#94A3B8] block mb-1 font-medium">Subscription Name</label>
                  <input
                    type="text"
                    value={formData.subscriptionName}
                    onChange={(e) => setFormData({ ...formData, subscriptionName: e.target.value })}
                    className="w-full bg-[#121414] border border-[#1A1D1D] rounded-xl px-3 py-2 text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6]"
                  />
                </div>

                <div>
                  <label className="text-[#94A3B8] block mb-1 font-medium">Amount & Currency</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-[#121414] border border-[#1A1D1D] rounded-xl px-3 py-2 text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6]"
                    />
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className="bg-[#121414] border border-[#1A1D1D] rounded-xl px-2 py-2 text-[#F5F7F6] focus:outline-none"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="CAD">CAD</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[#94A3B8] block mb-1 font-medium">Billing Frequency</label>
                  <select
                    value={formData.billingFrequency}
                    onChange={(e) => setFormData({ ...formData, billingFrequency: e.target.value as any })}
                    className="w-full bg-[#121414] border border-[#1A1D1D] rounded-xl px-3 py-2 text-[#F5F7F6] focus:outline-none"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                </div>

                <div>
                  <label className="text-[#94A3B8] block mb-1 font-medium">Renewal Date</label>
                  <input
                    type="date"
                    value={formData.renewalDate}
                    onChange={(e) => setFormData({ ...formData, renewalDate: e.target.value })}
                    className="w-full bg-[#121414] border border-[#1A1D1D] rounded-xl px-3 py-2 text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6]"
                  />
                </div>

                <div>
                  <label className="text-[#94A3B8] block mb-1 font-medium">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-[#121414] border border-[#1A1D1D] rounded-xl px-3 py-2 text-[#F5F7F6] focus:outline-none"
                  >
                    {allCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-[#1A1D1D]">
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="px-4 py-2.5 rounded-xl bg-[#1A1D1D] hover:bg-[#262929] text-[#94A3B8] hover:text-[#F5F7F6] text-xs font-medium transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSaveSubscription}
                  disabled={saving}
                  className="px-4 py-2.5 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-[#091512] font-semibold text-xs transition-colors flex items-center gap-2 cursor-pointer"
                >
                  {saving ? <span>Saving...</span> : <span>Save to SubHalt</span>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
