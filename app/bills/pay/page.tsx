import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import BillsManager from '@/components/bills/bills-manager';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/access';
import { isFeatureEnabledForUser } from '@/lib/auth/feature-access';

export const metadata: Metadata = {
  title: 'Pay a Bill | Bills & Payments | SubHalt',
  description: 'Pay utility bills, mobile data, internet, and recurring payments securely.',
};

export default async function PayABillPage() {
  /* Admin-only while Bills & Payments is in development — see FEATURE_FLAGS. */
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user || !(await isFeatureEnabledForUser(supabase, user.id, 'billsPayments'))) {
    redirect('/');
  }

  return (
    <Suspense fallback={null}>
      <BillsManager initialTab="pay" />
    </Suspense>
  );
}
