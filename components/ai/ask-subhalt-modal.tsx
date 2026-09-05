'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  User,
  History,
  Plus,
  MoreVertical,
  Edit2,
  Trash2,
  ChevronLeft,
  MessageSquare,
} from 'lucide-react';
import { useUserSettings } from '@/lib/contexts/user-settings-context';
import { SubHaltAvatar } from '@/components/ui/subhalt-avatar';
import {
  fetchSubscriptions,
  getCachedSubscriptions,
  type SubscriptionRow,
} from '@/lib/services/subscription-service';
import { formatCurrency } from '@/lib/utils/metrics-utils';
import {
  processAssistantQuery,
  type ConversationContext,
} from '@/lib/services/assistant-engine';
import {
  getSavedConversations,
  getGroupedConversations,
  getConversationById,
  saveConversation,
  renameConversation,
  deleteConversation,
  deleteAllConversations,
  generateTitleFromQuery,
  type SavedConversation,
  type ChatMessageItem,
} from '@/lib/services/assistant-history-service';
import ConfirmDialog from '@/components/ui/confirm-dialog';

interface AskSubHaltModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriptions?: SubscriptionRow[];
  initialQuestion?: string;
  onSelectSubscription?: (sub: SubscriptionRow) => void;
}

const QUICK_PROMPTS = [
  'What renews next?',
  'What costs me the most?',
  'What can I cancel?',
  'How much am I spending?',
  'What about bills payment?',
];

