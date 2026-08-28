import { Suspense } from 'react';
import type { Metadata } from 'next';
import BillsManager from '@/components/bills/bills-manager';

export const metadata: Metadata = {
  title: 'Bills',
  description: 'Track and manage your utility and recurring bills with SubHalt.',
  alternates: { canonical: '/bills' },
};

export default function BillsPage() {
  return (
    <Suspense fallback={null}>
      <BillsManager />
    </Suspense>
  );
}
