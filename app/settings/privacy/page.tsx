import type { Metadata } from 'next';
import { SettingsLegalPage } from '@/components/settings/legal-page';
import { PRIVACY_SECTIONS } from '@/lib/constants/legal';

export const metadata: Metadata = {
  title: 'Privacy Policy | SubHalt',
  robots: { index: false, follow: false },
};

export default function SettingsPrivacyPolicyPage() {
  return (
    <SettingsLegalPage
      title="Privacy Policy"
      lead="What SubHalt collects, why it is needed, and the control you keep over your data."
      sections={PRIVACY_SECTIONS}
      contactHeading="12. Contact"
      contactLead="Questions or requests about your data:"
    />
  );
}
