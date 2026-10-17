'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, User, ExternalLink, History, Trash2, Check, ShieldCheck } from 'lucide-react';
import Sheet from '@/components/ui/sheet';
import { useSettings, useCurrency } from '@/lib/contexts/user-settings-context';
import { SubHaltAvatar } from '@/components/ui/subhalt-avatar';
import {
  fetchSubscriptions,
  getCachedSubscriptions,
  type SubscriptionRow,
} from '@/lib/services/subscription-service';
import {
  fetchSavedConversations,
  saveConversation,
  deleteConversation,
  generateTitleFromQuery,
  generateConversationId,
  type SavedConversation,
  type ChatMessageItem,
  type StoredPendingAction,
} from '@/lib/services/assistant-history-service';
import { logger } from '@/lib/logger';
import {
  calculateMonthlySpend,
  calculateAnnualSpend,
  calculatePotentialSavings,
  getNormalizedMonthlyPrice,
  formatCurrency,
} from '@/lib/utils/metrics-utils';

interface AskSubHaltModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriptions?: SubscriptionRow[];
  initialQuestion?: string;
  onSelectSubscription?: (sub: SubscriptionRow) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  relatedSubs?: SubscriptionRow[];
  sources?: { title: string; uri: string }[];
  pendingActions?: StoredPendingAction[];
}

interface AiSource {
  title: string;
  uri: string;
}

const PRESET_QUESTIONS = [
  'How much am I spending every month?',
  'Which subscriptions increased in price?',
  'What renews next?',
  'How much did I pay on bills this month?',
  'Which bill providers am I using most?',
  'Find subscriptions I could cancel.',
  'Pause a subscription I am not using.',
  'Are there any outages affecting my electricity provider?',
];

async function askSubHaltApi(params: {
  question: string;
  history: { role: 'user' | 'assistant'; text: string }[];
}): Promise<{ answer: string; sources: AiSource[]; configured: boolean; pendingActions: StoredPendingAction[] }> {
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const json = (await res.json().catch(() => null)) as
    | {
        configured?: boolean;
        answer?: string;
        sources?: AiSource[];
        pendingActions?: StoredPendingAction[];
        error?: string;
      }
    | null;

  if (!res.ok || !json) {
    const message = json?.error || 'The assistant could not reach the AI service.';
    throw new Error(message);
  }

  return {
    answer: json.answer || '',
    sources: Array.isArray(json.sources) ? json.sources : [],
    configured: Boolean(json.configured),
    pendingActions: Array.isArray(json.pendingActions) ? json.pendingActions : [],
  };
}

