import type { Metadata } from 'next';
import AdminPaymentsTab from '@/components/admin/admin-payments';

export const metadata: Metadata = {
  title: 'Admin Payments',
  description: 'Plan subscriptions and payment ledger.',
  robots: { index: false, follow: false },
};

export default function AdminPaymentsPage() {
  return <AdminPaymentsTab />;
}