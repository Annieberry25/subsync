import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/auth/access';
import { verifyAccountDeleteCode } from '@/lib/services/account-delete-code';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Authenticate user
    const user = await getAuthUser(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized user session.' }, { status: 401 });
    }

    // 2. Parse & validate payload
    const body = await request.json().catch(() => ({}));

    if (!user.email) {
      return NextResponse.json({ error: 'Unable to verify your account email.' }, { status: 400 });
    }

    // 3. Re-authenticate to confirm ownership.
    //    Password accounts confirm with the password; OAuth-only accounts (no
    //    password identity) confirm with a one-time code emailed server-side.
    const hasPasswordIdentity =
      Array.isArray(user.identities) && user.identities.some((id) => id.provider === 'email');

    if (hasPasswordIdentity) {
      const password = typeof body.password === 'string' ? body.password : '';
      if (!password) {
        return NextResponse.json(
          { error: 'Password is required to delete your account.' },
          { status: 400 }
        );
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });

      if (signInError) {
        return NextResponse.json(
          { error: 'Incorrect password. Please try again.' },
          { status: 401 }
        );
      }
    } else {
      const code = typeof body.code === 'string' ? body.code : '';
      if (!code) {
        return NextResponse.json(
          {
            error:
              'This account does not use a password. Request a deletion code, then enter it here.',
          },
          { status: 400 }
        );
      }

      if (!verifyAccountDeleteCode(user.id, code)) {
        return NextResponse.json(
          { error: 'Invalid or expired code. Request a new one and try again.' },
          { status: 401 }
        );
      }
    }

    // 4. Delete the user via the admin API using the server-only service-role key.
    //    Referential integrity (ON DELETE CASCADE) removes profiles, subscriptions,
    //    bill_payments, and name_change_log rows.
    const adminClient = createAdminClient();

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error('[delete-account] Failed to delete user:', deleteError.message);
      return NextResponse.json({ error: 'Failed to delete account. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[delete-account] Unexpected error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
