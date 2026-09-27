import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { deleteAdminBillProvider, updateAdminBillProvider } from '@/lib/services/admin-service';
import { z } from 'zod';

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  country: z.string().min(1).optional(),
  region: z.string().nullable().optional(),
  official_website: z.string().nullable().optional(),
  official_payment_url: z.string().nullable().optional(),
  verification_status: z.enum(['verified', 'user_submitted', 'unverified']).optional(),
  supported_regions: z.array(z.string()).nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }
    const { id } = await params;
    const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
    }
    const row = await updateAdminBillProvider(id, parsed.data);
    return NextResponse.json(row);
  } catch (err) {
    console.error('[admin/providers/:id] unexpected error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'An unexpected error occurred.' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }
    const { id } = await params;
    await deleteAdminBillProvider(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/providers/:id] unexpected error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'An unexpected error occurred.' }, { status: 500 });
  }
}