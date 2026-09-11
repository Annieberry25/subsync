import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Bills',
  description: 'Track and manage your utility and recurring bills with SubHalt.',
  alternates: { canonical: '/bills' },
};

export default function BillsPage() {
  redirect('/bills/pay');
}
