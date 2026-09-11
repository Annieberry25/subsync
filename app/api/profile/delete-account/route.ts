import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized user session.' }, { status: 401 });
    }

    // 2. Parse & validate payload
    const body = await request.json().catch(() => ({}));
    const password = typeof body.password === 'string' ? body.password : '';

    if (!password) {
      return NextResponse.json({ error: 'Password is required to delete your account.' }, { status: 400 });
    }

    if (!user.email) {
      return NextResponse.json({ error: 'Unable to verify your account email.' }, { status: 400 });
    }

    // 3. Re-authenticate with the supplied password to confirm ownership.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });

    if (signInError) {
      return NextResponse.json({ error: 'Incorrect password. Please try again.' }, { status: 401 });
    }

    // 4. Delete the user via the admin API using the server-only service-role key.
    //    Referential integrity (ON DELETE CASCADE) removes profiles, subscriptions,
    //    bill_payments, and name_change_log rows.
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      console.error('[delete-account] SUPABASE_SERVICE_ROLE_KEY is not configured.');
      return NextResponse.json({ error: 'Account deletion is currently unavailable. Please contact support.' }, { status: 500 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      return NextResponse.json({ error: 'Account deletion is currently unavailable.' }, { status: 500 });
    }

    const adminClient = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

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
