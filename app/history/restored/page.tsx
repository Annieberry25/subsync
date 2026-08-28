import { Suspense } from 'react';
import type { Metadata } from 'next';
import HistoryPageContent from '@/components/history/history-page-content';

export const metadata: Metadata = {
  title: 'Restored',
  description: 'Subscriptions and activity you\'ve restored.',
  alternates: { canonical: '/history/restored' },
};

export default function HistoryRestoredPage() {
  return (
    <Suspense fallback={null}>
      <HistoryPageContent section="restored" />
    </Suspense>
  );
}
