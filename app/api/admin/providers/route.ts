import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { createAdminBillProvider, listAdminBillProviders } from '@/lib/services/admin-service';
import type { AdminProviderInput } from '@/lib/types/admin.types';

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }
    const rows = await listAdminBillProviders();
    return NextResponse.json({ rows });
  } catch (err) {
    console.error('[admin/providers] unexpected error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }
    const body = (await request.json().catch(() => ({}))) as Partial<AdminProviderInput>;
    if (!body.name?.trim() || !body.category?.trim() || !body.country?.trim()) {
      return NextResponse.json({ error: 'name, category, and country are required.' }, { status: 400 });
    }
    const row = await createAdminBillProvider({
      name: body.name,
      category: body.category,
      country: body.country,
      region: body.region ?? null,
      official_website: body.official_website ?? null,
      official_payment_url: body.official_payment_url ?? null,
      verification_status: body.verification_status ?? 'unverified',
      supported_regions: body.supported_regions ?? null,
    });
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error('[admin/providers] unexpected error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'An unexpected error occurred.' }, { status: 500 });
  }
}