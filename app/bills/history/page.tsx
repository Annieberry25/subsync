import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import BillsManager from '@/components/bills/bills-manager';
import { BILL_PAYMENT_ENABLED } from '@/lib/config/feature-flags';

export const metadata: Metadata = {
  title: 'Payment History — Bills & Payments — SubHalt',
  description: 'Search, filter, and track all your recorded bill payments and receipts.',
};

export default function BillHistoryPage() {
  if (!BILL_PAYMENT_ENABLED) redirect('/');
  return (
    <Suspense fallback={null}>
      <BillsManager initialTab="history" />
    </Suspense>
  );
}
