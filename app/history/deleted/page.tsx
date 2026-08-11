import { Suspense } from 'react';
import HistoryPageContent from '@/components/history/history-page-content';

export default function HistoryDeletedPage() {
  return (
    <Suspense fallback={null}>
      <HistoryPageContent section="deleted" />
    </Suspense>
  );
}
