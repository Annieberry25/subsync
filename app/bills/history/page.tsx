import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import BillsManager from '@/components/bills/bills-manager';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/access';
import { isFeatureEnabledForUser } from '@/lib/auth/feature-access';

export const metadata: Metadata = {
  title: 'Payment History | Bills & Payments | SubHalt',
  description: 'Search, filter, and track all your recorded bill payments and receipts.',
};

export default async function BillHistoryPage() {
  /* Admin-only while Bills & Payments is in development — see FEATURE_FLAGS. */
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user || !(await isFeatureEnabledForUser(supabase, user.id, 'billsPayments'))) {
    redirect('/');
  }

  return (
    <Suspense fallback={null}>
      <BillsManager initialTab="history" />
    </Suspense>
  );
}