export function AskSubHaltModal({
  isOpen,
  onClose,
  subscriptions: providedSubs,
  initialQuestion,
  onSelectSubscription,
}: AskSubHaltModalProps) {
  const { assistantName } = useSettings();
  const { defaultCurrency, exchangeRates } = useCurrency();
  const [internalSubs, setInternalSubs] = useState<SubscriptionRow[]>(providedSubs || getCachedSubscriptions() || []);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<{ role: 'user' | 'assistant'; text: string }[]>([]);

  // Saved conversation history (Supabase-backed, localStorage mirror).
  const [savedConversations, setSavedConversations] = useState<SavedConversation[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const activeConvRef = useRef<SavedConversation | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved conversations when the modal opens.
  useEffect(() => {
    if (isOpen) {
      fetchSavedConversations().then(setSavedConversations).catch(() => {
        // History is optional; keep chat working if it fails.
      });
    }
  }, [isOpen]);

  const persistConversation = useCallback(async () => {
    if (messages.length === 0) return;
    const current = activeConvRef.current;
    const itemMessages: ChatMessageItem[] = messages.map((m) => ({
      id: m.id,
      sender: m.sender,
      text: m.text,
      timestamp: m.timestamp,
      relatedSubs: m.relatedSubs,
      pendingActions: m.pendingActions,
    }));

    if (current) {
      activeConvRef.current = { ...current, messages: itemMessages, updatedAt: new Date().toISOString() };
    } else {
      const firstUser = messages.find((m) => m.sender === 'user');
      activeConvRef.current = {
        id: generateConversationId(),
        title: generateTitleFromQuery(firstUser?.text ?? 'New conversation'),
        messages: itemMessages,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    await saveConversation(activeConvRef.current);
    const saved = activeConvRef.current;
    setSavedConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === saved.id);
      const updated = [...prev];
      if (idx >= 0) updated[idx] = saved;
      else updated.unshift(saved);
      return updated;
    });
  }, [messages]);

  // Debounced auto-save of the active conversation as messages change.
  useEffect(() => {
    if (messages.length === 0 || !isOpen) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void persistConversation();
    }, 900);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [messages, isOpen, persistConversation]);

  const handleOpenConversation = (conv: SavedConversation) => {
    setMessages(conv.messages);
    historyRef.current = conv.messages.map((m) => ({ role: m.sender, text: m.text }));
    activeConvRef.current = conv;
    setIsOffline(false);
    setShowHistory(false);
  };

  const handleDeleteConversation = async (id: string) => {
    await deleteConversation(id);
    setSavedConversations((prev) => prev.filter((c) => c.id !== id));
  };

  const updateActionState = (
    messageId: string,
    actionId: string,
    patch: Partial<StoredPendingAction>
  ) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId && m.pendingActions
          ? {
              ...m,
              pendingActions: m.pendingActions.map((a) => (a.id === actionId ? { ...a, ...patch } : a)),
            }
          : m
      )
    );
  };

  const handleConfirmAction = async (messageId: string, action: StoredPendingAction) => {
    updateActionState(messageId, action.id, { state: 'confirming', resultMessage: undefined });
    try {
      const res = await fetch('/api/ai/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: action.tool, args: action.args }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; message?: string; error?: string } | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || json?.message || 'The action could not be applied.');
      }
      updateActionState(messageId, action.id, { state: 'done', resultMessage: json.message || 'Done.' });
    } catch (err) {
      updateActionState(messageId, action.id, {
        state: 'error',
        resultMessage: err instanceof Error ? err.message : 'The action failed.',
      });
    }
  };

  const handleCancelAction = (messageId: string, action: StoredPendingAction) => {
    updateActionState(messageId, action.id, { state: 'canceled', resultMessage: undefined });
  };

  // Sync provided subscriptions into local state (render-phase adjustment).
  const [prevProvidedSubs, setPrevProvidedSubs] = useState<SubscriptionRow[] | null>(providedSubs ?? null);
  if (providedSubs && providedSubs !== prevProvidedSubs) {
    setPrevProvidedSubs(providedSubs);
    setInternalSubs(providedSubs);
  }

  useEffect(() => {
    if (isOpen && !providedSubs) {
      fetchSubscriptions().then(({ data }) => {
        if (data) setInternalSubs(data);
      }).catch(() => {
        // Keep internalSubs empty on failure; chat still works with no data.
      });
    }
  }, [isOpen, providedSubs]);

  const allSubs = providedSubs || internalSubs;
  const activeSubs = allSubs.filter(
    (s) => s.status === 'active' || s.status === 'trial'
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Initialize initial conversation state
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage: ChatMessage = {
        id: 'welcome',
        sender: 'assistant',
        text: `Hello! I'm ${assistantName}, your finance assistant for SubHalt. I answer from your real subscriptions and bills, can look up current news about any provider, and — on Plus — can make changes for you: add, edit, pause or cancel a subscription and log bill payments. Anything I change, you approve first from a confirmation card. What would you like to know?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      Promise.resolve().then(() => {
        setMessages([welcomeMessage]);
        historyRef.current = [];

        if (initialQuestion) {
          // handleProcessQuestion is declared later in the component (after the
          // open-guard early return); it's safe to call here since effects run
          // after render.
          // eslint-disable-next-line react-hooks/immutability
          handleProcessQuestion(initialQuestion);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  // Match subscriptions mentioned in the answer so the UI can offer related chips.
  const findRelatedSubs = (answerText: string): SubscriptionRow[] => {
    if (!answerText) return [];
    const lower = answerText.toLowerCase();
    const matched = allSubs.filter((s) => s.name.toLowerCase().length > 2 && lower.includes(s.name.toLowerCase()));
    return matched.slice(0, 4);
  };

  // Offline fallback used when the AI service is not configured or unreachable.
  const getOfflineAnswer = (question: string): { responseText: string; related?: SubscriptionRow[] } => {
    const qLower = question.toLowerCase().trim();

    if (qLower.includes('spending every month') || qLower.includes('how much am i spending') || qLower.includes('monthly spend')) {
      const monthlyTotal = calculateMonthlySpend(activeSubs, defaultCurrency, exchangeRates);
      const annualTotal = calculateAnnualSpend(activeSubs);
      return {
        responseText: `You are currently spending ${formatCurrency(monthlyTotal, defaultCurrency)} per month across ${activeSubs.length} active subscription${activeSubs.length === 1 ? '' : 's'}. This projects to an annual total of approximately ${formatCurrency(annualTotal, defaultCurrency)}.`,
        related: activeSubs.slice(0, 4),
      };
    }

    if (qLower.includes('increased in price') || qLower.includes('price increase') || qLower.includes('changed price')) {
      // Only notes the user (or an import) actually recorded about pricing count
      // as evidence. A bare price threshold is not a price change, so it is not
      // treated as one.
      const noted = activeSubs.filter(
        (s: SubscriptionRow) => s.notes && s.notes.toLowerCase().includes('price')
      );
      if (noted.length > 0) {
        return {
          responseText: `${noted.length === 1 ? 'One subscription has a note' : `${noted.length} subscriptions have notes`} mentioning a price change: ${noted.map((s: SubscriptionRow) => s.name).join(', ')}. Open each subscription to see the note.`,
          related: noted,
        };
      }
      return {
        responseText: "I don't have any recorded price-change notes in your subscriptions, so I can't claim one happened. Add it to a subscription's notes and I'll surface it here.",
      };
    }

    if (qLower.includes('cancel') || qLower.includes('save') || qLower.includes('could i save')) {
      const potential = calculatePotentialSavings(allSubs, defaultCurrency, exchangeRates);
      const candidates = allSubs.filter(
        (s: SubscriptionRow) => s.status === 'paused' || s.status === 'trial'
      );
      if (potential > 0 && candidates.length > 0) {
        return {
          responseText: `Based on your real data, ending or cancelling ${candidates.map((s: SubscriptionRow) => s.name).join(', ')} would free up ${formatCurrency(potential, defaultCurrency)}/month. That is the only savings I can verify right now — I won't guess beyond your numbers.`,
          related: candidates.slice(0, 3),
        };
      }
      return {
        responseText: "I went through all your subscriptions and found nothing to recommend as savings right now — there are no paused or trial subscriptions to trim. I'd rather tell you that than invent a number.",
      };
    }

    if (qLower.includes('renews next') || qLower.includes('upcoming renewal') || qLower.includes('next billing')) {
      const sortedByNext = [...activeSubs].sort(
        (a, b) => new Date(a.next_billing_date).getTime() - new Date(b.next_billing_date).getTime()
      );
      const next3 = sortedByNext.slice(0, 3);
      if (next3.length > 0) {
        const formattedList = next3
          .map((s: SubscriptionRow) => `${s.name} on ${s.next_billing_date} (${formatCurrency(s.price, s.currency || defaultCurrency)})`)
          .join('\n• ');
        return {
          responseText: `Here are your next upcoming renewals:\n• ${formattedList}`,
          related: next3,
        };
      }
      return {
        responseText: 'You have no upcoming renewals scheduled for the near future.',
      };
    }

    if (qLower.includes('software') || qLower.includes('tools') || qLower.includes('apps')) {
      const softwareSubs = activeSubs.filter(
        (s) => s.category.toLowerCase() === 'software' || s.category.toLowerCase() === 'utilities'
      );
      if (softwareSubs.length > 0) {
        const softwareSpend = softwareSubs.reduce((acc, s) => acc + getNormalizedMonthlyPrice(s), 0);
        return {
          responseText: `You have ${softwareSubs.length} active Software & Utility subscription${softwareSubs.length === 1 ? '' : 's'} totaling ${formatCurrency(softwareSpend, defaultCurrency)}/month: ${softwareSubs.map((s) => s.name).join(', ')}.`,
          related: softwareSubs,
        };
      }
      return {
        responseText: 'You currently have no active subscriptions categorized as Software.',
      };
    }

    return {
      responseText: `I've analyzed your ${activeSubs.length} active subscriptions. Total monthly expenditure is ${formatCurrency(calculateMonthlySpend(activeSubs, defaultCurrency, exchangeRates), defaultCurrency)}. If you need specifics about renewals, price changes, cancellations, bills, or current news about a provider, let me know!`,
      related: activeSubs.slice(0, 3),
    };
  };

  async function handleProcessQuestion(questionText: string) {
    if (!questionText.trim()) return;

    const trimmed = questionText.trim();
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    historyRef.current = [...historyRef.current, { role: 'user', text: trimmed }];
    setInputQuery('');
    setIsTyping(true);

    let responseText = '';
    let sources: AiSource[] = [];
    let related: SubscriptionRow[] = [];
    let pendingActions: StoredPendingAction[] = [];

    try {
      const result = await askSubHaltApi({
        question: trimmed,
        history: historyRef.current.slice(-10),
      });

      if (result.configured && result.answer) {
        responseText = result.answer;
        sources = result.sources;
        pendingActions = result.pendingActions.map((action) => ({ ...action, state: 'pending' as const }));
        setIsOffline(false);
      } else {
        // AI not configured — degrade to local intelligence so chat still works.
        setIsOffline(true);
        const offline = getOfflineAnswer(trimmed);
        responseText = offline.responseText;
        related = offline.related || [];
      }
    } catch (err) {
      logger.warn('[ai] chat API failed, using offline fallback', {
        message: err instanceof Error ? err.message : String(err),
      });
      setIsOffline(true);
      const offline = getOfflineAnswer(trimmed);
      responseText = offline.responseText;
      related = offline.related || [];
    }

    if (!related || related.length === 0) {
      related = findRelatedSubs(responseText);
    }

    const assistantMsg: ChatMessage = {
      id: `assistant-${Date.now()}`,
      sender: 'assistant',
      text: responseText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      relatedSubs: related,
      sources,
      pendingActions,
    };

    setMessages((prev) => [...prev, assistantMsg]);
    historyRef.current = [...historyRef.current, { role: 'assistant', text: responseText }];
    setIsTyping(false);
  }

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      size="full"
      title={`Ask ${assistantName}`}
      description="Connected to your subscriptions & bills"
      headerAction={
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          aria-label="Saved conversations"
          aria-expanded={showHistory}
          className="w-11 h-11 rounded-xl text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] transition-colors flex items-center justify-center cursor-pointer"
        >
          <History className="w-4.5 h-4.5" />
        </button>
      }
      /* Composer is pinned in the footer so it stays above the keyboard. */
      footer={
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleProcessQuestion(inputQuery);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder={`Ask ${assistantName} about your subscriptions, bills, or current news...`}
            className="flex-1 h-11 bg-[#121414] border border-[#1A1D1D] focus:border-[#14B8A6] rounded-xl px-3.5 text-xs text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={!inputQuery.trim() || isTyping}
            className="px-4 py-3 min-h-[44px] rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] disabled:opacity-40 disabled:cursor-not-allowed text-[#091512] font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <span>Ask</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      }
    >
        {/* Saved Conversations Panel */}
        {showHistory && (
          <div className="mb-4 p-3 rounded-xl border border-[#1A1D1D] bg-[#0F1111] max-h-56 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                Saved conversations
              </span>
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="text-[11px] text-[#94A3B8] hover:text-[#F5F7F6] cursor-pointer"
              >
                Close
              </button>
            </div>
            {savedConversations.length === 0 && (
              <p className="text-[11px] text-[#94A3B8]">No saved conversations yet.</p>
            )}
            <div className="space-y-1">
              {savedConversations.map((conv) => (
                <div
                  key={conv.id}
                  className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 bg-[#121414] hover:bg-[#1A1D1D] transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => handleOpenConversation(conv)}
                    className="flex-1 text-left min-w-0 cursor-pointer"
                  >
                    <span className="text-xs text-[#F5F7F6] truncate block">{conv.title}</span>
                    <span className="text-[10px] text-[#94A3B8]">
                      {conv.messages.length} message{conv.messages.length === 1 ? '' : 's'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteConversation(conv.id)}
                    aria-label={`Delete conversation ${conv.title}`}
                    className="text-[#94A3B8] hover:text-red-400 transition-colors shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Preset Question Chips */}
        <div className="mb-4 py-2 px-1 bg-[#0F1111] rounded-xl border border-[#1A1D1D] overflow-x-auto scrollbar-none flex items-center gap-2">
          <span className="text-[11px] font-medium text-[#94A3B8] shrink-0 mr-1">
            Suggested:
          </span>
          {PRESET_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => handleProcessQuestion(q)}
              disabled={isTyping}
              className="px-2.5 py-1 rounded-lg bg-[#121414] hover:bg-[#1A1D1D] text-[#F5F7F6] border border-[#1A1D1D] hover:border-[#3F3F46] text-xs transition-colors shrink-0 cursor-pointer disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Offline mode notice */}
        {isOffline && (
          <div className="px-4 py-2 bg-[#1A1508]/80 border-b border-[#3F3F46]/30 flex items-center justify-between gap-3">
            <p className="text-[11px] text-[#FBBF24] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FBBF24] shrink-0" />
              <span>
                Offline mode: answering from local data. Add a <span className="font-semibold">GROQ_API_KEY</span>{' '}
                to enable live AI answers &amp; web search.
              </span>
            </p>
            <button
              type="button"
              onClick={() => setIsOffline(false)}
              aria-label="Dismiss offline mode notice"
              className="text-[#FBBF24]/70 hover:text-[#FBBF24] shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Chat History Messages Stream. The Sheet body owns the scroll, so
            this must not create a second nested scroll root. */}
        <div className="space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'assistant' && (
                <SubHaltAvatar size="md" className="mt-0.5" />
              )}

              <div
                className={`max-w-[82%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-[#14B8A6] text-[#091512] font-medium rounded-tr-none'
                    : 'bg-[#121414] border border-[#1A1D1D] text-[#F5F7F6] rounded-tl-none space-y-2'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>

                {/* Subscriptions chips in answer if present */}
                {msg.relatedSubs && msg.relatedSubs.length > 0 && (
                  <div className="pt-2 border-t border-[#1A1D1D]/70 space-y-1.5">
                    <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider block">
                      Related Subscriptions:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.relatedSubs.map((sub) => (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => {
                            onClose();
                            onSelectSubscription?.(sub);
                          }}
                          className="px-2 py-1 rounded-md bg-[#1A1D1D] hover:bg-[#262929] text-[#F5F7F6] border border-[#3F3F46]/40 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                        >
                          <span>{sub.name}</span>
                          <span className="text-[#14B8A6]">
                            ({formatCurrency(sub.price, sub.currency || defaultCurrency)})
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Web sources cited by the model */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="pt-2 border-t border-[#1A1D1D]/70 space-y-1.5">
                    <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider block">
                      Sources:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.sources.map((s, i) => (
                        <a
                          key={`${s.uri}-${i}`}
                          href={s.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 rounded-md bg-[#1A1D1D] hover:bg-[#262929] text-[#14B8A6] border border-[#3F3F46]/40 text-[11px] font-medium inline-flex items-center gap-1 max-w-[220px] truncate"
                        >
                          <span className="truncate">{s.title}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pending write actions — nothing runs until the user confirms */}
                {msg.pendingActions && msg.pendingActions.length > 0 && (
                  <div className="pt-2 space-y-2">
                    {msg.pendingActions.map((action) => {
                      const state = action.state ?? 'pending';
                      return (
                        <div
                          key={action.id}
                          className="rounded-xl border border-[#14B8A6]/40 bg-[#0F1111] p-3 space-y-2"
                        >
                          <div className="flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-[#14B8A6] shrink-0" />
                            <span className="text-xs font-semibold text-[#F5F7F6]">{action.title}</span>
                          </div>
                          <p className="text-[11px] text-[#94A3B8]">{action.description}</p>
                          {action.details.length > 0 && (
                            <div className="space-y-1 rounded-lg bg-[#121414] px-2.5 py-2">
                              {action.details.map((detail, i) => (
                                <div key={`${detail.label}-${i}`} className="flex items-center justify-between gap-3 text-[11px]">
                                  <span className="text-[#94A3B8]">{detail.label}</span>
                                  <span className="text-[#F5F7F6] font-medium text-right">{detail.value}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {state === 'pending' && (
                            <div className="flex gap-2 pt-0.5">
                              <button
                                type="button"
                                onClick={() => handleConfirmAction(msg.id, action)}
                                className="px-3 py-1.5 rounded-lg bg-[#14B8A6] hover:bg-[#0D9488] text-[#091512] font-semibold text-[11px] transition-colors cursor-pointer"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancelAction(msg.id, action)}
                                className="px-3 py-1.5 rounded-lg bg-[#1A1D1D] hover:bg-[#262929] text-[#94A3B8] border border-[#3F3F46]/40 text-[11px] font-medium transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                          {state === 'confirming' && (
                            <p className="text-[11px] text-[#94A3B8] animate-pulse">Applying...</p>
                          )}
                          {state === 'done' && (
                            <p className="text-[11px] text-[#14B8A6] flex items-center gap-1">
                              <Check className="w-3 h-3 shrink-0" />
                              <span>{action.resultMessage || 'Done.'}</span>
                            </p>
                          )}
                          {state === 'canceled' && (
                            <p className="text-[11px] text-[#94A3B8]">Canceled — nothing was changed.</p>
                          )}
                          {state === 'error' && (
                            <p className="text-[11px] text-red-400">{action.resultMessage || 'The action failed.'}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <span
                  className={`text-[9px] block mt-1 ${
                    msg.sender === 'user' ? 'text-[#091512]/70 text-right' : 'text-[#94A3B8]'
                  }`}
                >
                  {msg.timestamp}
                </span>
              </div>

              {msg.sender === 'user' && (
                <div className="w-7 h-7 rounded-lg bg-[#1A1D1D] border border-[#3F3F46]/40 flex items-center justify-center text-[#F5F7F6] shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-3 justify-start">
              <SubHaltAvatar size="md" className="animate-pulse" />
              <div className="bg-[#121414] border border-[#1A1D1D] rounded-2xl rounded-tl-none px-4 py-2.5 text-xs text-[#94A3B8] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#14B8A6] animate-ping" />
                <span>{assistantName} is thinking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
    </Sheet>
  );
}
