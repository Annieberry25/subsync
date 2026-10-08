import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/auth/access';
import { verifyAccountDeleteCode } from '@/lib/services/account-delete-code';
import { sendAccountDeletedEmail } from '@/lib/email/send';

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

    // 3. Confirm ownership with the one-time code emailed to the account. This is
    //    required for every account, password or OAuth-only alike, so both factors
    //    (something you know + access to the account email) back the deletion.
    const code = typeof body.code === 'string' ? body.code : '';
    if (!code) {
      return NextResponse.json(
        { error: 'Request a deletion code, then enter it here to confirm.' },
        { status: 400 }
      );
    }

    if (!verifyAccountDeleteCode(user.id, code)) {
      return NextResponse.json(
        { error: 'Invalid or expired code. Request a new one and try again.' },
        { status: 401 }
      );
    }

    // 4. Record the (optional) reason for leaving before the user is deleted, so
    //    the team can act on churn feedback. No policies exist on this table, so
    //    only the service-role client can write to it.
    const adminClient = createAdminClient();

    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 2000) : '';
    if (reason) {
      const { error: feedbackError } = await adminClient
        .from('account_deletion_reasons')
        .insert({ user_id: user.id, email: user.email, reason });

      if (feedbackError) {
        console.warn('[delete-account] Failed to record deletion reason:', feedbackError.message);
      }
    }

    // 5. Delete the user via the admin API using the server-only service-role key.
    //    Referential integrity (ON DELETE CASCADE) removes profiles, subscriptions,
    //    bill_payments, and name_change_log rows.
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error('[delete-account] Failed to delete user:', deleteError.message);
      return NextResponse.json({ error: 'Failed to delete account. Please try again.' }, { status: 500 });
    }

    // 6. Say goodbye. sendAccountDeletedEmail never throws (see lib/email/send.ts),
    //    so a slow or failing provider cannot turn a successful deletion into an
    //    error response.
    await sendAccountDeletedEmail(user.email);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[delete-account] Unexpected error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
