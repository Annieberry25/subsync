import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const NAME_CHANGE_COOLDOWN_DAYS = 30;

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

    // 2. Parse payload
    const body = await request.json().catch(() => ({}));
    const newName = typeof body.fullName === 'string' ? body.fullName.trim() : '';

    if (!newName) {
      return NextResponse.json({ error: 'Please enter a valid name.' }, { status: 400 });
    }

    if (newName.length > 100) {
      return NextResponse.json({ error: 'Name must be 100 characters or less.' }, { status: 400 });
    }

    // 3. Server-side 30-day rate limit check using dedicated table (authoritative).
    const nowIso = new Date().toISOString();
    const { data: changeRow, error: rowError } = await supabase
      .from('name_change_log')
      .select('last_changed_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (rowError) {
      console.error('[update-name] Failed to read name_change_log:', rowError.message);
      return NextResponse.json({ error: 'Failed to verify name-change cooldown.' }, { status: 500 });
    }

    if (changeRow?.last_changed_at) {
      const lastChangeDate = new Date(changeRow.last_changed_at);
      const now = new Date();
      const diffMs = now.getTime() - lastChangeDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (diffDays < NAME_CHANGE_COOLDOWN_DAYS) {
        const nextAllowedDate = new Date(
          lastChangeDate.getTime() + NAME_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
        );
        return NextResponse.json(
          {
            error: `Name can only be changed once every 30 days. You can change your name again on ${nextAllowedDate.toLocaleDateString(
              'en-US',
              { month: 'short', day: 'numeric', year: 'numeric' }
            )}.`,
            nextAllowedDate: nextAllowedDate.toISOString(),
          },
          { status: 429 }
        );
      }
    }

    // 4. Perform persistent update in Supabase Auth user metadata & public profiles
    const { error: updateAuthError } = await supabase.auth.updateUser({
      data: {
        full_name: newName,
      },
    });

    if (updateAuthError) {
      return NextResponse.json({ error: updateAuthError.message }, { status: 400 });
    }

    // Best-effort update to public.profiles table if present
    try {
      await supabase
        .from('profiles')
        .update({ full_name: newName, updated_at: nowIso })
        .eq('id', user.id);
    } catch {
      // Ignore if profiles table is not present or restricted
    }

    // 5. Record the change in the authoritative rate-limit table (upsert).
    const { error: logError } = await supabase
      .from('name_change_log')
      .upsert(
        {
          user_id: user.id,
          last_changed_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: 'user_id' }
      );

    if (logError) {
      console.error('[update-name] Failed to record name_change_log:', logError.message);
      return NextResponse.json({ success: false, error: 'Name updated but cooldown tracking failed.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      fullName: newName,
      lastNameChange: nowIso,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'An unexpected error occurred while updating name.';
    console.error('[update-name] Unexpected error:', msg);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
