import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/access';
import { isFeatureEnabledForUser } from '@/lib/auth/feature-access';

export const metadata: Metadata = {
  title: 'Bills',
  description: 'Track and manage your utility and recurring bills with SubHalt.',
  alternates: { canonical: '/bills' },
};

export default async function BillsPage() {
  /* Bills & Payments is admin-only while it is in development. The nav hides
     it too, but the route has to check as well: a saved link would otherwise
     still open the page. */
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user || !(await isFeatureEnabledForUser(supabase, user.id, 'billsPayments'))) {
    redirect('/');
  }
  redirect('/bills/pay');
}
