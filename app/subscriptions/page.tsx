import { Suspense } from 'react';
import type { Metadata } from 'next';
import SubscriptionManager from '@/components/subscriptions/subscription-manager';

export const metadata: Metadata = {
  title: 'Subscriptions',
  description: 'Manage all your recurring subscriptions, renewals, and payments in one place.',
  alternates: { canonical: '/subscriptions' },
};

export default function SubscriptionsPage() {
  return (
    <Suspense fallback={null}>
      <SubscriptionManager />
    </Suspense>
  );
}
