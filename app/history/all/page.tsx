import { Suspense } from 'react';
import HistoryPageContent from '@/components/history/history-page-content';

export default function HistoryAllActivityPage() {
  return (
    <Suspense fallback={null}>
      <HistoryPageContent section="all" />
    </Suspense>
  );
}
