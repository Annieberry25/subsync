import type { Metadata } from 'next';
import { MarketingPage, TYPE } from '@/components/marketing/marketing-page';
import { LegalDocument } from '@/components/marketing/legal-document';
import { BackButton } from '@/components/marketing/back-button';
import { LEGAL_LAST_UPDATED, TERMS_SECTIONS } from '@/lib/constants/legal';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '@/lib/constants/contact';

export const metadata: Metadata = {
  title: 'Terms of Service | SubHalt',
  description:
    'The terms that govern your use of SubHalt, including accounts, plans, acceptable use, and data ownership.',
  alternates: { canonical: '/terms' },
};

export default function TermsOfServicePage() {
  return (
    <MarketingPage
      label="Legal"
      title="Terms of Service"
      lead="The rules that apply when you use SubHalt, in plain language."
      back={<BackButton />}
    >
      <LegalDocument updated={LEGAL_LAST_UPDATED} sections={TERMS_SECTIONS}>
        <section className="space-y-3">
          <h2 className={TYPE.h2}>13. Contact</h2>
          <p className={TYPE.body}>
            Questions about these terms:{' '}
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
