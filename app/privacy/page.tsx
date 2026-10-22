import type { Metadata } from 'next';
import { MarketingPage, TYPE } from '@/components/marketing/marketing-page';
import { LegalDocument } from '@/components/marketing/legal-document';
import { BackButton } from '@/components/marketing/back-button';
import { LEGAL_LAST_UPDATED, PRIVACY_SECTIONS } from '@/lib/constants/legal';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '@/lib/constants/contact';

export const metadata: Metadata = {
  title: 'Privacy Policy | SubHalt',
  description:
    'How SubHalt collects, uses, stores, and protects your account, subscription, bill, and connected-inbox data.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPolicyPage() {
  return (
    <MarketingPage
      label="Legal"
      title="Privacy Policy"
      lead="What SubHalt collects, why it is needed, and the control you keep over your data."
      back={<BackButton />}
    >
      <LegalDocument updated={LEGAL_LAST_UPDATED} sections={PRIVACY_SECTIONS}>
        <section className="space-y-3">
          <h2 className={TYPE.h2}>12. Contact</h2>
          <p className={TYPE.body}>
            Questions or requests about your data:{' '}
            <a href={SUPPORT_MAILTO} className="text-[#14B8A6] hover:underline">
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </section>
      </LegalDocument>
    </MarketingPage>
  );
}
