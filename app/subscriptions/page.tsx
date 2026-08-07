import { Suspense } from 'react';
import SubscriptionManager from '@/components/subscriptions/subscription-manager';

export default function SubscriptionsPage() {
  return (
    <Suspense fallback={null}>
      <SubscriptionManager />
    </Suspense>
  );
}
