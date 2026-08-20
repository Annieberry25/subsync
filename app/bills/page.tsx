import { Suspense } from 'react';
import type { Metadata } from 'next';
import BillsManager from '@/components/bills/bills-manager';

export const metadata: Metadata = {
  title: 'Bills & Payments — SubHalt',
  description: 'Track, organize, and analyze utility bills, mobile data, rent, and custom recurring payments in SubHalt.',
};

export default function BillsPage() {
  return (
    <Suspense fallback={null}>
      <BillsManager />
    </Suspense>
  );
}
