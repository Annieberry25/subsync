import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import DashboardV2 from '@/components/dashboard/dashboard-v2';
import { LandingPage } from '@/components/landing/landing-page';

/**
 * `/` serves two audiences.
 *
 * Signed out, it is the marketing landing page. Signed in, it is the dashboard.
 * The session is read on the server so the choice is made before any HTML is
 * sent, which keeps a signed-in user from ever seeing the landing page flash
 * before the app replaces it.
 */
async function getUser() {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data.user;
  } catch {
    // A Supabase env problem must not take the marketing page down with it.
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const user = await getUser();

  if (user) {
    return {
      title: 'Dashboard',
      description:
        'Your subscription and bill overview at a glance. Track renewals, spending, and upcoming costs.',
      alternates: { canonical: '/' },
    };
  }

  return {
    title: 'SubHalt — know what renews before it renews',
    description:
      'SubHalt tracks your subscriptions and bills in one place, shows what renews next, and reminds you before you get charged.',
    alternates: { canonical: '/' },
  };
}

export default async function RootPage() {
  const user = await getUser();

  if (!user) return <LandingPage />;

  return <DashboardV2 />;
}
