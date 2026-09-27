import type { Metadata } from 'next';
import AdminIntegrationsTab from '@/components/admin/admin-integrations';

export const metadata: Metadata = {
  title: 'Admin Integrations',
  description: 'Integration health and usage counts.',
  robots: { index: false, follow: false },
};

export default function AdminIntegrationsPage() {
  return <AdminIntegrationsTab />;
}