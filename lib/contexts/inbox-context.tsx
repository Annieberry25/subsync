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
}

export const INITIAL_INBOX_ITEMS: InboxItem[] = [
  {
    id: 'inbox-1',
    type: 'failed_payment',
    title: 'Payment failed for ChatGPT Plus',
    description: 'Your monthly charge of $20.00 failed on Visa ending in 4242. Update payment details to prevent subscription cancellation.',
    date: new Date(1770765900000).toISOString(),
    isRead: false,
    isUrgent: true,
    actionType: 'update_payment',
    actionLabel: 'Update payment',
    subscriptionName: 'ChatGPT Plus',
    subscriptionPrice: 20.0,
    currency: 'USD',
    providerUrl: 'https://chatgpt.com/#settings/Subscription',
  },
  {
    id: 'inbox-2',
    type: 'trial_ending',
    title: 'Adobe Creative Cloud trial ending soon',
    description: 'Your 14-day trial ends tomorrow. Your account will automatically transition to $54.99/mo.',
    date: new Date(1770757800000).toISOString(),
    isRead: false,
    actionType: 'manage',
    actionLabel: 'Manage',
    subscriptionName: 'Adobe Creative Cloud',
    subscriptionPrice: 54.99,
    currency: 'USD',
    providerUrl: 'https://account.adobe.com/plans',
  },
  {
    id: 'inbox-3',
    type: 'price_increase',
    title: 'Spotify Premium price increase notice',
    description: 'Spotify is adjusting plan prices from $9.99 to $11.99/mo starting on your next billing cycle.',
    date: new Date(1770725400000).toISOString(),
    isRead: false,
    actionType: 'review',
    actionLabel: 'Review',
    subscriptionName: 'Spotify',
    subscriptionPrice: 11.99,
    currency: 'USD',
    providerUrl: 'https://www.spotify.com/account/overview/',
  },
  {
    id: 'inbox-4',
    type: 'duplicate',
    title: 'Duplicate subscription detected',
    description: 'Active subscriptions detected for both Disney+ ($13.99/mo) and Hulu ($17.99/mo). Switching to a bundle could save $7/mo.',
    date: new Date(1770682200000).toISOString(),
    isRead: false,
    actionType: 'review',
    actionLabel: 'Review',
    subscriptionName: 'Disney+ / Hulu',
    providerUrl: 'https://www.disneyplus.com/account',
  },
  {
    id: 'inbox-5',
    type: 'recommendation',
    title: 'Switch Notion to annual billing',
    description: 'Switching Notion Plus from monthly ($10/mo) to annual ($96/yr) saves 20% ($24/year).',
    date: new Date(1770639000000).toISOString(),
    isRead: false,
    actionType: 'manage',
    actionLabel: 'Manage',
    subscriptionName: 'Notion',
    providerUrl: 'https://www.notion.so/settings',
  },
  {
    id: 'inbox-6',
    type: 'renewal',
    title: 'Netflix subscription renewed successfully',
    description: 'Automatic monthly charge of $15.99 was processed on August 10, 2026.',
    date: new Date(1770595800000).toISOString(),
    isRead: true,
    subscriptionName: 'Netflix',
  },
  {
    id: 'inbox-7',
    type: 'plan_update',
    title: 'GitHub Pro plan features updated',
    description: 'Your Pro tier now includes multi-repository context and advanced Copilot workspace features at no extra charge.',
    date: new Date(1770509400000).toISOString(),
    isRead: true,
    subscriptionName: 'GitHub Pro',
  },
];

const OVERRIDES_STORAGE_KEY = 'subsync_inbox_user_overrides_v9';

interface UserOverrides {
  readState: Record<string, boolean>;
  archivedIds: string[];
  favouritedIds: string[];
  deletedIds: string[];
}

const InboxContext = createContext<InboxContextType | undefined>(undefined);

