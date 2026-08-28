'use client';

import SectionError from '@/components/ui/section-error';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <SectionError error={error} reset={reset} label="Bills" />;
}
