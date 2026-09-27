import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { BILL_PAYMENT_ENABLED } from '@/lib/config/feature-flags';

export const metadata: Metadata = {
  title: 'Bills',
  description: 'Track and manage your utility and recurring bills with SubHalt.',
  alternates: { canonical: '/bills' },
};

export default function BillsPage() {
  if (!BILL_PAYMENT_ENABLED) redirect('/');
  redirect('/bills/pay');
}
