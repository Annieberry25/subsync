import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser, resolveServerPlanTier } from '@/lib/auth/access';
import { checkRateLimit } from '@/lib/rate-limit';
import { executeWriteTool, getToolDefinition, type AiToolContext } from '@/lib/ai/tools';
import { getPlanLimits } from '@/lib/constants/plan-limits';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const RATE_LIMIT_WINDOW_SECONDS = 300;
const RATE_LIMIT_MAX_ACTIONS = 30;

/**
 * Executes an assistant write action after the user confirmed the card in the
 * chat. The model can never reach this path on its own: the pending action only
 * carries tool + args, and everything is re-validated here (auth, plan gate,
 * schema) before any write happens.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const allowed = await checkRateLimit(`user:ai-actions:${user.id}`, {
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    maxRequests: RATE_LIMIT_MAX_ACTIONS,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many actions in a short time. Please wait a moment and try again.', errorLabel: 'ai' },
      { status: 429 }
    );
  }

  let body: { tool?: unknown; args?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const toolName = typeof body.tool === 'string' ? body.tool.trim() : '';
  const tool = getToolDefinition(toolName);
  if (!tool || !tool.write) {
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  }

  const args =
    body.args && typeof body.args === 'object' && !Array.isArray(body.args)
      ? (body.args as Record<string, unknown>)
      : {};

  const { tier, isAdmin } = await resolveServerPlanTier(supabase, user.id);
  if (!getPlanLimits(tier, isAdmin).hasAssistantActions) {
    return NextResponse.json({ error: 'Assistant actions require the Plus plan.' }, { status: 403 });
  }

  const ctx: AiToolContext = {
    supabase,
    userId: user.id,
    tier,
    isAdmin,
    actionsEnabled: true,
    displayCurrency: (user.user_metadata?.default_currency as string | undefined) || 'USD',
    today: new Date().toISOString().slice(0, 10),
  };

  try {
    const result = await executeWriteTool(toolName, args, ctx);
    return NextResponse.json(result);
  } catch (err) {
    logger.error('[ai] action execution failed', err);
    return NextResponse.json(
      { error: 'Something went wrong while applying the change. Please try again.', errorLabel: 'ai' },
      { status: 500 }
    );
  }
}
