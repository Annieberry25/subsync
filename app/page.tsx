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

    // Verified from the cookie: the common case, and it costs no network.
    if (!error && data?.claims) return true;

    /*
     * Absent claims are not proof of an absent session.
     *
     * `getClaims()` can come back with no claims and no error when it cannot verify
     * the token — an unavailable signing key, a token it declines to read. That is
     * indistinguishable, from here, from a signed-out visitor, and treating it as
     * signed-out served the marketing page to people who were signed in.
     *
     * So only a positive claim is trusted. Everything else is settled against the
     * Auth server, which is slower and cannot be fooled by a cookie we failed to
     * read. The cost is one round trip for signed-out visitors; the alternative is
     * showing the wrong page to signed-in ones.
     */
    const { data: fallback, error: fallbackError } = await supabase.auth.getUser();
    if (fallbackError) throw fallbackError;
    return Boolean(fallback.user);
  } catch {
    // Only reached if the Auth server could not be reached either. The middleware
    // is the authority on who is allowed in; this only decides which page to draw.
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
