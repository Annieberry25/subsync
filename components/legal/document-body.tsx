'use client';

export type LegalDocumentType = 'privacy' | 'terms';

interface LegalDocumentBodyProps {
  type: LegalDocumentType;
}

/**
 * The Privacy Policy and Terms of Service copy.
 *
 * Extracted so the signed-in Legal sheet and the public `/privacy` and `/terms`
 * pages cannot drift apart. A marketing footer links to these as a matter of
 * course, and having the text trapped inside an authenticated modal meant the
 * one place a visitor is most likely to look for it was the one place they
 * could not reach.
 */
export function LegalDocumentBody({ type }: LegalDocumentBodyProps) {
  if (type === 'privacy') {
    return (
      <div className="space-y-4 text-sm text-[#94A3B8] leading-relaxed">
        <p className="font-medium text-[#F5F7F6]">Last updated: August 2026</p>
        <p>
          SubHalt is committed to protecting your privacy and security. This Privacy Policy
          outlines how your personal data and subscription metrics are collected, processed, and
          safeguarded.
        </p>
        <h2 className="pt-2 text-sm font-semibold text-[#F5F7F6]">
          1. Data Storage &amp; Isolation
        </h2>
        <p>
          Your subscription data, payment amounts, billing cycles, and personal details are
          strictly isolated to your user account using PostgreSQL Row Level Security (RLS). We do
          not sell or monetize your financial tracking data.
        </p>
        <h2 className="pt-2 text-sm font-semibold text-[#F5F7F6]">
          2. External Services &amp; Exchange Rates
        </h2>
        <p>
          SubHalt fetches currency exchange rate information from trusted public providers to enable
          default currency reporting. No personal identifiers or subscription details are
          transmitted to currency rate services.
        </p>
        <h2 className="pt-2 text-sm font-semibold text-[#F5F7F6]">
          3. User Rights &amp; Account Deletion
        </h2>
        <p>
          You retain full ownership of your data. You may export or permanently delete your account
          and all associated records at any time directly through your Account Settings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-sm text-[#94A3B8] leading-relaxed">
      <p className="font-medium text-[#F5F7F6]">Last updated: August 2026</p>
      <p>
        By using SubHalt, you agree to these Terms of Service. SubHalt is a personal subscription
        management platform designed to help you track recurring expenses and billing dates.
      </p>
      <h2 className="pt-2 text-sm font-semibold text-[#F5F7F6]">1. Usage Responsibility</h2>
      <p>
        SubHalt relies on subscription entries provided by you or extracted from user receipts. You
        are responsible for ensuring the accuracy of your entered subscription amounts, renewal
        dates, and account details.
      </p>
      <h2 className="pt-2 text-sm font-semibold text-[#F5F7F6]">2. Financial Disclaimer</h2>
      <p>
        Calculated metrics and currency conversions are provided for informational tracking
        purposes. SubHalt is not a financial institution, automated billing processor, or legal
        advisor.
      </p>
      <h2 className="pt-2 text-sm font-semibold text-[#F5F7F6]">3. Service Availability</h2>
      <p>
        We strive to maintain continuous service availability and cloud data synchronization.
        Features may be updated continuously to improve usability and security.
      </p>
    </div>
  );
}

export default LegalDocumentBody;