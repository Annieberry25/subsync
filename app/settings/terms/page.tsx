import type { Metadata } from 'next';
import { SettingsLegalPage } from '@/components/settings/legal-page';
import { TERMS_SECTIONS } from '@/lib/constants/legal';

export const metadata: Metadata = {
  title: 'Terms of Service | SubHalt',
  robots: { index: false, follow: false },
};

export default function SettingsTermsOfServicePage() {
  return (
    <SettingsLegalPage
      title="Terms of Service"
      lead="The rules that apply when you use SubHalt, in plain language."
      sections={TERMS_SECTIONS}
      contactHeading="13. Contact"
      contactLead="Questions about these terms:"
    />
  );
}
