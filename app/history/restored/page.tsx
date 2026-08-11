import { Suspense } from 'react';
import HistoryPageContent from '@/components/history/history-page-content';

export default function HistoryRestoredPage() {
  return (
    <Suspense fallback={null}>
      <HistoryPageContent section="restored" />
    </Suspense>
  );
}
