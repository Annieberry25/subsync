'use client';

import { X, ShieldCheck, FileText } from 'lucide-react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'privacy' | 'terms' | null;
}

export function LegalModal({ isOpen, onClose, type }: LegalModalProps) {
  if (!isOpen || !type) return null;

  const isPrivacy = type === 'privacy';
  const title = isPrivacy ? 'Privacy Policy' : 'Terms of Service';
  const Icon = isPrivacy ? ShieldCheck : FileText;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-[#171A21] border border-[#2B313D] rounded-[24px] overflow-hidden shadow-2xl space-y-0">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#2B313D] flex items-center justify-between bg-[#1D222B]">
          <div className="flex items-center gap-3">
            <Icon className="w-5 h-5 text-[#4F46E5]" />
            <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#6F7787] hover:text-white hover:bg-[#2B313D] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4 text-xs sm:text-sm text-[#A1AAB8] leading-relaxed">
          {isPrivacy ? (
            <>
              <p className="font-medium text-white">Last updated: August 2026</p>
              <p>
                SubSync is committed to protecting your privacy and security. This Privacy Policy outlines how your personal data and subscription metrics are collected, processed, and safeguarded.
              </p>
              <h3 className="text-white font-semibold text-sm pt-2">1. Data Storage & Isolation</h3>
              <p>
                Your subscription data, payment amounts, billing cycles, and personal details are strictly isolated to your user account using PostgreSQL Row Level Security (RLS). We do not sell or monetize your financial tracking data.
              </p>
              <h3 className="text-white font-semibold text-sm pt-2">2. External Services & Exchange Rates</h3>
              <p>
                SubSync fetches currency exchange rate information from trusted public providers to enable default currency reporting. No personal identifiers or subscription details are transmitted to currency rate services.
              </p>
              <h3 className="text-white font-semibold text-sm pt-2">3. User Rights & Account Deletion</h3>
              <p>
                You retain full ownership of your data. You may export or permanently delete your account and all associated records at any time directly through your Account Settings.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium text-white">Last updated: August 2026</p>
              <p>
                By using SubSync, you agree to these Terms of Service. SubSync is a personal subscription management platform designed to help you track recurring expenses and billing dates.
              </p>
              <h3 className="text-white font-semibold text-sm pt-2">1. Usage Responsibility</h3>
              <p>
                SubSync relies on subscription entries provided by you or extracted from user receipts. You are responsible for ensuring the accuracy of your entered subscription amounts, renewal dates, and account details.
              </p>
              <h3 className="text-white font-semibold text-sm pt-2">2. Financial Disclaimer</h3>
              <p>
                Calculated metrics and currency conversions are provided for informational tracking purposes. SubSync is not a financial institution, automated billing processor, or legal advisor.
              </p>
              <h3 className="text-white font-semibold text-sm pt-2">3. Service Availability</h3>
              <p>
                We strive to maintain continuous service availability and cloud data synchronization. Features may be updated continuously to improve usability and security.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#2B313D] bg-[#1D222B] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Close Document
          </button>
        </div>
      </div>
    </div>
  );
}
