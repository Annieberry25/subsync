import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser, resolveServerPlanTier } from '@/lib/auth/access';
import { checkRateLimit } from '@/lib/rate-limit';
import { runAssistantAgent } from '@/lib/ai/agent';
import type { AiChatHistoryItem } from '@/lib/ai/server';
import type { AiToolContext } from '@/lib/ai/tools';
import { getPlanLimits } from '@/lib/constants/plan-limits';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
// The agent may make several provider calls (tool rounds + final answer).
export const maxDuration = 60;

const MAX_QUESTION_LENGTH = 1000;
const MAX_HISTORY = 10;
const RATE_LIMIT_WINDOW_SECONDS = 300;
const RATE_LIMIT_MAX_QUESTIONS = 20;

export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Each question costs one or more provider requests, so one account is
  // bounded to a rate no real conversation reaches.
  const allowed = await checkRateLimit(`user:ai-chat:${user.id}`, {
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    maxRequests: RATE_LIMIT_MAX_QUESTIONS,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: 'You are sending questions very quickly. Please wait a moment and try again.', errorLabel: 'ai' },
      { status: 429 }
    );
  }

  let body: { question?: unknown; history?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (!question || question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json({ error: 'A valid question is required.' }, { status: 400 });
  }

  const history: AiChatHistoryItem[] = Array.isArray(body.history)
    ? body.history
        .slice(-MAX_HISTORY)
        .filter(
          (h): h is AiChatHistoryItem =>
            Boolean(h) &&
            typeof h === 'object' &&
            (h.role === 'user' || h.role === 'assistant') &&
            typeof h.text === 'string' &&
            h.text.trim().length > 0
        )
        .map((h) => ({ role: h.role, text: h.text.trim().slice(0, 2000) }))
    : [];

  // Plan tier comes from the profiles row (server-side authority), never from
  // client-controlled user_metadata.
  const { tier, isAdmin } = await resolveServerPlanTier(supabase, user.id);
  const actionsEnabled = getPlanLimits(tier, isAdmin).hasAssistantActions;

  const displayName =
    user.user_metadata?.full_name || user.user_metadata?.username || user.email?.split('@')[0] || undefined;
  const assistantName = 'SubHalt';
  const displayCurrency = (user.user_metadata?.default_currency as string | undefined) || 'USD';

  const ctx: AiToolContext = {
    supabase,
    userId: user.id,
    tier,
    isAdmin,
    actionsEnabled,
    displayCurrency,
    today: new Date().toISOString().slice(0, 10),
  };

  try {
    const result = await runAssistantAgent({
      question,
      history,
      assistantName,
      displayName,
      email: user.email ?? undefined,
      displayCurrency,
      ctx,
    });

    if (!result.configured) {
      return NextResponse.json({
        configured: false,
        answer: '',
        sources: [],
        pendingActions: [],
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    logger.error('[ai] failed to generate answer', err);
    return NextResponse.json(
      { error: 'Something went wrong while generating an answer. Please try again.', errorLabel: 'ai' },
      { status: 500 }
    );
  }
}
