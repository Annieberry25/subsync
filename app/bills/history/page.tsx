import { Suspense } from 'react';
import type { Metadata } from 'next';
import BillsManager from '@/components/bills/bills-manager';

export const metadata: Metadata = {
  title: 'Payment History — Bills & Payments — SubHalt',
  description: 'Search, filter, and track all your recorded bill payments and receipts.',
};

export default function BillHistoryPage() {
  return (
    <Suspense fallback={null}>
      <BillsManager initialTab="history" />
    </Suspense>
  );
}
