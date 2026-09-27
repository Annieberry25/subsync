import type { Metadata } from 'next';
import AdminProvidersTab from '@/components/admin/admin-providers';

export const metadata: Metadata = {
  title: 'Admin Providers',
  description: 'Manage the bill providers catalog.',
  robots: { index: false, follow: false },
};

export default function AdminProvidersPage() {
  return <AdminProvidersTab />;
}