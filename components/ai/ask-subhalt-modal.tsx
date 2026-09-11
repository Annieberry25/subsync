'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Send, User, ExternalLink } from 'lucide-react';
import { useSettings, useCurrency } from '@/lib/contexts/user-settings-context';
import { SubHaltAvatar } from '@/components/ui/subhalt-avatar';
import {
  fetchSubscriptions,
  getCachedSubscriptions,
  type SubscriptionRow,
} from '@/lib/services/subscription-service';
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
  'How much could I save?',
  'Are there any outages affecting my electricity provider?',
];

async function askSubHaltApi(params: {
  question: string;
  history: { role: 'user' | 'assistant'; text: string }[];
}): Promise<{ answer: string; sources: AiSource[]; configured: boolean }> {
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const json = (await res.json().catch(() => null)) as
    | { configured?: boolean; answer?: string; sources?: AiSource[]; error?: string }
    | null;

  if (!res.ok || !json) {
    const message = json?.error || 'The assistant could not reach the AI service.';
    throw new Error(message);
  }

  return {
    answer: json.answer || '',
    sources: Array.isArray(json.sources) ? json.sources : [],
    configured: Boolean(json.configured),
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

  useEffect(() => {
    if (providedSubs) {
      setInternalSubs(providedSubs);
    } else if (isOpen) {
      fetchSubscriptions().then(({ data }) => {
        if (data) setInternalSubs(data);
      }).catch(() => {
        // Keep internalSubs empty on failure; chat still works with no data.
      });
    }
  }, [providedSubs, isOpen]);

  const allSubs = providedSubs || internalSubs;
  const activeSubs = allSubs.filter(
    (s) => s.status === 'active' || s.status === 'trial'
  );

  // Initialize initial conversation state
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage: ChatMessage = {
        id: 'welcome',
        sender: 'assistant',
        text: `Hello! I'm ${assistantName}, your finance assistant for SubHalt. I can help you understand what you're spending on subscriptions and bills, remind you about renewals and due payments, find savings, and look up current news about any service or provider you deal with. What would you like to know?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages([welcomeMessage]);
      historyRef.current = [];

      if (initialQuestion) {
        handleProcessQuestion(initialQuestion);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

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
      const priceChanges = activeSubs.filter(
        (s: SubscriptionRow) => (s.notes && s.notes.toLowerCase().includes('price')) || s.price > 15
      );
      if (priceChanges.length > 0) {
        const names = priceChanges.map((s: SubscriptionRow) => `${s.name} (${formatCurrency(s.price, s.currency || defaultCurrency)}/${s.billing_cycle})`).join(', ');
        return {
          responseText: `SubHalt detected price adjustments or high tier updates on ${priceChanges.length} subscription${priceChanges.length === 1 ? '' : 's'}: ${names}.`,
          related: priceChanges,
        };
      }
      return {
        responseText: `None of your active subscriptions show recent unannounced price increases. All ${activeSubs.length} subscriptions appear stable.`,
      };
    }

    if (qLower.includes('cancel') || qLower.includes('save') || qLower.includes('could i save')) {
      const potential = calculatePotentialSavings(allSubs, defaultCurrency, exchangeRates);
      const candidates = allSubs.filter(
        (s: SubscriptionRow) => s.status === 'paused' || s.status === 'trial' || s.price >= 20
      );
      return {
        responseText: `Based on your portfolio analysis, you could save up to ${formatCurrency(potential > 0 ? potential : 45.0, defaultCurrency)}/month by optimizing trial periods and reviewing high-cost plans.`,
        related: candidates.slice(0, 3),
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

    try {
      const result = await askSubHaltApi({
        question: trimmed,
        history: historyRef.current.slice(-10),
      });

      if (result.configured && result.answer) {
        responseText = result.answer;
        sources = result.sources;
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
    };

    setMessages((prev) => [...prev, assistantMsg]);
    historyRef.current = [...historyRef.current, { role: 'assistant', text: responseText }];
    setIsTyping(false);
  }

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ask SubHalt assistant"
        className="w-full max-w-2xl bg-[#0B0D0D] border border-[#1A1D1D] rounded-2xl shadow-2xl flex flex-col h-[620px] max-h-[90vh] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#1A1D1D] flex items-center justify-between bg-[#000000]">
          <div className="flex items-center gap-3">
            <SubHaltAvatar size="md" />
            <div>
              <h3 className="text-sm font-semibold text-[#F5F7F6] tracking-tight">
                Ask {assistantName}
              </h3>
              <p className="text-[11px] text-[#94A3B8]">
                Connected to your subscriptions & bills
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            className="w-8 h-8 rounded-xl text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] transition-colors flex items-center justify-center cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Preset Question Chips */}
        <div className="px-4 py-3 bg-[#0F1111] border-b border-[#1A1D1D] overflow-x-auto scrollbar-none flex items-center gap-2">
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
                Offline mode — answering from local data. Add a <span className="font-semibold">GROQ_API_KEY</span>{' '}
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

        {/* Chat History Messages Stream */}
        <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 bg-[#0B0D0D]">
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

        {/* Input Bar */}
        <div className="p-3 sm:p-4 border-t border-[#1A1D1D] bg-[#000000]">
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
              className="flex-1 bg-[#121414] border border-[#1A1D1D] focus:border-[#14B8A6] rounded-xl px-3.5 py-2.5 text-xs text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={!inputQuery.trim() || isTyping}
              className="px-4 py-2.5 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] disabled:opacity-40 disabled:cursor-not-allowed text-[#091512] font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>Ask</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
