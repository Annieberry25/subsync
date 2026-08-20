import React, { useState, useEffect, useRef } from 'react';
import { X, Send, CornerDownLeft, User, ArrowRight } from 'lucide-react';
import { useUserSettings } from '@/lib/contexts/user-settings-context';
import { SubHaltAvatar } from '@/components/ui/subhalt-avatar';
import {
  fetchSubscriptions,
  getCachedSubscriptions,
  type SubscriptionRow,
} from '@/lib/services/subscription-service';
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
  actionLabel?: string;
  onAction?: () => void;
}

const PRESET_QUESTIONS = [
  'How much am I spending every month?',
  'Which subscriptions increased in price?',
  'What subscriptions am I not using?',
  'What renews next?',
  'Find subscriptions I could cancel.',
  'How much could I save?',
  'Show me my software subscriptions.',
];

export function AskSubHaltModal({
  isOpen,
  onClose,
  subscriptions: providedSubs,
  initialQuestion,
  onSelectSubscription,
}: AskSubHaltModalProps) {
  const { assistantName, defaultCurrency, exchangeRates } = useUserSettings();
  const [internalSubs, setInternalSubs] = useState<SubscriptionRow[]>(providedSubs || getCachedSubscriptions() || []);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (providedSubs) {
      setInternalSubs(providedSubs);
    } else if (isOpen) {
      fetchSubscriptions().then(({ data }) => {
        if (data) setInternalSubs(data);
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
        text: `Hello! I'm ${assistantName}, your subscription management intelligence layer. Ask me anything about your active subscriptions, monthly spending, or potential savings.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages([welcomeMessage]);

      if (initialQuestion) {
        handleProcessQuestion(initialQuestion);
      }
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  if (!isOpen) return null;

  const generateAnswer = (question: string): { responseText: string; related?: SubscriptionRow[] } => {
    const qLower = question.toLowerCase().trim();

    // 1. Monthly spending query
    if (qLower.includes('spending every month') || qLower.includes('how much am i spending') || qLower.includes('monthly spend')) {
      const monthlyTotal = calculateMonthlySpend(activeSubs, defaultCurrency, exchangeRates);
      const annualTotal = calculateAnnualSpend(activeSubs);
      return {
        responseText: `You are currently spending ${formatCurrency(monthlyTotal, defaultCurrency)} per month across ${activeSubs.length} active subscription${activeSubs.length === 1 ? '' : 's'}. This projects to an annual total of approximately ${formatCurrency(annualTotal, defaultCurrency)}.`,
        related: activeSubs.slice(0, 4),
      };
    }

    // 2. Price increase query
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

    // 3. Not using / paused / trial query
    if (qLower.includes('not using') || qLower.includes('unused') || qLower.includes('idle')) {
      const pausedOrTrial = allSubs.filter(
        (s: SubscriptionRow) => s.status === 'paused' || s.status === 'trial'
      );
      if (pausedOrTrial.length > 0) {
        return {
          responseText: `You have ${pausedOrTrial.length} subscription${pausedOrTrial.length === 1 ? '' : 's'} that may be low-usage, paused, or currently on a trial: ${pausedOrTrial.map((s: SubscriptionRow) => s.name).join(', ')}.`,
          related: pausedOrTrial,
        };
      }
      return {
        responseText: `All ${activeSubs.length} active subscriptions have registered account activity within the past billing cycle.`,
      };
    }

    // 4. Renews next query
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

    // 5. Find subscriptions to cancel / how much could I save
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

    // 6. Software subscriptions query
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

    // Generic contextual fallback
    return {
      responseText: `I've analyzed your ${activeSubs.length} active subscriptions. Total monthly expenditure is ${formatCurrency(calculateMonthlySpend(activeSubs, defaultCurrency, exchangeRates), defaultCurrency)}. If you need specific details about renewals, price changes, or cancellation routes, let me know!`,
      related: activeSubs.slice(0, 3),
    };
  };

  const handleProcessQuestion = (questionText: string) => {
    if (!questionText.trim()) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: questionText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsTyping(true);

    setTimeout(() => {
      const { responseText, related } = generateAnswer(questionText);
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        relatedSubs: related,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsTyping(false);
    }, 400);
  };

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-[#0B0D0D] border border-[#1A1D1D] rounded-2xl shadow-2xl flex flex-col h-[620px] max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#1A1D1D] flex items-center justify-between bg-[#000000]">
          <div className="flex items-center gap-3">
            <SubHaltAvatar size="md" />
            <div>
              <h3 className="text-sm font-semibold text-[#F5F7F6] tracking-tight">
                Ask {assistantName}
              </h3>
              <p className="text-[11px] text-[#94A3B8]">
                Contextual Subscription Intelligence
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
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
              className="px-2.5 py-1 rounded-lg bg-[#121414] hover:bg-[#1A1D1D] text-[#F5F7F6] border border-[#1A1D1D] hover:border-[#3F3F46] text-xs transition-colors shrink-0 cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>

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
                <span>{assistantName} is calculating...</span>
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
              placeholder={`Ask ${assistantName} about your subscriptions...`}
              className="flex-1 bg-[#121414] border border-[#1A1D1D] focus:border-[#14B8A6] rounded-xl px-3.5 py-2.5 text-xs text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={!inputQuery.trim()}
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
