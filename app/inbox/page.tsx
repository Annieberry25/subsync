import { Suspense } from 'react';
import type { Metadata } from 'next';
import InboxPageContent from '@/components/inbox/inbox-page-content';

export const metadata: Metadata = {
  title: 'Inbox',
  description: 'Notifications about your subscriptions, renewals, and plan updates.',
  alternates: { canonical: '/inbox' },
};

export default function InboxPage() {
  return (
    <Suspense fallback={null}>
      <InboxPageContent />
    </Suspense>
  );
}
