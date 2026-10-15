import type { Metadata } from 'next';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import DashboardV2 from '@/components/dashboard/dashboard-v2';
import { LandingPage } from '@/components/landing/landing-page';
import { HOME_TITLE, HOME_DESCRIPTION } from '@/lib/seo/home-copy';

/**
 * `/` serves two audiences.
 *
 * Signed out, it is the public homepage. Signed in, it is the dashboard. The
 * decision is made on the server so the branch is taken before any HTML is sent,
 * which keeps a signed-in user from seeing the public page flash first.
 *
 * ## Why this is a boolean and not the user
 *
 * The branch only needs to know whether there is a session. Fetching the user to
 * find that out cost a round trip to the Auth server on every load of the
 * homepage.
 *
 * ## Why a failed check must never mean "signed out"
 *
 * This used to catch any failure and return null, which renders the marketing
 * page. So a transient network blip, a slow Auth server or a Supabase env problem
 * served the landing page *to a signed-in user*, inside a session they could not
 * sign out of. A page that cannot tell the difference between "nobody is signed
 * in" and "I could not check" must not assume the worst.
 *
 * `getClaims()` verifies the JWT against the cached signing keys, so it normally
 * answers from the cookie with no network at all. If verification itself fails,
 * that is not evidence of an absent session, so it falls back to the authoritative
 * network check rather than to the marketing page.
 *
 * Wrapped in React `cache` so `generateMetadata` and the page agree and cost one
 * check rather than two.
 */
const hasSession = cache(async (): Promise<boolean> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();

    if (error) {
      // Verification could not complete. Ask the Auth server directly.
      const { data: fallback, error: fallbackError } = await supabase.auth.getUser();
      if (fallbackError) throw fallbackError;
      return Boolean(fallback.user);
    }

    return Boolean(data?.claims);
  } catch {
    // Only reached if the fallback also failed. The middleware is the authority on
    // who is allowed in; this only decides which of the two pages to draw.
    return false;
  }
});

export async function generateMetadata(): Promise<Metadata> {
  if (await hasSession()) {
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
  const signedIn = await hasSession();

  if (!signedIn) return <LandingPage />;

  return <DashboardV2 />;
}