export function AskSubHaltModal({
  isOpen,
  onClose,
  subscriptions: providedSubs,
  initialQuestion,
  onSelectSubscription,
}: AskSubHaltModalProps) {
  const { defaultCurrency, exchangeRates } = useUserSettings();

  // Subscriptions state
  const [internalSubs, setInternalSubs] = useState<SubscriptionRow[]>(
    providedSubs || getCachedSubscriptions() || []
  );

  // History & Active Conversation State
  const [savedConversations, setSavedConversations] = useState<SavedConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);

  // Input & Typing state
  const [inputQuery, setInputQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Multi-turn conversation context state
  const [conversationContext, setConversationContext] = useState<ConversationContext>({});

  // Menu & Dialog States
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renamingConv, setRenamingConv] = useState<SavedConversation | null>(null);
  const [renameTitleInput, setRenameTitleInput] = useState('');

  const [deletingConv, setDeletingConv] = useState<SavedConversation | null>(null);
  const [isDeletingAllOpen, setIsDeletingAllOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync subscriptions
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

  // Initialize or restore conversation when opened
  useEffect(() => {
    if (isOpen) {
      const convs = getSavedConversations();
      setSavedConversations(convs);

      if (convs.length > 0 && !activeConvId) {
        // Restore most recent conversation
        const mostRecent = convs[0];
        setActiveConvId(mostRecent.id);
        setMessages(mostRecent.messages || []);
      } else if (convs.length === 0 && !activeConvId) {
        // Start fresh conversation ID
        const newId = `conv_${Date.now()}`;
        setActiveConvId(newId);
        setMessages([]);
      }

      if (initialQuestion) {
        handleProcessQuestion(initialQuestion);
      }
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  if (!isOpen) return null;

  const handleStartNewConversation = () => {
    const newId = `conv_${Date.now()}`;
    setActiveConvId(newId);
    setMessages([]);
    setConversationContext({});
    setIsHistoryDrawerOpen(false);
  };

  const handleSelectConversation = (conv: SavedConversation) => {
    setActiveConvId(conv.id);
    setMessages(conv.messages || []);
    setConversationContext({});
    setIsHistoryDrawerOpen(false);
    setOpenMenuId(null);
  };

  const handleProcessQuestion = (questionText: string) => {
    if (!questionText.trim() || isTyping) return;

    const queryText = questionText.trim();
    const userMsg: ChatMessageItem = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputQuery('');
    setIsTyping(true);

    const convId = activeConvId || `conv_${Date.now()}`;
    if (!activeConvId) setActiveConvId(convId);

    setTimeout(() => {
      try {
        const { responseText, relatedSubs, nextContext } = processAssistantQuery(
          queryText,
          allSubs,
          conversationContext,
          { defaultCurrency, exchangeRates }
        );

        setConversationContext(nextContext);

        const assistantMsg: ChatMessageItem = {
          id: `assistant-${Date.now()}`,
          sender: 'assistant',
          text: responseText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          relatedSubs,
        };

        const finalMessages = [...updatedMessages, assistantMsg];
        setMessages(finalMessages);

        // Auto-save conversation to storage
        const existingConv = getConversationById(convId);
        const autoTitle = existingConv?.title || generateTitleFromQuery(queryText);

        const savedConvObj: SavedConversation = {
          id: convId,
          title: autoTitle,
          messages: finalMessages,
          createdAt: existingConv?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const updatedList = saveConversation(savedConvObj);
        setSavedConversations(updatedList);
      } catch (err) {
        console.error('SubHalt Assistant processing error:', err);
        const errorMsg: ChatMessageItem = {
          id: `error-${Date.now()}`,
          sender: 'assistant',
          text: "Sorry, I couldn't process that right now. Please try again.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsTyping(false);
      }
    }, 300);
  };

  // Rename action
  const handleConfirmRename = () => {
    if (renamingConv && renameTitleInput.trim()) {
      const updatedList = renameConversation(renamingConv.id, renameTitleInput.trim());
      setSavedConversations(updatedList);
      setRenamingConv(null);
      setRenameTitleInput('');
    }
  };

  // Delete single conversation action
  const handleConfirmDeleteSingle = () => {
    if (deletingConv) {
      const updatedList = deleteConversation(deletingConv.id);
      setSavedConversations(updatedList);

      if (activeConvId === deletingConv.id) {
        if (updatedList.length > 0) {
          setActiveConvId(updatedList[0].id);
          setMessages(updatedList[0].messages);
        } else {
          handleStartNewConversation();
        }
      }

      setDeletingConv(null);
    }
  };

  // Delete all conversations action
  const handleConfirmDeleteAll = () => {
    deleteAllConversations();
    setSavedConversations([]);
    handleStartNewConversation();
    setIsDeletingAllOpen(false);
    setIsHistoryDrawerOpen(false);
  };

  const groupedHistory = getGroupedConversations();

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
      {/* Outer Modal Container */}
      <div className="w-full sm:max-w-4xl bg-[#090C0B] border-0 sm:border sm:border-[#1A2220] sm:rounded-2xl shadow-2xl flex flex-col sm:flex-row h-[100dvh] sm:h-[680px] sm:max-h-[90vh] overflow-hidden">
        
        {/* =================================================== */}
        {/* LEFT PANEL / SIDE DRAWER: CONVERSATION HISTORY      */}
        {/* =================================================== */}
        <div
          className={`${
            isHistoryDrawerOpen ? 'flex' : 'hidden sm:flex'
          } w-full sm:w-64 bg-[#070A09] border-b sm:border-b-0 sm:border-r border-[#161F1D] flex-col shrink-0 transition-all z-20`}
        >
          {/* Drawer Header */}
          <div className="p-3.5 sm:p-4 border-b border-[#161F1D] flex items-center justify-between bg-[#050706]">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#14B8A6]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                Your Conversations
              </span>
            </div>

            {/* Mobile close history view button */}
            <button
              type="button"
              onClick={() => setIsHistoryDrawerOpen(false)}
              className="sm:hidden text-[#94A3B8] hover:text-[#F5F7F6] p-1 rounded-lg hover:bg-[#121917]"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>

          {/* New Conversation Action */}
          <div className="p-3 border-b border-[#161F1D]">
            <button
              type="button"
              onClick={handleStartNewConversation}
              className="w-full py-2 px-3 rounded-xl bg-[#121B19] hover:bg-[#1A2724] text-[#F5F7F6] border border-[#1E2E2A] text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#14B8A6]" />
              <span>New conversation</span>
            </button>
          </div>

          {/* Conversations History List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-4 text-xs">
            {savedConversations.length === 0 ? (
              <div className="py-8 text-center text-[#94A3B8] space-y-1">
                <MessageSquare className="w-6 h-6 mx-auto text-[#1E2E2A]" />
                <p className="text-[11px]">No saved conversations yet.</p>
              </div>
            ) : (
              <>
                {/* TODAY */}
                {groupedHistory.today.length > 0 && (
                  <div className="space-y-1">
                    <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8] block">
                      Today
                    </span>
                    {groupedHistory.today.map((conv) => (
                      <ConversationHistoryItem
                        key={conv.id}
                        conv={conv}
                        isActive={conv.id === activeConvId}
                        isMenuOpen={openMenuId === conv.id}
                        onSelect={() => handleSelectConversation(conv)}
                        onToggleMenu={() =>
                          setOpenMenuId(openMenuId === conv.id ? null : conv.id)
                        }
                        onRename={() => {
                          setRenamingConv(conv);
                          setRenameTitleInput(conv.title);
                          setOpenMenuId(null);
                        }}
                        onDelete={() => {
                          setDeletingConv(conv);
                          setOpenMenuId(null);
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* YESTERDAY */}
                {groupedHistory.yesterday.length > 0 && (
                  <div className="space-y-1">
                    <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8] block">
                      Yesterday
                    </span>
                    {groupedHistory.yesterday.map((conv) => (
                      <ConversationHistoryItem
                        key={conv.id}
                        conv={conv}
                        isActive={conv.id === activeConvId}
                        isMenuOpen={openMenuId === conv.id}
                        onSelect={() => handleSelectConversation(conv)}
                        onToggleMenu={() =>
                          setOpenMenuId(openMenuId === conv.id ? null : conv.id)
                        }
                        onRename={() => {
                          setRenamingConv(conv);
                          setRenameTitleInput(conv.title);
                          setOpenMenuId(null);
                        }}
                        onDelete={() => {
                          setDeletingConv(conv);
                          setOpenMenuId(null);
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* EARLIER */}
                {groupedHistory.earlier.length > 0 && (
                  <div className="space-y-1">
                    <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8] block">
                      Earlier
                    </span>
                    {groupedHistory.earlier.map((conv) => (
                      <ConversationHistoryItem
                        key={conv.id}
                        conv={conv}
                        isActive={conv.id === activeConvId}
                        isMenuOpen={openMenuId === conv.id}
                        onSelect={() => handleSelectConversation(conv)}
                        onToggleMenu={() =>
                          setOpenMenuId(openMenuId === conv.id ? null : conv.id)
                        }
                        onRename={() => {
                          setRenamingConv(conv);
                          setRenameTitleInput(conv.title);
                          setOpenMenuId(null);
                        }}
                        onDelete={() => {
                          setDeletingConv(conv);
                          setOpenMenuId(null);
                        }}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Drawer Footer: Delete All Action */}
          {savedConversations.length > 0 && (
            <div className="p-3 border-t border-[#161F1D] bg-[#050706]">
              <button
                type="button"
                onClick={() => setIsDeletingAllOpen(true)}
                className="w-full py-2 px-3 rounded-xl text-[#D9363E] hover:bg-[#D9363E]/10 border border-transparent hover:border-[#D9363E]/20 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete all conversations</span>
              </button>
            </div>
          )}
        </div>

        {/* =================================================== */}
        {/* RIGHT PANEL: ACTIVE CONVERSATION VIEW               */}
        {/* =================================================== */}
        <div
          className={`${
            isHistoryDrawerOpen ? 'hidden sm:flex' : 'flex'
          } flex-1 flex-col min-w-0 bg-[#090C0B] h-full overflow-hidden`}
        >
          {/* Header Bar */}
          <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[#161F1D] flex items-center justify-between bg-[#070A09] shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <SubHaltAvatar size="md" />
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-[#F5F7F6] tracking-tight truncate">
                  SubHalt Assistant
                </h3>
                <p className="text-[11px] text-[#94A3B8] truncate">
                  Your subscriptions, spending & bills
                </p>
              </div>
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Toggle History Drawer */}
              <button
                type="button"
                onClick={() => setIsHistoryDrawerOpen(!isHistoryDrawerOpen)}
                title="Conversation history"
                className="px-2.5 py-1.5 rounded-xl bg-[#121B19] hover:bg-[#1A2724] text-[#F5F7F6] border border-[#1E2E2A] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <History className="w-3.5 h-3.5 text-[#14B8A6]" />
                <span className="hidden sm:inline">History</span>
              </button>

              {/* New Conversation button in Header */}
              <button
                type="button"
                onClick={handleStartNewConversation}
                title="Start new conversation"
                className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-[#121B19] hover:bg-[#1A2724] text-[#F5F7F6] border border-[#1E2E2A] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#14B8A6]" />
                <span className="hidden sm:inline">New</span>
              </button>

              {/* Close Assistant Modal */}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close Assistant"
                className="p-2 rounded-xl text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#121917] transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          {/* Active Conversation Messages Stream or Empty State */}
          <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 bg-[#090C0B]">
            {messages.length === 0 ? (
              /* EMPTY STATE */
              <div className="h-full flex flex-col items-center justify-center text-center p-4 max-w-md mx-auto space-y-5 animate-in fade-in duration-200">
                <SubHaltAvatar size="2xl" className="shadow-lg" />
                <div className="space-y-1.5">
                  <h4 className="text-base sm:text-lg font-semibold text-[#F5F7F6] tracking-tight">
                    Hi, I'm SubHalt Assistant.
                  </h4>
                  <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
                    I can help you understand your subscriptions, spending, bills and potential savings.
                  </p>
                </div>

                {/* Quick Prompts List */}
                <div className="w-full space-y-2 pt-2">
                  <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block">
                    Suggested prompts:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                    {QUICK_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => handleProcessQuestion(prompt)}
                        className="p-2.5 rounded-xl bg-[#111716] hover:bg-[#1A2422] text-[#F5F7F6] border border-[#1C2624] hover:border-[#14B8A6]/40 text-xs transition-colors cursor-pointer active:scale-98"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* ACTIVE MESSAGES STREAM */
              <>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${
                      msg.sender === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {msg.sender === 'assistant' && (
                      <SubHaltAvatar size="md" className="mt-0.5 shrink-0" />
                    )}

                    <div
                      className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-[#14B8A6] text-[#051310] font-medium rounded-tr-none shadow-sm'
                          : 'bg-[#111716] border border-[#1C2624] text-[#F5F7F6] rounded-tl-none space-y-2.5 shadow-sm'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{msg.text}</div>

                      {/* Related subscriptions chips if present */}
                      {msg.relatedSubs && msg.relatedSubs.length > 0 && (
                        <div className="pt-2 border-t border-[#1C2624] space-y-1.5">
                          <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider block">
                            Target Subscriptions:
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
                                className="px-2.5 py-1 rounded-md bg-[#182220] hover:bg-[#202E2B] text-[#F5F7F6] border border-[#2B3C38] text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <span>{sub.name}</span>
                                <span className="text-[#14B8A6] font-semibold">
                                  ({formatCurrency(sub.price, sub.currency || defaultCurrency)})
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <span
                        className={`text-[9px] block mt-1 ${
                          msg.sender === 'user' ? 'text-[#051310]/70 text-right' : 'text-[#94A3B8]'
                        }`}
                      >
                        {msg.timestamp}
                      </span>
                    </div>

                    {msg.sender === 'user' && (
                      <div className="w-7 h-7 rounded-lg bg-[#121B19] border border-[#1E2E2A] flex items-center justify-center text-[#F5F7F6] shrink-0 mt-0.5">
                        <User className="w-3.5 h-3.5 text-[#94A3B8]" />
                      </div>
                    )}
                  </div>
                ))}

                {/* Processing Indicator */}
                {isTyping && (
                  <div className="flex gap-3 justify-start items-center">
                    <SubHaltAvatar size="md" className="animate-pulse" />
                    <div className="bg-[#111716] border border-[#1C2624] rounded-2xl rounded-tl-none px-4 py-2.5 text-xs text-[#94A3B8] flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#14B8A6] animate-ping" />
                      <span>SubHalt Assistant is calculating...</span>
                    </div>
                  </div>
                )}
              </>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar / Messaging Composer */}
          <div className="p-3 sm:p-4 border-t border-[#161F1D] bg-[#070A09] pb-safe shrink-0">
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
                placeholder="Ask SubHalt Assistant..."
                aria-label="Ask SubHalt Assistant"
                disabled={isTyping}
                className="flex-1 bg-[#111716] border border-[#1C2624] focus:border-[#14B8A6] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none transition-colors disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!inputQuery.trim() || isTyping}
                className="px-4 py-2.5 rounded-xl bg-[#14B8A6] hover:bg-[#0F766E] disabled:opacity-40 disabled:cursor-not-allowed text-[#051310] font-semibold text-xs sm:text-sm transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 min-h-[40px]"
              >
                <span className="hidden sm:inline">Ask</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>

      </div>

      {/* =================================================== */}
      {/* DIALOGS & MODALS                                   */}
      {/* =================================================== */}

      {/* RENAME DIALOG */}
      {renamingConv && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0D1211] border border-[#1C2624] rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xl">
            <h4 className="text-sm font-semibold text-[#F5F7F6]">
              Rename conversation
            </h4>
            <input
              type="text"
              value={renameTitleInput}
              onChange={(e) => setRenameTitleInput(e.target.value)}
              placeholder="Conversation title..."
              className="w-full bg-[#111716] border border-[#1C2624] focus:border-[#14B8A6] rounded-xl px-3 py-2 text-xs text-[#F5F7F6] focus:outline-none"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setRenamingConv(null)}
                className="px-3 py-1.5 rounded-lg bg-[#161F1D] hover:bg-[#202B29] text-[#94A3B8] text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRename}
                disabled={!renameTitleInput.trim()}
                className="px-3.5 py-1.5 rounded-lg bg-[#14B8A6] hover:bg-[#0F766E] disabled:opacity-50 text-[#051310] font-semibold text-xs"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE SINGLE CONVERSATION DIALOG */}
      <ConfirmDialog
        isOpen={!!deletingConv}
        onClose={() => setDeletingConv(null)}
        onConfirm={handleConfirmDeleteSingle}
        title={`Delete "${deletingConv?.title}"?`}
        description="Are you sure you want to delete this conversation? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />

      {/* DELETE ALL CONVERSATIONS DIALOG */}
      <ConfirmDialog
        isOpen={isDeletingAllOpen}
        onClose={() => setIsDeletingAllOpen(false)}
        onConfirm={handleConfirmDeleteAll}
        title="Delete all conversations?"
        description="This will permanently remove your saved assistant conversations."
        confirmText="Delete all"
        variant="danger"
      />
    </div>
  );
}

// Conversation item component in history drawer
function ConversationHistoryItem({
  conv,
  isActive,
  isMenuOpen,
  onSelect,
  onToggleMenu,
  onRename,
  onDelete,
}: {
  conv: SavedConversation;
  isActive: boolean;
  isMenuOpen: boolean;
  onSelect: () => void;
  onToggleMenu: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const lastMsg = conv.messages && conv.messages.length > 0 ? conv.messages[conv.messages.length - 1].text : '';
  const formattedTime = new Date(conv.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className={`group relative rounded-xl p-2.5 flex items-center justify-between gap-2 transition-colors cursor-pointer ${
        isActive
          ? 'bg-[#14B8A6]/10 border border-[#14B8A6]/30 text-[#F5F7F6]'
          : 'hover:bg-[#111716] border border-transparent text-[#94A3B8] hover:text-[#F5F7F6]'
      }`}
      onClick={onSelect}
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center justify-between gap-1">
          <span className="font-semibold text-xs truncate text-[#F5F7F6]">
            {conv.title}
          </span>
          <span className="text-[9px] text-[#94A3B8] shrink-0">{formattedTime}</span>
        </div>
        {lastMsg && (
          <p className="text-[11px] text-[#94A3B8] truncate leading-tight">
            {lastMsg}
          </p>
        )}
      </div>

      {/* Options Menu Trigger */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleMenu();
          }}
          className="p-1 rounded-lg text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A2624] transition-colors"
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>

        {/* Options Dropdown Menu */}
        {isMenuOpen && (
          <div
            className="absolute right-0 top-6 w-32 bg-[#0D1211] border border-[#1C2624] rounded-xl shadow-xl z-30 p-1 space-y-0.5 animate-in fade-in duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onRename}
              className="w-full px-2.5 py-1.5 rounded-lg text-left text-xs text-[#F5F7F6] hover:bg-[#1A2624] flex items-center gap-1.5 transition-colors"
            >
              <Edit2 className="w-3 h-3 text-[#14B8A6]" />
              <span>Rename</span>
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="w-full px-2.5 py-1.5 rounded-lg text-left text-xs text-[#D9363E] hover:bg-[#D9363E]/10 flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              <span>Delete</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
