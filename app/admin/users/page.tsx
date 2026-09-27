import type { Metadata } from 'next';
import AdminUsersTab from '@/components/admin/admin-users';

export const metadata: Metadata = {
  title: 'Admin Users',
  description: 'Manage SubHalt users and roles.',
  robots: { index: false, follow: false },
};

export default function AdminUsersPage() {
  return <AdminUsersTab />;
}