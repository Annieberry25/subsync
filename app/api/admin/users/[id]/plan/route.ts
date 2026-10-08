import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { grantPlanToUser, revokePlanFromUser } from '@/lib/services/admin-service';
import { z } from 'zod';

const grantSchema = z.object({
  action: z.literal('grant'),
  tier: z.enum(['plus', 'premium']),
  days: z.number().int().min(1).max(3650).optional(),
});

const revokeSchema = z.object({
  action: z.literal('revoke'),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    if ((body as { action?: string }).action === 'revoke') {
      const parsed = revokeSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
      }
      await revokePlanFromUser(id);
      return NextResponse.json({ ok: true, action: 'revoke' });
    }

    const parsed = grantSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
    }
    await grantPlanToUser(id, parsed.data.tier, parsed.data.days ?? 30);
    return NextResponse.json({ ok: true, action: 'grant', tier: parsed.data.tier });
  } catch (err) {
    console.error('[admin/users/:id/plan] unexpected error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}