import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser, isUserAdmin } from '@/lib/auth/access';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized user session.' }, { status: 401 });
    }
    const isAdmin = await isUserAdmin(supabase, user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    const { id } = await params;
    if (id === user.id) {
      return NextResponse.json({ error: 'You cannot change your own admin role.' }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as { admin?: unknown };
    const makeAdmin = body.admin === true;

    // Uses the caller's own session so auth.uid() matches the admin performing
    // the change (set_user_admin is SECURITY DEFINER and requires an admin caller).
    const { error } = await supabase.rpc('set_user_admin', {
      target_user_id: id,
      make_admin: makeAdmin,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, is_admin: makeAdmin });
  } catch (err) {
    console.error('[admin/users/:id/role] unexpected error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}