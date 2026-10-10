import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import BillsManager from '@/components/bills/bills-manager';
import { BILL_PAYMENT_ENABLED } from '@/lib/config/feature-flags';

export const metadata: Metadata = {
  title: 'Pay a Bill | Bills & Payments | SubHalt',
  description: 'Pay utility bills, mobile data, internet, and recurring payments securely.',
};

export default function PayABillPage() {
  if (!BILL_PAYMENT_ENABLED) redirect('/');
  return (
    <Suspense fallback={null}>
      <BillsManager initialTab="pay" />
    </Suspense>
  );
}
