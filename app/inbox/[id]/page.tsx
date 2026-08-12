import { Suspense } from 'react';
import InboxDetailContent from '@/components/inbox/inbox-detail-content';

export default function InboxDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <InboxDetailContent params={params} />
    </Suspense>
  );
}
