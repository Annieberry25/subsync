import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { listAdminPlanSubscriptions } from '@/lib/services/admin-service';

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }
    const rows = await listAdminPlanSubscriptions(200);
    return NextResponse.json({ rows });
  } catch (err) {
    console.error('[admin/plan-subscriptions] unexpected error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}