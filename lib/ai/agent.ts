import {
  GROQ_MODEL,
  GROQ_WEB_SEARCH_ENABLED,
  callGroqChat,
  isAiConfigured,
  supportsBrowserSearch,
  type AiChatHistoryItem,
  type GroqChatMessage,
  type GroqToolCall,
  type GroqToolPicker,
} from '@/lib/ai/server';
import {
  describeWriteTool,
  getToolDefinition,
  parseToolArgs,
  readToolDefinitions,
  runReadTool,
  writeToolDefinitions,
  type AiToolContext,
  type PendingAiAction,
} from '@/lib/ai/tools';

/**
 * The assistant's agent loop: the model answers grounded questions about the
 * user's real data by calling read tools, proposes writes as pending actions
 * (never executes them), and can combine both with live web search. Write
 * execution lives in /api/ai/actions after the user confirms the card.
 */

const MAX_TOOL_ROUNDS = 5;
const MAX_PENDING_ACTIONS = 3;
const MAX_HISTORY_ITEMS = 10;
const MAX_TOOL_RESULT_CHARS = 6000;

export interface AiAssistantRequest {
  question: string;
  history: AiChatHistoryItem[];
  assistantName: string;
  displayName?: string;
  email?: string;
  displayCurrency: string;
  ctx: AiToolContext;
}

export interface AiAssistantResult {
  configured: boolean;
  answer: string;
  sources: { title: string; uri: string }[];
  pendingActions: PendingAiAction[];
}

export function buildAssistantSystemPrompt(params: {
  assistantName: string;
  displayName?: string;
  email?: string;
  displayCurrency: string;
  actionsEnabled: boolean;
  today: string;
}): string {
  const { assistantName, displayName, email, displayCurrency, actionsEnabled, today } = params;

  const who = displayName && email ? `${displayName} (${email})` : email || displayName || 'the signed-in user';

  const actionsBlock = actionsEnabled
    ? `The user's plan includes assistant actions (Plus). When they ask to add, edit, pause, resume, cancel a subscription, or log/correct a bill payment, call the matching write tool to prepare it.`
    : `The user is on the free plan: reading and analysis only. Write tools are not available. If they ask for a change, explain that upgrading to Plus unlocks assistant actions, and offer the manual path (the Subscriptions page, or the provider's portal).`;

  return `You are ${assistantName}, the AI assistant inside SubHalt — a personal subscription and bill manager.
Today's date is ${today}. The user is ${who}. Format money in ${displayCurrency} unless the item is clearly in another currency.

## Grounding rules (strict)
- You have tools that read the user's REAL SubHalt data. For ANY question about their subscriptions, bills, spending, renewals, statuses, or savings, call the relevant tool FIRST and base every number, name, and date on its result. Never answer such questions from memory or guess.
- If a tool returns no matching data, say it is not tracked yet and how to add it (Subscriptions page, Bills & Payments page, or Scan Receipt).
- For facts beyond the user's data (provider prices, policies, outages, current news), use web search and cite the sources you used. If you cannot verify something, say so.
- Never invent figures, dates, or subscriptions.

## Actions
- ${actionsBlock}
- Proposing an action does NOT execute it. The app shows a confirmation card; tell the user to review and confirm it. Never say a change was made until a tool result tells you it was executed.
- Cancelling in SubHalt only updates the user's records — remind them to cancel with the provider too when relevant.

## Style
- Warm, concise, concrete. Use short bullet lists when helpful. End with one actionable suggestion when appropriate.
- Money: always include the currency from the data (e.g. "$15.99", "NGN 12,000"). Do not convert between currencies unless the user asks.`;
}

