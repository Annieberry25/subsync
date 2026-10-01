import { logger } from '@/lib/logger';

/**
 * Server-only AI integration for the SubHalt assistant.
 *
 * Uses the Groq API (free tier — fast inference on open models). Live web
 * search is provided through GPT-OSS's built-in browser search tool (powered by
 * Exa), so no separate search provider is needed. The legacy `groq/compound`
 * systems that provided search through `executed_tools` were decommissioned on
 * 2026-09-21; request bodies therefore enable search generically via the
 * `tools: [{ type: "browser_search" }]` flag on the models that support it.
 *
 * IMPORTANT: This module must only be imported from Route Handlers / Server
 * Components. It reads server-only env vars. Do not import it into client
 * components.
 *
 * Env vars:
 *   GROQ_API_KEY    (required for live AI answers; app degrades gracefully without it)
 *   GROQ_MODEL      (optional, default: openai/gpt-oss-120b)
 *   GROQ_WEB_SEARCH (optional, default "true"; "false" disables the browser-search tool)
 */

const GROQ_API_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

export const GROQ_MODEL = process.env.GROQ_MODEL?.trim() || 'openai/gpt-oss-120b';
export const GROQ_WEB_SEARCH_ENABLED =
  (process.env.GROQ_WEB_SEARCH ?? 'true').toLowerCase() === 'true';
const apiKey = process.env.GROQ_API_KEY?.trim() || '';

/**
 * GPT-OSS models that accept the `browser_search` built-in tool. When
 * GROQ_WEB_SEARCH=true and the configured model is not in this list, search is
 * skipped rather than risking a 400 from an unsupported tool type.
 */
const BROWSER_SEARCH_MODELS = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'openai/gpt-oss-safeguard-20b'];

export function supportsBrowserSearch(model: string): boolean {
  return BROWSER_SEARCH_MODELS.includes(model);
}

/**
 * Extracts cited sources from a Groq chat message into the app's common shape.
 * Handles the Compound-era `executed_tools[].search_results[]` payload as well
 * as a flat `citations` array returned by browser-search responses.
 */
export interface AiMessagePayload {
  content?: string;
  executed_tools?: {
    search_results?: {
      results?: { title?: string; url?: string; content?: string }[];
    };
  }[];
  citations?: { title?: string; url?: string; uri?: string }[];
}

export function extractSources(message: AiMessagePayload | undefined): { title: string; uri: string }[] {
  if (!message) return [];
  const fromTools =
    message.executed_tools?.flatMap((t) => t.search_results?.results ?? []) ?? [];
  const fromCitations = Array.isArray(message.citations) ? message.citations : [];
  return [...fromTools, ...fromCitations]
    .map((r) => ({
      title: r.title || r.url || (r as { uri?: string }).uri || 'Source',
      uri: r.url || (r as { uri?: string }).uri || '',
    }))
    .filter((s) => s.uri);
}

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
  platform (e.g. banking apps, telcos, electricity providers, streaming services), look it up using web
  search. Cite the sources you used. If you cannot verify something, say so.
- Numbers: always reason about the actual values in the user's data. Format money in the user's display
  currency (${displayCurrency}) unless the item is clearly in another currency.
- Be warm, concise and concrete. Use short bullet lists when helpful. End with one actionable suggestion
  when appropriate.

## User's data
${dataNote}
<user_data>
${userContext || '(no data)'}
</user_data>

Only use web search when your answer needs current information beyond the user's data.`;
}

/**
 * Calls the Groq API and returns generated text plus any web-search citation sources.
 */
async function callGroq(params: {
  systemPrompt: string;
  history: AiChatHistoryItem[];
  question: string;
}): Promise<{ text: string; sources: { title: string; uri: string }[] }> {
  const { systemPrompt, history, question } = params;

  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-MAX_HISTORY_ITEMS).map((h) => ({
      role: h.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: h.text,
    })),
    { role: 'user', content: question },
  ];

  const body: Record<string, unknown> = {
    model: GROQ_MODEL,
    messages,
    temperature: 0.6,
    max_tokens: 2048,
  };

  if (GROQ_WEB_SEARCH_ENABLED && supportsBrowserSearch(GROQ_MODEL)) {
    body.tools = [{ type: 'browser_search' }];
  }

  const res = await fetch(GROQ_API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    let message = `Groq API error ${res.status}`;
    try {
      const errBody = (await res.json()) as { error?: { message?: string; type?: string } };
      if (errBody?.error?.message) message = errBody.error.message;
    } catch {
      // ignore parse failure
    }
    throw new Error(message);
  }

  const data = (await res.json()) as {
    choices?: { message?: AiMessagePayload }[];
  };

  const message = data.choices?.[0]?.message;
  const text = (message?.content ?? '').trim();

  if (!text) {
    logger.warn('[ai] Groq returned empty content', { model: GROQ_MODEL });
    throw new Error('The model returned no text. Try rephrasing your question.');
  }

  return { text, sources: extractSources(message) };
}

/**
 * Produces an AI answer for the user's question using their data context.
 * Returns `configured: false` when no GROQ_API_KEY is set so the client can
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
    const { text, sources } = await callGroq({ systemPrompt, history, question });
    return { configured: true, answer: text, sources };
  } catch (err) {
    logger.error('[ai] Groq request failed', err);
    throw err;
  }
}