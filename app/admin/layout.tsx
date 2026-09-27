import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isAdminUser } from '@/lib/auth/access';
import AdminShell from '@/components/admin/admin-shell';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const isAdmin = await isAdminUser(supabase);
  if (!isAdmin) {
    redirect('/');
    return null;
  }

  return <AdminShell>{children}</AdminShell>;
}