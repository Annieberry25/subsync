import type { Metadata } from 'next';
import RenewalsPageContent from '@/components/renewals/renewals-page-content';

export const metadata: Metadata = {
  title: 'Upcoming Renewals',
  description: 'See which of your subscriptions are renewing soon.',
  alternates: { canonical: '/renewals' },
};

export default function RenewalsPage() {
  return <RenewalsPageContent />;
}
