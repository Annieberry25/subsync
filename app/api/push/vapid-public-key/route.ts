import { NextResponse } from 'next/server';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

/**
 * Hands the browser the VAPID public key.
 *
 * A separate route rather than inlining the key in the client bundle so that
 * rotating the keypair is an env change and a redeploy, not a code change in
 * every caller. The private key never leaves the server.
 */
export async function GET() {
  const publicKey = env.VAPID_PUBLIC_KEY || null;

  if (!publicKey) {
    return NextResponse.json(
      { publicKey: null, configured: false },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // Deliberately uncached: a stale key produces a subscription the push service
  // rejects, and the failure is invisible until notifications silently stop.
  return NextResponse.json(
    { publicKey, configured: true },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}