import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/access';

const NAME_CHANGE_COOLDOWN_DAYS = 30;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Authenticate user
    const user = await getAuthUser(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized user session.' }, { status: 401 });
    }

    // 2. Parse payload
    const body = await request.json().catch(() => ({}));
    const newName = typeof body.fullName === 'string' ? body.fullName.trim() : '';

    if (!newName) {
      return NextResponse.json({ error: 'Please enter a valid name.' }, { status: 400 });
    }

    if (newName.length > 100) {
      return NextResponse.json({ error: 'Name must be 100 characters or less.' }, { status: 400 });
    }

    // 3. Authoritative cooldown check + record happen inside the DB (SECURITY DEFINER).
    //    The client role has no direct write access to name_change_log, so the
    //    window cannot be backdated from the browser.
    const { data: rpcResult, error: rpcError } = await supabase.rpc<
      'update_user_name',
      { p_full_name: string }
    >('update_user_name', { p_full_name: newName });

    if (rpcError) {
      console.error('[update-name] RPC failed:', rpcError.message);
      return NextResponse.json({ error: 'Failed to verify name-change cooldown.' }, { status: 500 });
    }

    if (!rpcResult?.success) {
      if (rpcResult?.next_allowed_at) {
        const nextAllowedDate = new Date(rpcResult.next_allowed_at);
        return NextResponse.json(
          {
            error: `Name can only be changed once every ${NAME_CHANGE_COOLDOWN_DAYS} days. You can change your name again on ${nextAllowedDate.toLocaleDateString(
              'en-US',
              { month: 'short', day: 'numeric', year: 'numeric' }
            )}.`,
            nextAllowedDate: rpcResult.next_allowed_at,
          },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: rpcResult?.message || 'Name could not be updated.' },
        { status: 400 }
      );
    }

    // 4. Keep auth user metadata in sync (public.profiles was updated inside the DB).
    const { error: updateAuthError } = await supabase.auth.updateUser({
      data: {
        full_name: newName,
      },
    });

    if (updateAuthError) {
      return NextResponse.json({ error: updateAuthError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      fullName: newName,
      lastNameChange: rpcResult?.last_changed_at ?? null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'An unexpected error occurred while updating name.';
    console.error('[update-name] Unexpected error:', msg);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}