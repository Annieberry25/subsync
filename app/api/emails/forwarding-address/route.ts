import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/access';
import { getUserForwardingAddress } from '@/lib/services/receipt-ingestion';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized user session.' }, { status: 401 });
    }

    const address = await getUserForwardingAddress(user.id);
    if (!address) {
      return NextResponse.json(
        { error: 'Email forwarding is not configured yet.' },
        { status: 503 }
      );
    }
    return NextResponse.json({ address });
  } catch (err) {
    console.error('[emails/forwarding-address] unexpected error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}