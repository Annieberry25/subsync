import type { Metadata } from 'next';
import DashboardV2 from '@/components/dashboard/dashboard-v2';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Your subscription and bill overview at a glance. Track renewals, spending, and upcoming costs.',
  alternates: { canonical: '/' },
};

export default function DashboardPage() {
  return <DashboardV2 />;
}

