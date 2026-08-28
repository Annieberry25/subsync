import { Suspense } from 'react';
import type { Metadata } from 'next';
import HistoryPageContent from '@/components/history/history-page-content';

export const metadata: Metadata = {
  title: 'Archived',
  description: 'Archived subscriptions and activity.',
  alternates: { canonical: '/history/archive' },
};

export default function HistoryArchivePage() {
  return (
    <Suspense fallback={null}>
      <HistoryPageContent section="archive" />
    </Suspense>
  );
}
