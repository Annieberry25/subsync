import { logger } from '@/lib/logger';

/**
 * Server-only Groq transport for the SubHalt assistant.
 *
 * Uses the Groq API (free tier — fast inference on open models). Live web
 * search is provided through GPT-OSS's built-in browser search tool (powered by
 * Exa), so no separate search provider is needed. GPT-OSS models accept local
 * function tools alongside the built-in `browser_search` tool in the same
 * request, which is what the agent loop in `lib/ai/agent.ts` relies on.
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

export interface GroqToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface GroqToolDefinition {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export type GroqToolPicker = GroqToolDefinition | { type: 'browser_search' };

export interface GroqChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: GroqToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface AiChatCompletionResult {
  message: AiMessagePayload & { tool_calls?: GroqToolCall[] };
  sources: { title: string; uri: string }[];
}

/**
 * One Groq chat completion. The caller owns the agent loop: when the response
 * carries `tool_calls`, execute them and call back with the tool results
 * appended to `messages`.
 */
export async function callGroqChat(params: {
  messages: GroqChatMessage[];
  tools?: GroqToolPicker[];
  temperature?: number;
  maxTokens?: number;
}): Promise<AiChatCompletionResult> {
  const { messages, tools, temperature = 0.3, maxTokens = 2048 } = params;

  const body: Record<string, unknown> = {
    model: GROQ_MODEL,
    messages,
    temperature,
    max_tokens: maxTokens,
  };
  if (tools && tools.length > 0) body.tools = tools;

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
    choices?: { message?: AiMessagePayload & { tool_calls?: GroqToolCall[] } }[];
  };

  const message = data.choices?.[0]?.message ?? {};
  if (!message.content && !message.tool_calls?.length) {
    logger.warn('[ai] Groq returned neither text nor tool calls', { model: GROQ_MODEL });
  }

  return { message, sources: extractSources(message) };
}
