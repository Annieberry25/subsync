import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSiteUrl, getSafeRedirectUrl } from '@/lib/utils/url-utils';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const nextParam = requestUrl.searchParams.get('next');
  const safePath = getSafeRedirectUrl(nextParam);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host');
      const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
      const isLocalEnv = process.env.NODE_ENV === 'development';

      if (isLocalEnv) {
        return NextResponse.redirect(new URL(safePath, requestUrl.origin));
      } else if (forwardedHost) {
        return NextResponse.redirect(`${forwardedProto}://${forwardedHost}${safePath}`);
      } else {
        return NextResponse.redirect(new URL(safePath, getSiteUrl()));
      }
    }
  }

  return NextResponse.redirect(new URL('/login?error=Could%20not%20authenticate', getSiteUrl()));
}
