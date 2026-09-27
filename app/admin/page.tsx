import type { Metadata } from 'next';
import AdminOverviewTab from '@/components/admin/admin-overview';

export const metadata: Metadata = {
  title: 'Admin Overview',
  description: 'SubHalt operations overview.',
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminOverviewTab />;
}