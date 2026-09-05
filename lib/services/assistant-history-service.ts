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

const STORAGE_KEY = 'subsync_assistant_conversations';

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

/**
 * Fetches all saved conversations sorted by updatedAt descending.
 */
export function getSavedConversations(): SavedConversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list: SavedConversation[] = JSON.parse(raw);
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch (err) {
    console.error('Error loading assistant conversations:', err);
    return [];
  }
}

/**
 * Groups saved conversations into Today, Yesterday, and Earlier.
 */
export function getGroupedConversations(): GroupedConversations {
  const list = getSavedConversations();
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

/**
 * Retrieves a single conversation by ID.
 */
export function getConversationById(id: string): SavedConversation | null {
  const list = getSavedConversations();
  return list.find((c) => c.id === id) || null;
}

/**
 * Saves or updates a conversation.
 */
export function saveConversation(conv: SavedConversation): SavedConversation[] {
  if (typeof window === 'undefined') return [];
  try {
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

    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return list;
  } catch (err) {
    console.error('Error saving assistant conversation:', err);
    return getSavedConversations();
  }
}

/**
 * Renames a conversation title.
 */
export function renameConversation(id: string, newTitle: string): SavedConversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const list = getSavedConversations();
    const target = list.find((c) => c.id === id);
    if (target) {
      target.title = newTitle.trim() || target.title;
      target.updatedAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }
    return getSavedConversations();
  } catch (err) {
    console.error('Error renaming conversation:', err);
    return getSavedConversations();
  }
}

/**
 * Deletes a single conversation by ID.
 */
export function deleteConversation(id: string): SavedConversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const list = getSavedConversations();
    const filtered = list.filter((c) => c.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return filtered;
  } catch (err) {
    console.error('Error deleting conversation:', err);
    return getSavedConversations();
  }
}

/**
 * Deletes all saved conversations.
 */
export function deleteAllConversations(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Error clearing assistant conversations:', err);
  }
}
