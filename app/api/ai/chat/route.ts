import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAiAnswer, type AiChatHistoryItem } from '@/lib/ai/server';
import { buildAiUserContext, renderUserContext } from '@/lib/ai/context';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const MAX_QUESTION_LENGTH = 1000;
const MAX_HISTORY = 10;
const MAX_SUBSCRIPTIONS = 300;
const MAX_BILLS = 300;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
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

  const [profileRes, subsRes, billsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('next_billing_date', { ascending: true })
      .limit(MAX_SUBSCRIPTIONS),
    supabase
      .from('bill_payments')
      .select('*')
      .eq('user_id', user.id)
      .order('payment_date', { ascending: false })
      .limit(MAX_BILLS),
  ]);

  if (subsRes.error) logger.warn('[ai] subscriptions query failed', { message: subsRes.error.message });
  if (billsRes.error) logger.warn('[ai] bills query failed', { message: billsRes.error.message });

  const aiContext = buildAiUserContext({
    profile: profileRes.data ?? null,
    subscriptions: subsRes.data ?? [],
    bills: billsRes.data ?? [],
  });
  const userContext = renderUserContext(aiContext);

  const displayName = user.user_metadata?.full_name || user.user_metadata?.username || user.email?.split('@')[0] || undefined;
  const assistantName = 'SubHalt';
  const displayCurrency = (user.user_metadata?.default_currency as string | undefined) || 'USD';

  const greetingLine = displayName
    ? `Context profile: name is ${displayName}, email is ${user.email}.`
    : `Context profile: email is ${user.email}.`;
  const finalContext = `${greetingLine}\n${userContext}`;

  try {
    const result = await getAiAnswer({
      question,
      history,
      userContext: finalContext,
      hasData: aiContext.hasData,
      assistantName,
      displayCurrency,
    });

    if (!result.configured) {
      return NextResponse.json({
        configured: false,
        answer: '',
        sources: [],
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[ai] failed to generate answer', err);
    return NextResponse.json(
      { error: message, errorLabel: 'ai' },
      { status: 500 }
    );
  }
}