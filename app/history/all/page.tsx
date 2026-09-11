import { Suspense } from 'react';
import type { Metadata } from 'next';
import HistoryPageContent from '@/components/history/history-page-content';

export const metadata: Metadata = {
  title: 'All Activity',
  description: 'Full subscription and bill activity history.',
  alternates: { canonical: '/history/all' },
};

export default function HistoryAllActivityPage() {
  return (
    <Suspense fallback={null}>
      <HistoryPageContent section="all" />
    </Suspense>
  );
}
