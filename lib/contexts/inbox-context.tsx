'use client';

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
  metadata?: Record<string, any>;
}

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

const ITEMS_STORAGE_KEY = 'subsync_inbox_items_v10';
const OVERRIDES_STORAGE_KEY = 'subsync_inbox_user_overrides_v10';

interface UserState {
  items: InboxItem[];
  archivedIds: string[];
  favouritedIds: string[];
}

const InboxContext = createContext<InboxContextType | undefined>(undefined);

export function InboxProvider({ children }: { children: React.ReactNode }) {
  const [rawItems, setRawItems] = useState<InboxItem[]>([]);
  const [archivedIds, setArchivedIds] = useState<string[]>([]);
  const [favouritedIds, setFavouritedIds] = useState<string[]>([]);

  // Load persisted user inbox data on mount
  useEffect(() => {
    try {
      const storedItems = localStorage.getItem(ITEMS_STORAGE_KEY);
      const storedMeta = localStorage.getItem(OVERRIDES_STORAGE_KEY);

      if (storedItems) {
        const parsedItems: InboxItem[] = JSON.parse(storedItems);
        if (Array.isArray(parsedItems)) {
          setRawItems(parsedItems);
        }
      }

      if (storedMeta) {
        const parsedMeta = JSON.parse(storedMeta);
        if (parsedMeta && typeof parsedMeta === 'object') {
          if (Array.isArray(parsedMeta.archivedIds)) setArchivedIds(parsedMeta.archivedIds);
          if (Array.isArray(parsedMeta.favouritedIds)) setFavouritedIds(parsedMeta.favouritedIds);
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const saveState = useCallback((newItems: InboxItem[], newArchived?: string[], newFavourited?: string[]) => {
    setRawItems(newItems);
    const activeArchived = newArchived !== undefined ? newArchived : archivedIds;
    const activeFavourited = newFavourited !== undefined ? newFavourited : favouritedIds;

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(newItems));
        localStorage.setItem(
          OVERRIDES_STORAGE_KEY,
          JSON.stringify({ archivedIds: activeArchived, favouritedIds: activeFavourited })
        );
      } catch {
        // Ignore storage errors
      }
    }
  }, [archivedIds, favouritedIds]);

  const addInboxItem = useCallback((item: Omit<InboxItem, 'id' | 'date' | 'isRead'>) => {
    const newItem: InboxItem = {
      ...item,
      id: `inbox-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      date: new Date().toISOString(),
      isRead: false,
    };

    setRawItems((prev) => {
      const updated = [newItem, ...prev];
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(updated));
        } catch {}
      }
      return updated;
    });
  }, []);

  const markAsRead = useCallback(
    (id: string) => {
      setRawItems((prev) => {
        const updated = prev.map((item) => (item.id === id ? { ...item, isRead: true } : item));
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(updated));
          } catch {}
        }
        return updated;
      });
    },
    []
  );

  const markAsUnread = useCallback(
    (id: string) => {
      setRawItems((prev) => {
        const updated = prev.map((item) => (item.id === id ? { ...item, isRead: false } : item));
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(updated));
          } catch {}
        }
        return updated;
      });
    },
    []
  );

  const markAllAsRead = useCallback(() => {
    setRawItems((prev) => {
      const updated = prev.map((item) => ({ ...item, isRead: true }));
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(updated));
        } catch {}
      }
      return updated;
    });
  }, []);

  const deleteItem = useCallback(
    (id: string) => {
      const nextArchived = archivedIds.filter((archId) => archId !== id);
      const nextFav = favouritedIds.filter((favId) => favId !== id);
      setArchivedIds(nextArchived);
      setFavouritedIds(nextFav);

      setRawItems((prev) => {
        const updated = prev.filter((item) => item.id !== id);
        saveState(updated, nextArchived, nextFav);
        return updated;
      });
    },
    [archivedIds, favouritedIds, saveState]
  );

  const archiveItem = useCallback(
    (id: string) => {
      setArchivedIds((prev) => {
        if (prev.includes(id)) return prev;
        const next = [...prev, id];
        saveState(rawItems, next, favouritedIds);
        return next;
      });
    },
    [rawItems, favouritedIds, saveState]
  );

  const unarchiveItem = useCallback(
    (id: string) => {
      setArchivedIds((prev) => {
        const next = prev.filter((item) => item !== id);
        saveState(rawItems, next, favouritedIds);
        return next;
      });
    },
    [rawItems, favouritedIds, saveState]
  );

  const toggleFavourite = useCallback(
    (id: string) => {
      setFavouritedIds((prev) => {
        const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
        saveState(rawItems, archivedIds, next);
        return next;
      });
    },
    [rawItems, archivedIds, saveState]
  );

  const addToFavourites = useCallback(
    (id: string) => {
      setFavouritedIds((prev) => {
        if (prev.includes(id)) return prev;
        const next = [...prev, id];
        saveState(rawItems, archivedIds, next);
        return next;
      });
    },
    [rawItems, archivedIds, saveState]
  );

  const removeFromFavourites = useCallback(
    (id: string) => {
      setFavouritedIds((prev) => {
        const next = prev.filter((item) => item !== id);
        saveState(rawItems, archivedIds, next);
        return next;
      });
    },
    [rawItems, archivedIds, saveState]
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



