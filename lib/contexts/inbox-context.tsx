'use client';
import { safeSetItem, safeGetItem } from '@/lib/safe-local-storage';
import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import type { Json, Database } from '@/lib/types/database.types';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

export type InboxItemType =
  | 'renewal'
  | 'price_increase'
  | 'trial_ending'
  | 'failed_payment'
  | 'duplicate'
  | 'plan_update'
  | 'recommendation';

export type ActionType = 'view' | 'review' | 'manage' | 'update_payment';

export interface InboxItem {
  id: string;
  type: InboxItemType;
  title: string;
  description: string;
  date: string;
  isRead: boolean;
  isFavourited?: boolean;
  isUrgent?: boolean;
  actionType?: ActionType;
  actionLabel?: string;
  subscriptionName?: string;
  subscriptionPrice?: number;
  currency?: string;
  providerUrl?: string;
  metadata?: Record<string, unknown>;
}

type InboxItemDbRow = Database['public']['Tables']['inbox_items']['Row'];
type InboxItemDbUpdate = Database['public']['Tables']['inbox_items']['Update'];

interface InboxContextType {
  items: InboxItem[];
  archivedItems: InboxItem[];
  allItems: InboxItem[];
  favouritedItems: InboxItem[];
  favouritedIds: string[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAsUnread: (id: string) => void;
  markAllAsRead: () => void;
  deleteItem: (id: string) => void;
  archiveItem: (id: string) => void;
  unarchiveItem: (id: string) => void;
  toggleFavourite: (id: string) => void;
  addToFavourites: (id: string) => void;
  removeFromFavourites: (id: string) => void;
  getItemById: (id: string) => InboxItem | undefined;
  addInboxItem: (item: Omit<InboxItem, 'id' | 'date' | 'isRead'>) => void;
}

export const INITIAL_INBOX_ITEMS: InboxItem[] = [];

const ITEMS_STORAGE_KEY = 'subhalt_inbox_items_v10';
const OVERRIDES_STORAGE_KEY = 'subhalt_inbox_user_overrides_v10';

function generateInboxId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `inbox-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

function readItemsFromStorage(): InboxItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = safeGetItem(ITEMS_STORAGE_KEY);
    if (stored) {
      const parsed: InboxItem[] = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    logger.warn('[inbox-context] readItemsFromStorage parse error', { message: err instanceof Error ? err.message : String(err) });
  }
  return [];
}

function readOverridesFromStorage(): { archivedIds: string[]; favouritedIds: string[] } {
  if (typeof window === 'undefined') return { archivedIds: [], favouritedIds: [] };
  try {
    const storedMeta = safeGetItem(OVERRIDES_STORAGE_KEY);
    if (storedMeta) {
      const parsedMeta = JSON.parse(storedMeta);
      if (parsedMeta && typeof parsedMeta === 'object') {
        return {
          archivedIds: Array.isArray(parsedMeta.archivedIds) ? parsedMeta.archivedIds : [],
          favouritedIds: Array.isArray(parsedMeta.favouritedIds) ? parsedMeta.favouritedIds : [],
        };
      }
    }
  } catch (err) {
    logger.warn('[inbox-context] readOverridesFromStorage parse error', { message: err instanceof Error ? err.message : String(err) });
  }
  return { archivedIds: [], favouritedIds: [] };
}

function dbRowToItem(row: InboxItemDbRow): InboxItem {
  return {
    id: row.id,
    type: row.type as InboxItemType,
    title: row.title,
    description: row.description ?? '',
    date: row.date,
    isRead: row.is_read,
    isFavourited: row.is_favourited,
    isUrgent: row.is_urgent,
    actionType: (row.action_type as ActionType | null) ?? undefined,
    actionLabel: row.action_label ?? undefined,
    subscriptionName: row.subscription_name ?? undefined,
    subscriptionPrice: row.subscription_price ?? undefined,
    currency: row.currency ?? undefined,
    providerUrl: row.provider_url ?? undefined,
    metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
  };
}

const InboxContext = createContext<InboxContextType | undefined>(undefined);

export function InboxProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);

  const [rawItems, setRawItems] = useState<InboxItem[]>(readItemsFromStorage);

  const initialOverrides = useMemo(() => readOverridesFromStorage(), []);
  const [archivedIds, setArchivedIds] = useState<string[]>(initialOverrides.archivedIds);
  const [favouritedIds, setFavouritedIds] = useState<string[]>(initialOverrides.favouritedIds);

  const persistCache = useCallback((newItems: InboxItem[], newArchived?: string[], newFavourited?: string[]) => {
    const activeArchived = newArchived ?? archivedIds;
    const activeFavourited = newFavourited ?? favouritedIds;

    if (typeof window !== 'undefined') {
      try {
        safeSetItem(ITEMS_STORAGE_KEY, JSON.stringify(newItems));
        safeSetItem(
          OVERRIDES_STORAGE_KEY,
          JSON.stringify({ archivedIds: activeArchived, favouritedIds: activeFavourited })
        );
        window.dispatchEvent(new Event('subhalt_inbox_updated'));
      } catch (err) {
        logger.warn('[inbox-context] persistCache storage error', { message: err instanceof Error ? err.message : String(err) });
      }
    }
  }, [archivedIds, favouritedIds]);

  const refreshFromStorage = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const parsedItems = readItemsFromStorage();
      const overrides = readOverridesFromStorage();
      if (parsedItems.length > 0) setRawItems(parsedItems);
      setArchivedIds(overrides.archivedIds);
      setFavouritedIds(overrides.favouritedIds);
    } catch (err) {
      logger.warn('[inbox-context] refreshFromStorage error', { message: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  const updateDbItem = useCallback(
    async (id: string, patch: InboxItemDbUpdate) => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        await supabase.from('inbox_items').update(patch).eq('id', id).eq('user_id', user.id);
      } catch (err) {
        logger.warn('[inbox-context] updateDbItem offline, cache-only', { message: err instanceof Error ? err.message : String(err) });
      }
    },
    [supabase]
  );

  const deleteDbItem = useCallback(
    async (id: string) => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        await supabase.from('inbox_items').delete().eq('id', id).eq('user_id', user.id);
      } catch (err) {
        logger.warn('[inbox-context] deleteDbItem offline, cache-only', { message: err instanceof Error ? err.message : String(err) });
      }
    },
    [supabase]
  );

  // Load inbox items from Supabase on mount (Supabase is the source of truth;
  // localStorage is a read cache / offline fallback, merged and mirrored here).
  const loadInboxFromServer = useCallback(async () => {
    if (typeof window === 'undefined') return;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('inbox_items')
        .select('*')
        .order('date', { ascending: false })
        .limit(300);

      if (error) {
        logger.warn('[inbox-context] loadInboxFromServer DB error, using cache', { message: error.message });
        return;
      }

      const rows = data ?? [];
      const dbItems = rows.map(dbRowToItem);
      const dbIds = new Set(dbItems.map((i) => i.id));

      const localItems = readItemsFromStorage();
      const localOverrides = readOverridesFromStorage();

      const mergedItems = [...dbItems, ...localItems.filter((i) => !dbIds.has(i.id))];
      const mergedArchived = [
        ...rows.filter((r) => r.archived_at != null).map((r) => r.id),
        ...localOverrides.archivedIds.filter((id) => !dbIds.has(id)),
      ];
      const mergedFavourited = [
        ...rows.filter((r) => r.is_favourited).map((r) => r.id),
        ...localOverrides.favouritedIds.filter((id) => !dbIds.has(id)),
      ];

      setRawItems(mergedItems);
      setArchivedIds(mergedArchived);
      setFavouritedIds(mergedFavourited);

      try {
        safeSetItem(ITEMS_STORAGE_KEY, JSON.stringify(mergedItems));
        safeSetItem(
          OVERRIDES_STORAGE_KEY,
          JSON.stringify({ archivedIds: mergedArchived, favouritedIds: mergedFavourited })
        );
        window.dispatchEvent(new Event('subhalt_inbox_updated'));
      } catch (err) {
        logger.warn('[inbox-context] loadInboxFromServer cache mirror error', { message: err instanceof Error ? err.message : String(err) });
      }
    } catch (err) {
      logger.warn('[inbox-context] loadInboxFromServer failed, keeping localStorage cache', { message: err instanceof Error ? err.message : String(err) });
    }
  }, [supabase]);

  useEffect(() => {
    void Promise.resolve().then(() => loadInboxFromServer());
  }, [loadInboxFromServer]);

  // Listen for storage updates from other tabs or the app itself.
  useEffect(() => {
    const handleUpdate = () => {
      refreshFromStorage();
    };

    window.addEventListener('storage', handleUpdate);
    window.addEventListener('subhalt_inbox_updated', handleUpdate);

    return () => {
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('subhalt_inbox_updated', handleUpdate);
    };
  }, [refreshFromStorage]);

  const addDbItem = useCallback(
    async (item: InboxItem, archivedAt: string | null) => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        await supabase.from('inbox_items').upsert(
          {
            id: item.id,
            user_id: user.id,
            type: item.type,
            title: item.title,
            description: item.description,
            date: item.date,
            is_read: item.isRead,
            is_favourited: !!item.isFavourited,
            is_urgent: !!item.isUrgent,
            action_type: item.actionType ?? null,
            action_label: item.actionLabel ?? null,
            subscription_name: item.subscriptionName ?? null,
            subscription_price: item.subscriptionPrice ?? null,
            currency: item.currency ?? null,
            provider_url: item.providerUrl ?? null,
            metadata: (item.metadata as Json) ?? null,
            archived_at: archivedAt,
          },
          { onConflict: 'id' }
        );
      } catch (err) {
        logger.warn('[inbox-context] addDbItem offline, cache-only', { message: err instanceof Error ? err.message : String(err) });
      }
    },
    [supabase]
  );

  const addInboxItem = useCallback(
    (item: Omit<InboxItem, 'id' | 'date' | 'isRead'>) => {
      const newItem: InboxItem = {
        ...item,
        id: generateInboxId(),
        date: new Date().toISOString(),
        isRead: false,
      };

      let currentItems: InboxItem[] = [];
      if (typeof window !== 'undefined') {
        const parsed = readItemsFromStorage();
        if (parsed.length) currentItems = parsed;
      }

      // Deduplicate: check if an identical inbox notice for this subscription already exists
      const existingIndex = currentItems.findIndex(
        (i) =>
          i.type === item.type &&
          i.subscriptionName?.toLowerCase().trim() === item.subscriptionName?.toLowerCase().trim() &&
          i.title.toLowerCase().trim() === item.title.toLowerCase().trim()
      );

      let updated: InboxItem[];
      if (existingIndex >= 0) {
        const existing = currentItems[existingIndex];
        const updatedItem: InboxItem = {
          ...existing,
          ...item,
          id: existing.id,
          date: new Date().toISOString(),
          isRead: false, // Re-open notice as unread if event re-fires
        };
        updated = [updatedItem, ...currentItems.filter((_, idx) => idx !== existingIndex)];
      } else {
        updated = [newItem, ...currentItems.filter((i) => i.id !== newItem.id)];
      }

      setRawItems(updated);
      persistCache(updated);

      const finalItem = updated[0];
      void addDbItem(finalItem, archivedIds.includes(finalItem.id) ? finalItem.date : null);
    },
    [persistCache, archivedIds, addDbItem]
  );

  // Listen for subscription creation events from subscription service & auto-create Inbox message/notification
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleSubCreated = (e: Event) => {
      const customEvt = e as CustomEvent<{ name?: string; price?: number; currency?: string }>;
      const sub = customEvt.detail;
      if (!sub || !sub.name) return;

      addInboxItem({
        type: 'plan_update',
        title: `${sub.name} Subscription Active`,
        description: `You subscribed to ${sub.name}. Your ${sub.name} plan is now active and will renew according to your selected billing cycle.`,
        actionType: 'view',
        actionLabel: 'View subscription',
        subscriptionName: sub.name,
        subscriptionPrice: sub.price,
        currency: sub.currency || 'USD',
      });
    };

    window.addEventListener('subhalt_subscription_created', handleSubCreated);
    return () => {
      window.removeEventListener('subhalt_subscription_created', handleSubCreated);
    };
  }, [addInboxItem]);

  const markAsRead = useCallback(
    (id: string) => {
      setRawItems((prev) => {
        const updated = prev.map((item) => (item.id === id ? { ...item, isRead: true } : item));
        persistCache(updated);
        void updateDbItem(id, { is_read: true });
        return updated;
      });
    },
    [persistCache, updateDbItem]
  );

  const markAsUnread = useCallback(
    (id: string) => {
      setRawItems((prev) => {
        const updated = prev.map((item) => (item.id === id ? { ...item, isRead: false } : item));
        persistCache(updated);
        void updateDbItem(id, { is_read: false });
        return updated;
      });
    },
    [persistCache, updateDbItem]
  );

  const markAllAsRead = useCallback(() => {
    setRawItems((prev) => {
      const updated = prev.map((item) => ({ ...item, isRead: true }));
      persistCache(updated);
      void (async () => {
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) return;
          await supabase.from('inbox_items').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
        } catch (err) {
          logger.warn('[inbox-context] markAllAsRead DB error, cache-only', { message: err instanceof Error ? err.message : String(err) });
        }
      })();
      return updated;
    });
  }, [persistCache, supabase]);

  const deleteItem = useCallback(
    (id: string) => {
      const nextArchived = archivedIds.filter((archId) => archId !== id);
      const nextFav = favouritedIds.filter((favId) => favId !== id);
      setArchivedIds(nextArchived);
      setFavouritedIds(nextFav);

      setRawItems((prev) => {
        const updated = prev.filter((item) => item.id !== id);
        persistCache(updated, nextArchived, nextFav);
        void deleteDbItem(id);
        return updated;
      });
    },
    [archivedIds, favouritedIds, persistCache, deleteDbItem]
  );

  const archiveItem = useCallback(
    (id: string) => {
      const timestamp = new Date().toISOString();
      setArchivedIds((prev) => {
        if (prev.includes(id)) return prev;
        const next = [...prev, id];
        persistCache(rawItems, next, favouritedIds);
        void updateDbItem(id, { archived_at: timestamp });
        return next;
      });
    },
    [rawItems, favouritedIds, persistCache, updateDbItem]
  );

  const unarchiveItem = useCallback(
    (id: string) => {
      setArchivedIds((prev) => {
        const next = prev.filter((item) => item !== id);
        persistCache(rawItems, next, favouritedIds);
        void updateDbItem(id, { archived_at: null });
        return next;
      });
    },
    [rawItems, favouritedIds, persistCache, updateDbItem]
  );

  const toggleFavourite = useCallback(
    (id: string) => {
      const adding = !favouritedIds.includes(id);
      void updateDbItem(id, { is_favourited: adding });
      setFavouritedIds((prev) => {
        const next = adding ? [...prev, id] : prev.filter((item) => item !== id);
        persistCache(rawItems, archivedIds, next);
        return next;
      });
    },
    [favouritedIds, rawItems, archivedIds, persistCache, updateDbItem]
  );

  const addToFavourites = useCallback(
    (id: string) => {
      void updateDbItem(id, { is_favourited: true });
      setFavouritedIds((prev) => {
        if (prev.includes(id)) return prev;
        const next = [...prev, id];
        persistCache(rawItems, archivedIds, next);
        return next;
      });
    },
    [rawItems, archivedIds, persistCache, updateDbItem]
  );

  const removeFromFavourites = useCallback(
    (id: string) => {
      void updateDbItem(id, { is_favourited: false });
      setFavouritedIds((prev) => {
        const next = prev.filter((item) => item !== id);
        persistCache(rawItems, archivedIds, next);
        return next;
      });
    },
    [rawItems, archivedIds, persistCache, updateDbItem]
  );

  const archivedSet = useMemo(() => new Set(archivedIds), [archivedIds]);
  const favouritedSet = useMemo(() => new Set(favouritedIds), [favouritedIds]);

  const enhancedItems = useMemo(
    () =>
      rawItems.map((item) => ({
        ...item,
        isFavourited: favouritedSet.has(item.id),
      })),
    [rawItems, favouritedSet]
  );

  const items = useMemo(
    () => enhancedItems.filter((item) => !archivedSet.has(item.id)),
    [enhancedItems, archivedSet]
  );

  const archivedItems = useMemo(
    () => enhancedItems.filter((item) => archivedSet.has(item.id)),
    [enhancedItems, archivedSet]
  );

  const favouritedItems = useMemo(
    () => enhancedItems.filter((item) => favouritedSet.has(item.id)),
    [enhancedItems, favouritedSet]
  );

  const allItems = useMemo(() => enhancedItems, [enhancedItems]);

  const getItemById = useCallback(
    (id: string) => allItems.find((item) => item.id === id),
    [allItems]
  );

  const unreadCount = useMemo(() => items.filter((item) => !item.isRead).length, [items]);

  return (
    <InboxContext.Provider
      value={{
        items,
        archivedItems,
        allItems,
        favouritedItems,
        favouritedIds,
        unreadCount,
        markAsRead,
        markAsUnread,
        markAllAsRead,
        deleteItem,
        archiveItem,
        unarchiveItem,
        toggleFavourite,
        addToFavourites,
        removeFromFavourites,
        getItemById,
        addInboxItem,
      }}
    >
      {children}
    </InboxContext.Provider>
  );
}

export function useInbox() {
  const context = useContext(InboxContext);
  if (!context) {
    throw new Error('useInbox must be used within an InboxProvider');
  }
  return context;
}