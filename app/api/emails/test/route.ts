import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/access';
import { getUserForwardingAddress } from '@/lib/services/receipt-ingestion';
import { processInboundReceiptWithSelfTest } from '@/lib/services/inbound-email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SAMPLE_RECEIPT = `netflix
Your monthly subscription has been renewed for $15.49.
Next billing date: December 15, 2026.
This charge will appear on your statement as NETFLIX.COM.`;

/**
 * Authenticated self-test: sends a sample receipt through the real inbound
 * pipeline so signup can validate forwarding without waiting for a live email.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized user session.' }, { status: 401 });
    }

    const address = await getUserForwardingAddress(user.id);
    if (!address) {
      return NextResponse.json({ error: 'Email forwarding is not configured yet.' }, { status: 503 });
    }

    const result = await processInboundReceiptWithSelfTest(address, SAMPLE_RECEIPT);
    if (result.status === 'not_configured') {
      return NextResponse.json({ error: result.error }, { status: 503 });
    }
    return NextResponse.json({ status: result.status, id: result.subscriptionId ?? result.inboxItemId, name: result.name });
  } catch (err) {
    console.error('[emails/test] unexpected error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}