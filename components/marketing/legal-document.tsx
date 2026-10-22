import type { ReactNode } from 'react';
import { TYPE } from './marketing-page';
import type { LegalSection } from '@/lib/constants/legal';

export type { LegalSection } from '@/lib/constants/legal';

/**
 * Shared body for the public legal pages.
 *
 * Privacy and Terms differ only in copy, so the type scale, reading measure and
 * section rhythm live here rather than being duplicated in both routes.
 */
export function LegalDocument({
  updated,
  sections,
  children,
}: {
  updated: string;
  sections: LegalSection[];
  children?: ReactNode;
}) {
  return (
    <div className="mt-10 max-w-[68ch] space-y-8">
      <p className={`${TYPE.meta} uppercase tracking-wider`}>Last updated: {updated}</p>

      {sections.map((section) => (
        <section key={section.heading} className="space-y-3">
          <h2 className={TYPE.h2}>{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className={TYPE.body}>
              {paragraph}
            </p>
          ))}
        </section>
      ))}

      {children}
    </div>
  );
}
