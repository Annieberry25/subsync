import { Suspense } from 'react';
import HistoryPageContent from '@/components/history/history-page-content';

export default function HistoryArchivePage() {
  return (
    <Suspense fallback={null}>
      <HistoryPageContent section="archive" />
    </Suspense>
  );
}
