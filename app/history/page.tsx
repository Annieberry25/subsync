import { Suspense } from 'react';
import type { Metadata } from 'next';
import HistoryPageContent from '@/components/history/history-page-content';

export const metadata: Metadata = {
  title: 'History',
  description: 'Your subscription and bill activity history.',
  alternates: { canonical: '/history' },
};

export default function HistoryPage() {
  return (
    <Suspense fallback={null}>
      <HistoryPageContent section="all" />
    </Suspense>
  );
}
