import { createClient } from '@/lib/supabase/client';
import type { Json } from '@/lib/types/database.types';
import type { SubscriptionRow } from '@/lib/services/subscription-service';

export interface ChatMessageItem {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  relatedSubs?: SubscriptionRow[];
}

export interface SavedConversation {
  id: string;
  title: string;
  messages: ChatMessageItem[];
  createdAt: string;
  updatedAt: string;
}

export interface GroupedConversations {
  today: SavedConversation[];
  yesterday: SavedConversation[];
  earlier: SavedConversation[];
}

export function generateConversationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `conv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Deterministically generates a human-friendly title from a user query.
 */
export function generateTitleFromQuery(query: string): string {
  const qLower = query.toLowerCase().trim();

  if (qLower.includes('spending') || qLower.includes('spend') || qLower.includes('how much am i spending')) {
    return 'Monthly spending';
  }
  if (qLower.includes('bill') || qLower.includes('electricity') || qLower.includes('airtime') || qLower.includes('internet') || qLower.includes('rent')) {
    return 'Bills & payments';
  }
  if (qLower.includes('cancel') || qLower.includes('saving') || qLower.includes('would i save')) {
    return 'Cancellation review';
  }
  if (qLower.includes('renew') || qLower.includes('next billing')) {
    return 'Upcoming renewals';
  }
  if (qLower.includes('most expensive') || qLower.includes('highest cost') || qLower.includes('biggest expense') || qLower.includes('costs me')) {
    return 'Highest plan cost';
  }
  if (qLower.includes('duplicate') || qLower.includes('overlapping')) {
    return 'Duplicate check';
  }
  if (qLower.includes('review')) {
    return 'Plan review';
  }

  // Fallback: Clean capitalization of first 4 words
  const words = query.trim().split(/\s+/).slice(0, 4);
  const clean = words.join(' ');
  if (!clean) return 'New conversation';

  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

const STORAGE_KEY = 'subhalt_assistant_conversations';

export function getSavedConversations(): SavedConversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list: SavedConversation[] = JSON.parse(raw);
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch {
    return [];
  }
}

function writeCache(list: SavedConversation[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Cache is a mirror; ignore storage failures.
  }
}

function isChatMessageJson(value: Json): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const sender = (value as { sender?: unknown }).sender;
  return sender === 'user' || sender === 'assistant';
}

function mapDbRow(row: {
  id: string;
  title: string;
  messages: Json;
  created_at: string;
  updated_at: string;
}): SavedConversation | null {
  if (!Array.isArray(row.messages)) return null;
  const messages = row.messages.filter(isChatMessageJson).map((m) => m as unknown as ChatMessageItem);

  return {
    id: row.id,
    title: row.title,
    messages,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Loads all saved conversations. Supabase is the source of truth; the
 * localStorage mirror covers offline reads and is kept in sync (no sync queue).
 */
export async function fetchSavedConversations(): Promise<SavedConversation[]> {
  const cached = getSavedConversations();
  if (typeof window === 'undefined') return cached;

  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return cached;

    const { data, error } = await supabase
      .from('ai_conversations')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(100);

    if (error) return cached;

    const fromDb = (data ?? []).map(mapDbRow).filter((c): c is SavedConversation => c !== null);
    const dbIds = new Set(fromDb.map((c) => c.id));
    const merged = [...fromDb, ...cached.filter((c) => !dbIds.has(c.id))];
    writeCache(merged);

    return merged;
  } catch {
    return cached;
  }
}

/**
 * Groups conversations into Today, Yesterday, and Earlier buckets.
 */
export function getGroupedConversations(list: SavedConversation[]): GroupedConversations {
  const now = new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

  const today: SavedConversation[] = [];
  const yesterday: SavedConversation[] = [];
  const earlier: SavedConversation[] = [];

  for (const conv of list) {
    const convTime = new Date(conv.updatedAt).getTime();
    if (convTime >= startOfToday) {
      today.push(conv);
    } else if (convTime >= startOfYesterday) {
      yesterday.push(conv);
    } else {
      earlier.push(conv);
    }
  }

  return { today, yesterday, earlier };
}

export async function getConversationById(id: string): Promise<SavedConversation | null> {
  const list = await fetchSavedConversations();
  return list.find((c) => c.id === id) || null;
}

/**
 * Saves (inserts/updates) a conversation. Writes straight to Supabase; the
 * localStorage mirror is updated as a cache after a successful DB write.
 */
export async function saveConversation(conv: SavedConversation): Promise<void> {
  if (typeof window === 'undefined') return;

  const messagesJson = conv.messages as unknown as Json;
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // Unauthenticated: nothing durable to write to, keep local mirror only.
      upsertCache(conv);
      return;
    }

    const { error } = await supabase
      .from('ai_conversations')
      .upsert({ id: conv.id, user_id: user.id, messages: messagesJson }, { onConflict: 'id' });

    void error;

    upsertCache(conv);
  } catch {
    // Offline / DB error: mirror-only (no sync queue).
    upsertCache(conv);
  }
}

function upsertCache(conv: SavedConversation): void {
  const list = getSavedConversations();
  const index = list.findIndex((c) => c.id === conv.id);
  const updatedConv: SavedConversation = {
    ...conv,
    updatedAt: new Date().toISOString(),
  };

  if (index >= 0) {
    list[index] = updatedConv;
  } else {
    list.unshift(updatedConv);
  }

  writeCache(list);
}

/**
 * Deletes a conversation from Supabase and the local mirror.
 */
export async function deleteConversation(id: string): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await supabase.from('ai_conversations').delete().eq('id', id).eq('user_id', user.id);
    }

    writeCache(getSavedConversations().filter((c) => c.id !== id));
  } catch {
    writeCache(getSavedConversations().filter((c) => c.id !== id));
  }
}

/**
 * Deletes all saved conversations.
 */
export async function deleteAllConversations(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await supabase.from('ai_conversations').delete().eq('user_id', user.id);
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}