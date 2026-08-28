import { logger } from '@/lib/logger';

/**
 * Server-only AI integration for the SubHalt assistant.
 *
 * Uses the Google Gemini API (free tier — `gemini-2.5-flash`). Web search is
 * provided through Gemini's built-in "Grounding with Google Search", so no
 * separate search provider is needed.
 *
 * IMPORTANT: This module must only be imported from Route Handlers / Server
 * Components. It reads server-only env vars. Do not import it into client
 * components.
 *
 * Env vars:
 *   GEMINI_API_KEY   (required for live AI answers; app degrades gracefully without it)
 *   GEMINI_MODEL     (optional, default: gemini-2.5-flash)
 *   GEMINI_WEB_SEARCH (optional, "false" disables Google Search grounding)
 */

const GEMINI_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta';

export const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
const apiKey = process.env.GEMINI_API_KEY?.trim() || '';
const webSearchEnabled = (process.env.GEMINI_WEB_SEARCH ?? 'true').toLowerCase() !== 'false';

export function isAiConfigured(): boolean {
  return Boolean(apiKey);
}

export interface AiChatHistoryItem {
  role: 'user' | 'assistant';
  text: string;
}

export interface AiAnswer {
  /** True when a live model call was attempted (key configured). */
  configured: boolean;
  answer: string;
  sources: { title: string; uri: string }[];
}

/** Keep conversation history bounded for the free tier. */
const MAX_HISTORY_ITEMS = 10;

/**
 * Builds the system prompt that gives the model persona + user-specific context.
 * The context block is created by `lib/ai/context.ts` from the user's own data.
 */
export function buildSystemPrompt(
  assistantName: string,
  userContext: string,
  hasData: boolean,
  displayCurrency: string
): string {
  const dataNote = hasData
    ? `You have the user's real SubHalt data below. Base all personal answers on it.
Do not invent subscriptions, bills, or payments that are not listed here.
If the user asks about something that is not in their data, say it is not currently tracked in SubHalt
and suggest how they can add it (Bills & Payments page, Subscription section, or Scan Receipt).`
    : `The user currently has no tracked data in SubHalt. Do not invent subscriptions, bills, or payments.
Answer general questions, and suggest they add their subscriptions and bills so you can help them
understand spending, renewals, and savings.`;

  return `You are ${assistantName}, the Smart AI assistant inside SubHalt — a personal subscription and bill manager.
You help the user understand their spending, remind them about bills and renewals, answer questions about
their payments and subscriptions, and give practical money-saving suggestions.

## Role and honesty rules
- Never claim to have cancelled a subscription or paid a bill. SubHalt cannot act on third-party sites.
  If the user wants to cancel or pay, point them to the right official portal (from their data or from
  CURRENT web information) and give short, accurate step-by-step guidance.
- If you are asked about current events, outages, price changes, news about a service/provider/payment
  platform (e.g. banking apps, telcos, electricity providers, streaming services), use Google Search to look
  it up. Cite the sources you used. If you cannot verify something, say so.
- Numbers: always reason about the actual values in the user's data. Format money in the user's display
  currency (${displayCurrency}) unless the item is clearly in another currency.
- Be warm, concise and concrete. Use short bullet lists when helpful. End with one actionable suggestion
  when appropriate.

## User's data
${dataNote}
<user_data>
${userContext || '(no data)'}
</user_data>

Only use tools (web search) when your answer needs current information beyond the user's data.`;
}

/**
 * Calls the Gemini API and returns generated text plus any web-search citation sources.
 */
async function callGemini(params: {
  systemPrompt: string;
  history: AiChatHistoryItem[];
  question: string;
}): Promise<{ text: string; sources: { title: string; uri: string }[] }> {
  const { systemPrompt, history, question } = params;

  const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = history
    .slice(-MAX_HISTORY_ITEMS)
    .map((h) => ({
      role: h.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text: h.text }],
    }));
  contents.push({ role: 'user', parts: [{ text: question }] });

  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: { temperature: 0.6, maxOutputTokens: 2048 },
  };

  if (webSearchEnabled) {
    body.tools = [{ googleSearch: {} }];
  }

  const res = await fetch(
    `${GEMINI_API_ENDPOINT}/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    }
  );

  if (!res.ok) {
    let message = `Gemini API error ${res.status}`;
    try {
      const errBody = (await res.json()) as { error?: { message?: string; status?: string } };
      if (errBody?.error?.message) message = errBody.error.message;
    } catch {
      // ignore parse failure
    }
    throw new Error(message);
  }

  const data = (await res.json()) as {
    candidates?: {
      content?: { parts?: { text?: string }[] };
      finishReason?: string;
      groundingMetadata?: { groundingChunks?: { web?: { title?: string; uri?: string } }[] };
    }[];
  };

  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();

  if (!text) {
    const reason = candidate?.finishReason || 'unknown';
    logger.warn('[ai] Gemini returned empty content', { finishReason: reason });
    throw new Error(`The model returned no text (${reason}). Try rephrasing your question.`);
  }

  const chunks = candidate?.groundingMetadata?.groundingChunks ?? [];
  const sources = chunks
    .map((c) => ({ title: c.web?.title || c.web?.uri || 'Source', uri: c.web?.uri || '' }))
    .filter((s) => s.uri);

  return { text, sources };
}

/**
 * Produces an AI answer for the user's question using their data context.
 * Returns `configured: false` when no GEMINI_API_KEY is set so the client can
 * fall back to offline behavior instead of showing an error.
 */
export async function getAiAnswer(params: {
  question: string;
  history: AiChatHistoryItem[];
  userContext: string;
  hasData: boolean;
  assistantName: string;
  displayCurrency: string;
}): Promise<AiAnswer> {
  const { question, history, userContext, hasData, assistantName, displayCurrency } = params;

  if (!apiKey) {
    return { configured: false, answer: '', sources: [] };
  }

  const systemPrompt = buildSystemPrompt(assistantName, userContext, hasData, displayCurrency);

  try {
    const { text, sources } = await callGemini({ systemPrompt, history, question });
    return { configured: true, answer: text, sources };
  } catch (err) {
    logger.error('[ai] Gemini request failed', err);
    throw err;
  }
}