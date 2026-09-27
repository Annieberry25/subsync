import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { getUserAdminDetail } from '@/lib/services/admin-service';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }
    const { id } = await params;
    const detail = await getUserAdminDetail(id);
    if (!detail) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (err) {
    console.error('[admin/users/:id] unexpected error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}