import { Suspense } from 'react';
import type { Metadata } from 'next';
import InboxDetailContent from '@/components/inbox/inbox-detail-content';

export const metadata: Metadata = {
  title: 'Message',
  description: 'View a subscription notification or message.',
  alternates: { canonical: '/inbox/[id]' },
};

export default function InboxDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <InboxDetailContent params={params} />
    </Suspense>
  );
}
