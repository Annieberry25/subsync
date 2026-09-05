import { Suspense } from 'react';
import type { Metadata } from 'next';
import BillsManager from '@/components/bills/bills-manager';

export const metadata: Metadata = {
  title: 'Pay a Bill — Bills & Payments — SubHalt',
  description: 'Pay utility bills, mobile data, internet, and recurring payments securely.',
};

export default function PayABillPage() {
  return (
    <Suspense fallback={null}>
      <BillsManager initialTab="pay" />
    </Suspense>
  );
}
