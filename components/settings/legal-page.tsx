import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { LegalDocument } from '@/components/marketing/legal-document';
import { TYPE } from '@/components/marketing/marketing-page';
import { LEGAL_LAST_UPDATED, type LegalSection } from '@/lib/constants/legal';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '@/lib/constants/contact';

/**
 * In-app version of a legal document.
 *
 * Opened from Settings, so it keeps the app shell and returns to the Help &
 * Legal section instead of rendering the public marketing header/footer.
 */
export function SettingsLegalPage({
  title,
  lead,
  sections,
  contactHeading,
  contactLead,
}: {
  title: string;
  lead: string;
  sections: LegalSection[];
  contactHeading: string;
  contactLead: string;
}) {
  return (
    <div className="space-y-6 max-w-3xl min-h-[85dvh] animate-fade-in text-[#F5F7F6]">
      <div>
        <div className="flex items-center gap-1.5">
          <Link
            href="/settings?section=help"
            aria-label="Back to Settings"
            className="-ml-2 flex h-9 w-9 items-center justify-center text-[#94A3B8] hover:text-[#F5F7F6] transition-colors"
          >
            <ChevronLeft className="h-6 w-6" aria-hidden="true" />
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h1>
        </div>
        <p className="text-xs sm:text-sm text-[#94A3B8] mt-1 max-w-2xl">{lead}</p>
      </div>

      <LegalDocument updated={LEGAL_LAST_UPDATED} sections={sections}>
        <section className="space-y-3">
          <h2 className={TYPE.h2}>{contactHeading}</h2>
          <p className={TYPE.body}>
            {contactLead}{' '}
            <a href={SUPPORT_MAILTO} className="text-[#14B8A6] hover:underline">
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </section>
      </LegalDocument>
    </div>
  );
}
