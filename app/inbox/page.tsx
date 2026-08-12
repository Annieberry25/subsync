import { Suspense } from 'react';
import InboxPageContent from '@/components/inbox/inbox-page-content';

export default function InboxPage() {
  return (
    <Suspense fallback={null}>
      <InboxPageContent />
    </Suspense>
  );
}
