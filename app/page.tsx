import type { Metadata } from 'next';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import DashboardV2 from '@/components/dashboard/dashboard-v2';
import { MinimalHome } from '@/components/home/minimal-home';
import { HOME_TITLE, HOME_DESCRIPTION } from '@/lib/seo/home-copy';

/**
 * `/` serves two audiences.
 *
 * Signed out, it is the public homepage. Signed in, it is the dashboard. The
 * session is read on the server so the branch is decided before any HTML is
 * sent, which keeps a signed-in user from seeing the public page flash first.
 *
 * Wrapped in React `cache` so `generateMetadata` and the page share one
 * Supabase round trip instead of two on every request.
 */
const getUser = cache(async () => {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data.user;
  } catch {
    // A Supabase env problem must not take the public homepage down with it.
    return null;
  }
});

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
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    alternates: { canonical: '/' },
  };
}

export default async function RootPage() {
  const user = await getUser();

  if (!user) return <MinimalHome />;

  return <DashboardV2 />;
}
