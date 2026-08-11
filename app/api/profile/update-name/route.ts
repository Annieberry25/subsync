import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    // 3. Persistent 30-day rate limit check
    const lastChangeStr = user.user_metadata?.last_name_change;
    if (lastChangeStr) {
      const lastChangeDate = new Date(lastChangeStr);
      const now = new Date();
      const diffMs = now.getTime() - lastChangeDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (diffDays < 30) {
        const nextAllowedDate = new Date(lastChangeDate.getTime() + 30 * 24 * 60 * 60 * 1000);
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
    const nowIso = new Date().toISOString();

    const { error: updateAuthError } = await supabase.auth.updateUser({
      data: {
        full_name: newName,
        last_name_change: nowIso,
      },
    });

    if (updateAuthError) {
      return NextResponse.json({ error: updateAuthError.message }, { status: 400 });
    }

    // Best-effort update to public.profiles table if present
    try {
      await supabase.from('profiles').update({ full_name: newName, updated_at: nowIso }).eq('id', user.id);
    } catch {
      // Ignore if profiles table is not present or restricted
    }

    return NextResponse.json({
      success: true,
      fullName: newName,
      lastNameChange: nowIso,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'An unexpected error occurred while updating name.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