export function InboxProvider({ children }: { children: React.ReactNode }) {
  const [rawItems, setRawItems] = useState<InboxItem[]>(INITIAL_INBOX_ITEMS);
  const [archivedIds, setArchivedIds] = useState<string[]>([]);
  const [favouritedIds, setFavouritedIds] = useState<string[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);

  // Helper to apply user overrides to base INITIAL_INBOX_ITEMS
  const applyOverrides = useCallback((overrides: UserOverrides) => {
    const deletedSet = new Set(overrides.deletedIds || []);

    const updatedRaw = INITIAL_INBOX_ITEMS.filter((item) => !deletedSet.has(item.id)).map((item) => {
      if (overrides.readState && item.id in overrides.readState) {
        return { ...item, isRead: overrides.readState[item.id] };
      }
      return item;
    });

    setRawItems(updatedRaw);
    setArchivedIds(overrides.archivedIds || []);
    setFavouritedIds(overrides.favouritedIds || []);
    setDeletedIds(overrides.deletedIds || []);
  }, []);

  // Post-mount useEffect to clean legacy stale test state and apply explicit user overrides stored in localStorage
  useEffect(() => {
    try {
      const legacyKeys = [
        'subsync_inbox_user_overrides_v8',
        'subsync_inbox_user_overrides_v7',
        'subsync_inbox_user_overrides_v6',
        'subsync_inbox_user_overrides_v5',
        'subsync_inbox_user_overrides_v4',
        'subsync_inbox_user_overrides_v3',
        'subsync_inbox_user_overrides_v2',
        'subsync_inbox_user_overrides',
        'subsync_inbox_items',
      ];
      legacyKeys.forEach((key) => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
        }
      });

      const stored = localStorage.getItem(OVERRIDES_STORAGE_KEY);
      if (stored) {
        const parsed: UserOverrides = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          applyOverrides(parsed);
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, [applyOverrides]);

  const saveOverrides = useCallback(
    (
      updater: (prev: InboxItem[]) => InboxItem[],
      newArchivedIds?: string[],
      newFavouritedIds?: string[]
    ) => {
      setRawItems((prevItems) => {
        const nextItems = updater(prevItems);
        const activeArchivedIds = newArchivedIds !== undefined ? newArchivedIds : archivedIds;
        const activeFavouritedIds = newFavouritedIds !== undefined ? newFavouritedIds : favouritedIds;

        if (typeof window !== 'undefined') {
          try {
            const currentItemIds = new Set(nextItems.map((i) => i.id));
            const activeDeletedIds = INITIAL_INBOX_ITEMS.map((i) => i.id).filter((id) => !currentItemIds.has(id));

            const readState: Record<string, boolean> = {};
            nextItems.forEach((item) => {
              const initial = INITIAL_INBOX_ITEMS.find((i) => i.id === item.id);
              if (initial && initial.isRead !== item.isRead) {
                readState[item.id] = item.isRead;
              }
            });

            const overrides: UserOverrides = {
              readState,
              archivedIds: activeArchivedIds,
              favouritedIds: activeFavouritedIds,
              deletedIds: activeDeletedIds,
            };
            localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
          } catch {
            // Ignore storage errors
          }
        }

        return nextItems;
      });
    },
    [archivedIds, favouritedIds]
  );

  const markAsRead = useCallback(
    (id: string) => {
      saveOverrides((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
    },
    [saveOverrides]
  );

  const markAsUnread = useCallback(
    (id: string) => {
      saveOverrides((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: false } : item)));
    },
    [saveOverrides]
  );

  const markAllAsRead = useCallback(() => {
    saveOverrides((prev) => prev.map((item) => ({ ...item, isRead: true })));
  }, [saveOverrides]);

  const deleteItem = useCallback(
    (id: string) => {
      setArchivedIds((prevArchived) => {
        const nextArchived = prevArchived.filter((archId) => archId !== id);
        setFavouritedIds((prevFav) => {
          const nextFav = prevFav.filter((favId) => favId !== id);
          saveOverrides((prev) => prev.filter((item) => item.id !== id), nextArchived, nextFav);
          return nextFav;
        });
        return nextArchived;
      });
    },
    [saveOverrides]
  );

  const archiveItem = useCallback(
    (id: string) => {
      setArchivedIds((prev) => {
        if (prev.includes(id)) return prev;
        const next = [...prev, id];
        saveOverrides((items) => items, next, favouritedIds);
        return next;
      });
    },
    [saveOverrides, favouritedIds]
  );

  const unarchiveItem = useCallback(
    (id: string) => {
      setArchivedIds((prev) => {
        const next = prev.filter((item) => item !== id);
        saveOverrides((items) => items, next, favouritedIds);
        return next;
      });
    },
    [saveOverrides, favouritedIds]
  );

  const toggleFavourite = useCallback(
    (id: string) => {
      setFavouritedIds((prev) => {
        const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
        saveOverrides((items) => items, archivedIds, next);
        return next;
      });
    },
    [saveOverrides, archivedIds]
  );

  const addToFavourites = useCallback(
    (id: string) => {
      setFavouritedIds((prev) => {
        if (prev.includes(id)) return prev;
        const next = [...prev, id];
        saveOverrides((items) => items, archivedIds, next);
        return next;
      });
    },
    [saveOverrides, archivedIds]
  );

  const removeFromFavourites = useCallback(
    (id: string) => {
      setFavouritedIds((prev) => {
        const next = prev.filter((item) => item !== id);
        saveOverrides((items) => items, archivedIds, next);
        return next;
      });
    },
    [saveOverrides, archivedIds]
  );

  const archivedSet = useMemo(() => new Set(archivedIds), [archivedIds]);
  const favouritedSet = useMemo(() => new Set(favouritedIds), [favouritedIds]);
  const deletedSet = useMemo(() => new Set(deletedIds), [deletedIds]);

  // Enhance raw items with isFavourited computed boolean property
  const enhancedItems = useMemo(
    () =>
      rawItems.map((item) => ({
        ...item,
        isFavourited: favouritedSet.has(item.id),
      })),
    [rawItems, favouritedSet]
  );

  const items = useMemo(
    () => enhancedItems.filter((item) => !archivedSet.has(item.id) && !deletedSet.has(item.id)),
    [enhancedItems, archivedSet, deletedSet]
  );

  const archivedItems = useMemo(
    () => enhancedItems.filter((item) => archivedSet.has(item.id) && !deletedSet.has(item.id)),
    [enhancedItems, archivedSet, deletedSet]
  );

  const favouritedItems = useMemo(
    () => enhancedItems.filter((item) => favouritedSet.has(item.id) && !deletedSet.has(item.id)),
    [enhancedItems, favouritedSet, deletedSet]
  );

  const allItems = useMemo(
    () => enhancedItems.filter((item) => !deletedSet.has(item.id)),
    [enhancedItems, deletedSet]
  );

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


