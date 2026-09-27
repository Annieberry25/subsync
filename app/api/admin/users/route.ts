import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { listAdminUsers } from '@/lib/services/admin-service';

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') ?? undefined;
    const rawLimit = Number(searchParams.get('limit') ?? '100');
    const limit = Math.min(Number.isFinite(rawLimit) ? rawLimit : 100, 200);

    const result = await listAdminUsers(search || undefined, limit);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[admin/users] unexpected error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}