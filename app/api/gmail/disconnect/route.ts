import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/access';
import { disconnectGmail } from '@/lib/services/gmail-service';

export async function POST() {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized user session.' }, { status: 401 });
    }

    await disconnectGmail(user.id);
    return NextResponse.json({ connected: false });
  } catch (err) {
    console.error('[gmail/disconnect] unexpected error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}