import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/access';
import {
  generateAccountDeleteCode,
  isAccountDeleteCodeConfigured,
} from '@/lib/services/account-delete-code';
import { sendAccountDeleteCodeEmail } from '@/lib/email/send';

/**
 * Emails a one-time deletion code to the signed-in user.
 *
 * Only relevant for accounts with no password (OAuth-only sign-in): password
 * accounts confirm deletion with the password itself. The code is stateless
 * (HMAC of userId + time window) so there is nothing to leak from a database.
 */
export async function POST() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized user session.' }, { status: 401 });
  }

  if (!user.email) {
    return NextResponse.json({ error: 'Unable to verify your account email.' }, { status: 400 });
  }

  const hasPasswordIdentity =
    Array.isArray(user.identities) && user.identities.some((id) => id.provider === 'email');
  if (hasPasswordIdentity) {
    return NextResponse.json(
      { error: 'This account uses a password. Enter it to confirm deletion instead.' },
      { status: 400 }
    );
  }

  if (!isAccountDeleteCodeConfigured()) {
    console.error('[delete-account/send-code] account-delete signing key is not configured.');
    return NextResponse.json(
      { error: 'Code delivery is not configured on this deployment. Please contact support.' },
      { status: 503 }
    );
  }

  const code = generateAccountDeleteCode(user.id);
  const result = await sendAccountDeleteCodeEmail(user.email, code);

  if (!result.ok && !result.skipped) {
    return NextResponse.json(
      { error: 'Failed to deliver the code. Please try again.' },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}