import { Suspense } from 'react';
import type { Metadata } from 'next';
import HistoryPageContent from '@/components/history/history-page-content';

export const metadata: Metadata = {
  title: 'Deleted',
  description: 'Deleted subscriptions and activity.',
  alternates: { canonical: '/history/deleted' },
};

export default function HistoryDeletedPage() {
  return (
    <Suspense fallback={null}>
      <HistoryPageContent section="deleted" />
    </Suspense>
  );
}
