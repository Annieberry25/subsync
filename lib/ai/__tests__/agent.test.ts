import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/ai/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/server')>();
  return {
    ...actual,
    isAiConfigured: vi.fn(() => true),
    callGroqChat: vi.fn(),
  };
});

import { callGroqChat, isAiConfigured } from '@/lib/ai/server';
import { runAssistantAgent, type AiAssistantRequest } from '@/lib/ai/agent';
import type { AiToolContext } from '@/lib/ai/tools';
import type { SubscriptionRow } from '@/lib/services/subscription-service';

const mockedCall = vi.mocked(callGroqChat);
const mockedConfigured = vi.mocked(isAiConfigured);

function makeSubRow(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
  return {
    id: 'sub_1',
    user_id: 'u1',
    name: 'Netflix',
    price: 15.99,
    currency: 'USD',
    billing_cycle: 'monthly',
    category: 'Streaming',
    status: 'active',
    start_date: '2026-01-01',
    end_date: null,
    next_billing_date: '2026-11-01',
    payment_method: null,
    provider_url: null,
    notes: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as SubscriptionRow;
}

function createSupabaseMock() {
  const results: unknown[] = [];
  const payloads: Record<string, unknown[]> = {};
  let index = 0;

  function nextResult() {
    const result = results[index] ?? results[results.length - 1] ?? { data: null, error: null };
    index += 1;
    return result;
  }

  const from = vi.fn(() => {
    const builder: Record<string, unknown> = {};
    for (const op of ['select', 'eq', 'not', 'order', 'limit', 'gte', 'lte', 'insert', 'update']) {
      builder[op] = (...args: unknown[]) => {
        (payloads[op] ||= []).push(args[0]);
        return builder;
      };
    }
    builder.maybeSingle = () => Promise.resolve(nextResult());
    builder.single = () => Promise.resolve(nextResult());
    builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(nextResult()).then(resolve, reject);
    return builder;
  });

  return {
    client: { from } as never,
    queue: (...r: unknown[]) => results.push(...r),
    payloads,
  };
}

function makeCtx(mock: ReturnType<typeof createSupabaseMock>, overrides: Partial<AiToolContext> = {}): AiToolContext {
  return {
    supabase: mock.client,
    userId: 'u1',
    tier: 'plus',
    isAdmin: false,
    actionsEnabled: true,
    displayCurrency: 'USD',
    today: '2026-10-17',
    ...overrides,
  };
}

function makeRequest(ctx: AiToolContext): AiAssistantRequest {
  return {
    question: 'What am I spending?',
    history: [],
    assistantName: 'SubHalt',
    displayName: 'Ada',
    email: 'ada@example.com',
    displayCurrency: 'USD',
    ctx,
  };
}

function toolNames(picked: { type: string; function?: { name: string } }[] | undefined): string[] {
  return (picked ?? []).map((t) => (t.type === 'function' ? t.function?.name ?? '' : t.type));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedConfigured.mockReturnValue(true);
});

describe('runAssistantAgent', () => {
  it('answers unconfigured environments without calling the provider', async () => {
    mockedConfigured.mockReturnValue(false);
    const mock = createSupabaseMock();
    const result = await runAssistantAgent(makeRequest(makeCtx(mock)));
    expect(result.configured).toBe(false);
    expect(mockedCall).not.toHaveBeenCalled();
  });

  it('reads real rows through a tool round before answering', async () => {
    const mock = createSupabaseMock();
    mock.queue({ data: [makeSubRow()], error: null });

    mockedCall
      .mockResolvedValueOnce({
        message: {
          content: null,
          tool_calls: [
            { id: 'call_1', type: 'function', function: { name: 'list_subscriptions', arguments: '{}' } },
          ],
        },
        sources: [],
      })
      .mockResolvedValueOnce({
        message: { content: 'You have Netflix at $15.99/month.' },
        sources: [{ title: 'Netflix pricing', uri: 'https://netflix.com/pricing' }],
      });

    const result = await runAssistantAgent(makeRequest(makeCtx(mock)));

    expect(result.configured).toBe(true);
    expect(result.answer).toBe('You have Netflix at $15.99/month.');
    expect(result.sources).toEqual([{ title: 'Netflix pricing', uri: 'https://netflix.com/pricing' }]);

    // The second provider call carries the tool result back to the model.
    const secondMessages = mockedCall.mock.calls[1][0].messages;
    const toolMessage = secondMessages.find((m) => m.role === 'tool');
    expect(toolMessage?.content ?? '').toContain('Netflix');
  });

  it('offers read tools, write tools, and web search while the plan allows actions', async () => {
    const mock = createSupabaseMock();
    mockedCall.mockResolvedValueOnce({ message: { content: 'Hi!' }, sources: [] });
    await runAssistantAgent(makeRequest(makeCtx(mock)));
    const names = toolNames(mockedCall.mock.calls[0][0].tools as { type: string; function?: { name: string } }[]);
    expect(names).toContain('list_subscriptions');
    expect(names).toContain('get_spending_summary');
    expect(names).toContain('cancel_subscription');
    expect(names).toContain('browser_search');
  });

  it('withholds write tools on the free plan', async () => {
    const mock = createSupabaseMock();
    mockedCall.mockResolvedValueOnce({ message: { content: 'Reads only.' }, sources: [] });
    await runAssistantAgent(makeRequest(makeCtx(mock, { actionsEnabled: false })));
    const names = toolNames(mockedCall.mock.calls[0][0].tools as { type: string; function?: { name: string } }[]);
    expect(names).toContain('list_subscriptions');
    expect(names).not.toContain('cancel_subscription');
    expect(names).not.toContain('create_subscription');
  });

  it('turns a write call into a pending action and never writes during the chat turn', async () => {
    const mock = createSupabaseMock();
    mock.queue({ data: makeSubRow(), error: null });

    mockedCall
      .mockResolvedValueOnce({
        message: {
          content: null,
          tool_calls: [
            {
              id: 'call_2',
              type: 'function',
              function: { name: 'cancel_subscription', arguments: '{"id":"sub_1"}' },
            },
          ],
        },
        sources: [],
      })
      .mockResolvedValueOnce({
        message: { content: 'Confirm the card to cancel Netflix.' },
        sources: [],
      });

    const result = await runAssistantAgent(makeRequest(makeCtx(mock)));

    expect(result.pendingActions).toHaveLength(1);
    expect(result.pendingActions[0].title).toBe('Cancel Netflix');
    expect(result.pendingActions[0].tool).toBe('cancel_subscription');
    expect(mock.payloads.update).toBeUndefined();

    const secondMessages = mockedCall.mock.calls[1][0].messages;
    const toolMessage = secondMessages.find((m) => m.role === 'tool');
    expect(toolMessage?.content ?? '').toContain('awaiting_confirmation');
  });

  it('reports malformed tool arguments back to the model instead of throwing', async () => {
    const mock = createSupabaseMock();
    mockedCall
      .mockResolvedValueOnce({
        message: {
          content: null,
          tool_calls: [
            { id: 'call_3', type: 'function', function: { name: 'list_subscriptions', arguments: '{not json' } },
          ],
        },
        sources: [],
      })
      .mockResolvedValueOnce({ message: { content: 'Sorry, please try again.' }, sources: [] });

    const result = await runAssistantAgent(makeRequest(makeCtx(mock)));
    expect(result.answer).toBe('Sorry, please try again.');
    const secondMessages = mockedCall.mock.calls[1][0].messages;
    const toolMessage = secondMessages.find((m) => m.role === 'tool');
    expect(toolMessage?.content ?? '').toContain('not valid JSON');
  });
});
