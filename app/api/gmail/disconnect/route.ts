import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/access';
import { isFeatureEnabledForUser } from '@/lib/auth/feature-access';
import { disconnectGmail } from '@/lib/services/gmail-service';

export async function POST() {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized user session.' }, { status: 401 });
    }

    if (!(await isFeatureEnabledForUser(supabase, user.id, 'gmailConnect'))) {
      return NextResponse.json(
        { error: 'Gmail Connect is not available yet.' },
        { status: 403 }
      );
    }

    await disconnectGmail(user.id);
    return NextResponse.json({ connected: false });
  } catch (err) {
    console.error('[gmail/disconnect] unexpected error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}