async function runToolCall(
  call: GroqToolCall,
  ctx: AiToolContext,
  pending: PendingAiAction[]
): Promise<Record<string, unknown>> {
  const name = call?.function?.name ?? '';
  const tool = getToolDefinition(name);
  if (!tool) return { error: `Unknown tool: ${name}` };

  let rawArgs: unknown = {};
  try {
    rawArgs = call.function.arguments ? JSON.parse(call.function.arguments) : {};
  } catch {
    return { error: `Arguments for ${name} were not valid JSON.` };
  }

  const parsed = parseToolArgs(name, rawArgs);
  if (!parsed.ok) return { error: parsed.error };

  if (!tool.write) {
    return runReadTool(name, parsed.data, ctx);
  }

  if (!ctx.actionsEnabled) {
    return {
      error:
        "Actions are not available on this user's plan. Explain that upgrading to Plus unlocks assistant actions, and offer the manual path instead.",
    };
  }

  if (pending.length >= MAX_PENDING_ACTIONS) {
    return { error: 'Too many proposed actions in one turn. Ask the user to confirm the existing cards first.' };
  }

  const described = await describeWriteTool(name, parsed.data, ctx);
  if ('error' in described) return { error: described.error };

  const action: PendingAiAction = {
    id: globalThis.crypto.randomUUID(),
    tool: name,
    args: parsed.data,
    title: described.title,
    description: described.description,
    details: described.details,
  };
  pending.push(action);

  return {
    status: 'awaiting_confirmation',
    action_id: action.id,
    title: action.title,
    guidance:
      'A confirmation card is now shown in the chat. Tell the user what it will do and ask them to confirm or cancel it. Do not claim it is done.',
  };
}

function buildToolPickers(ctx: AiToolContext): GroqToolPicker[] {
  const definitions = [...readToolDefinitions(), ...(ctx.actionsEnabled ? writeToolDefinitions() : [])];
  const pickers: GroqToolPicker[] = definitions.map((d) => ({
    type: 'function',
    function: { name: d.name, description: d.description, parameters: d.parameters },
  }));
  // GPT-OSS accepts local function tools and the built-in browser search in the
  // same request, so one loop handles both grounding and external facts.
  if (GROQ_WEB_SEARCH_ENABLED && supportsBrowserSearch(GROQ_MODEL)) {
    pickers.push({ type: 'browser_search' });
  }
  return pickers;
}

function dedupeSources(sources: { title: string; uri: string }[]): { title: string; uri: string }[] {
  const seen = new Map<string, { title: string; uri: string }>();
  for (const source of sources) {
    if (source.uri && !seen.has(source.uri)) seen.set(source.uri, source);
  }
  return [...seen.values()];
}

export async function runAssistantAgent(req: AiAssistantRequest): Promise<AiAssistantResult> {
  if (!isAiConfigured()) {
    return { configured: false, answer: '', sources: [], pendingActions: [] };
  }

  const { ctx } = req;
  const systemPrompt = buildAssistantSystemPrompt({
    assistantName: req.assistantName,
    displayName: req.displayName,
    email: req.email,
    displayCurrency: req.displayCurrency,
    actionsEnabled: ctx.actionsEnabled,
    today: ctx.today,
  });

  const messages: GroqChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...req.history.slice(-MAX_HISTORY_ITEMS).map((h) => ({ role: h.role, content: h.text })),
    { role: 'user', content: req.question },
  ];

  const tools = buildToolPickers(ctx);
  const pending: PendingAiAction[] = [];
  const collectedSources: { title: string; uri: string }[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const result = await callGroqChat({ messages, tools });
    collectedSources.push(...result.sources);

    const toolCalls = result.message.tool_calls ?? [];
    const content = (result.message.content ?? '').trim();

    if (toolCalls.length === 0) {
      if (!content) throw new Error('The model returned no text. Try rephrasing your question.');
      return {
        configured: true,
        answer: content,
        sources: dedupeSources(collectedSources),
        pendingActions: pending,
      };
    }

    messages.push({ role: 'assistant', content: result.message.content ?? null, tool_calls: toolCalls });

    for (const call of toolCalls) {
      const toolResult = await runToolCall(call, ctx, pending);
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        name: call.function?.name ?? 'tool',
        content: JSON.stringify(toolResult).slice(0, MAX_TOOL_RESULT_CHARS),
      });
    }
  }

  // Tool budget exhausted — force a final answer from what has been gathered.
  const final = await callGroqChat({ messages });
  collectedSources.push(...final.sources);
  const finalText = (final.message.content ?? '').trim();
  if (!finalText) throw new Error('The model returned no text. Try rephrasing your question.');

  return {
    configured: true,
    answer: finalText,
    sources: dedupeSources(collectedSources),
    pendingActions: pending,
  };
}
