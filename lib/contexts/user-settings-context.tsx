'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchExchangeRates, DEFAULT_EXCHANGE_RATES } from '@/lib/services/currency-service';

export const BUILT_IN_CATEGORIES = [
  'Streaming',
  'Software',
  'Utilities',
  'Fitness',
  'Finance',
  'Education',
  'Gaming',
  'Other',
] as const;

export interface CategoryMeta {
  icon: string;
  color: string;
}

export const DEFAULT_CATEGORY_META: Record<string, CategoryMeta> = {
  Streaming: { icon: 'Film', color: '#14B8A6' },
  Software: { icon: 'Laptop', color: '#3B82F6' },
  Utilities: { icon: 'Zap', color: '#F59E0B' },
  Fitness: { icon: 'Dumbbell', color: '#14B8A6' },
  Finance: { icon: 'CreditCard', color: '#22C55E' },
  Education: { icon: 'BookOpen', color: '#8B5CF6' },
  Gaming: { icon: 'Gamepad2', color: '#EC4899' },
  Other: { icon: 'Folder', color: '#64748B' },
};

interface UserSettingsContextValue {
  defaultCurrency: string;
  timezone: string;
  fullName: string;
  email: string;
  lastNameChange: string | null;
  customCategories: string[];
  allCategories: string[];
  categoryMetadata: Record<string, CategoryMeta>;
  exchangeRates: Record<string, number>;
  loading: boolean;
  updateProfile: (data: { fullName?: string; timezone?: string }) => Promise<void>;
  reauthenticateAndChangeEmail: (password: string, newEmail: string) => Promise<void>;
  updateDefaultCurrency: (newCurrency: string) => Promise<void>;
  addCategory: (categoryName: string, meta?: CategoryMeta) => Promise<void>;
  updateCategory: (oldName: string, newName: string, meta?: CategoryMeta) => Promise<void>;
  deleteCategory: (categoryName: string) => Promise<void>;
  getCategoryMeta: (categoryName: string) => CategoryMeta;
  refreshSettings: () => Promise<void>;
}

const UserSettingsContext = createContext<UserSettingsContextValue | undefined>(undefined);

export function UserSettingsProvider({ children }: { children: React.ReactNode }) {
  const [defaultCurrency, setDefaultCurrencyState] = useState<string>('USD');
  const [timezone, setTimezoneState] = useState<string>(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  });
  const [fullName, setFullNameState] = useState<string>('');
  const [email, setEmailState] = useState<string>('');
  const [lastNameChange, setLastNameChangeState] = useState<string | null>(null);
  const [customCategories, setCustomCategoriesState] = useState<string[]>([]);
  const [categoryMetadata, setCategoryMetadata] = useState<Record<string, CategoryMeta>>({});
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>(DEFAULT_EXCHANGE_RATES);
  const [loading, setLoading] = useState(true);

  const supabase = useMemo(() => createClient(), []);

  // Load exchange rates on mount
  useEffect(() => {
    let mounted = true;
    fetchExchangeRates().then((rates) => {
      if (mounted) {
        setExchangeRates(rates);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const loadUserSettings = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Check local storage cache for fast rendering
      if (typeof window !== 'undefined') {
        const savedCurrency = localStorage.getItem('subsync_default_currency');
        if (savedCurrency) setDefaultCurrencyState(savedCurrency);

        const savedTz = localStorage.getItem('subsync_timezone');
        if (savedTz) setTimezoneState(savedTz);

        const savedCats = localStorage.getItem('subsync_custom_categories');
        if (savedCats) {
          try {
            setCustomCategoriesState(JSON.parse(savedCats));
          } catch {}
        }

        const savedMeta = localStorage.getItem('subsync_category_metadata');
        if (savedMeta) {
          try {
            setCategoryMetadata(JSON.parse(savedMeta));
          } catch {}
        }
      }

      // 2. Fetch authenticated Supabase user
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmailState(user.email || '');
        const meta = user.user_metadata || {};

        if (meta.full_name) {
          setFullNameState(meta.full_name);
        }
        if (meta.last_name_change) {
          setLastNameChangeState(meta.last_name_change);
        }
        if (meta.default_currency) {
          setDefaultCurrencyState(meta.default_currency);
          if (typeof window !== 'undefined') {
            localStorage.setItem('subsync_default_currency', meta.default_currency);
          }
        }
        if (meta.timezone) {
          setTimezoneState(meta.timezone);
          if (typeof window !== 'undefined') {
            localStorage.setItem('subsync_timezone', meta.timezone);
          }
        }
        if (Array.isArray(meta.custom_categories)) {
          setCustomCategoriesState(meta.custom_categories);
          if (typeof window !== 'undefined') {
            localStorage.setItem('subsync_custom_categories', JSON.stringify(meta.custom_categories));
          }
        }
        if (meta.category_metadata && typeof meta.category_metadata === 'object') {
          setCategoryMetadata(meta.category_metadata);
          if (typeof window !== 'undefined') {
            localStorage.setItem('subsync_category_metadata', JSON.stringify(meta.category_metadata));
          }
        }
      }
    } catch {
      // Ignore load errors safely
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadUserSettings();
  }, [loadUserSettings]);

  // Subscribe to auth state changes for real-time user updates (e.g. after email verification)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setEmailState(session.user.email || '');
        if (session.user.user_metadata?.full_name) {
          setFullNameState(session.user.user_metadata.full_name);
        }
        if (session.user.user_metadata?.last_name_change) {
          setLastNameChangeState(session.user.user_metadata.last_name_change);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const updateProfile = async ({ fullName: newName, timezone: newTz }: { fullName?: string; timezone?: string }) => {
    if (newName !== undefined) {
      // Enforce name update through server route to guarantee persistent 30-day rate limit
      const res = await fetch('/api/profile/update-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: newName }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile name.');
      }

      if (data.fullName) setFullNameState(data.fullName);
      if (data.lastNameChange) setLastNameChangeState(data.lastNameChange);
    }

    if (newTz !== undefined) {
      setTimezoneState(newTz);
      if (typeof window !== 'undefined') {
        localStorage.setItem('subsync_timezone', newTz);
      }
      const { error } = await supabase.auth.updateUser({ data: { timezone: newTz } });
      if (error) throw error;
    }
  };

  const reauthenticateAndChangeEmail = async (password: string, newEmail: string) => {
    if (!email) throw new Error('No user email found.');

    // 1. Re-authenticate with current password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      throw new Error('Incorrect password. Please enter your current account password to authorize changing your email.');
    }

    // 2. Request email update with verification dispatch
    const { error: updateError } = await supabase.auth.updateUser({
      email: newEmail.trim(),
    });

    if (updateError) {
      throw new Error(updateError.message);
    }
  };

  const updateDefaultCurrency = async (newCurrency: string) => {
    setDefaultCurrencyState(newCurrency);
    if (typeof window !== 'undefined') {
      localStorage.setItem('subsync_default_currency', newCurrency);
    }
    const { error } = await supabase.auth.updateUser({
      data: { default_currency: newCurrency },
    });
    if (error) throw error;
  };

  const addCategory = async (categoryName: string, meta?: CategoryMeta) => {
    const trimmed = categoryName.trim();
    if (!trimmed) return;
    if (BUILT_IN_CATEGORIES.includes(trimmed as any) || customCategories.includes(trimmed)) {
      return;
    }
    const updatedCats = [...customCategories, trimmed];
    const newMeta = meta ? { ...categoryMetadata, [trimmed]: meta } : categoryMetadata;

    setCustomCategoriesState(updatedCats);
    if (meta) setCategoryMetadata(newMeta);

    if (typeof window !== 'undefined') {
      localStorage.setItem('subsync_custom_categories', JSON.stringify(updatedCats));
      if (meta) localStorage.setItem('subsync_category_metadata', JSON.stringify(newMeta));
    }

    await supabase.auth.updateUser({
      data: {
        custom_categories: updatedCats,
        category_metadata: newMeta,
      },
    });
  };

  const updateCategory = async (oldName: string, newName: string, meta?: CategoryMeta) => {
    const trimmedNew = newName.trim();
    if (!trimmedNew) return;

    const isBuiltIn = BUILT_IN_CATEGORIES.includes(oldName as any);
    let updatedCats = customCategories;
    if (!isBuiltIn && oldName !== trimmedNew) {
      updatedCats = customCategories.map((cat) => (cat === oldName ? trimmedNew : cat));
      setCustomCategoriesState(updatedCats);
    }

    const newMeta = { ...categoryMetadata };
    if (oldName !== trimmedNew && newMeta[oldName]) {
      delete newMeta[oldName];
    }
    if (meta) {
      newMeta[trimmedNew] = meta;
    }
    setCategoryMetadata(newMeta);

    if (typeof window !== 'undefined') {
      localStorage.setItem('subsync_custom_categories', JSON.stringify(updatedCats));
      localStorage.setItem('subsync_category_metadata', JSON.stringify(newMeta));
    }

    await supabase.auth.updateUser({
      data: {
        custom_categories: updatedCats,
        category_metadata: newMeta,
      },
    });
  };

  const deleteCategory = async (categoryName: string) => {
    const updatedCats = customCategories.filter((cat) => cat !== categoryName);
    const newMeta = { ...categoryMetadata };
    delete newMeta[categoryName];

    setCustomCategoriesState(updatedCats);
    setCategoryMetadata(newMeta);

    if (typeof window !== 'undefined') {
      localStorage.setItem('subsync_custom_categories', JSON.stringify(updatedCats));
      localStorage.setItem('subsync_category_metadata', JSON.stringify(newMeta));
    }

    await supabase.auth.updateUser({
      data: {
        custom_categories: updatedCats,
        category_metadata: newMeta,
      },
    });
  };

  const getCategoryMeta = useCallback(
    (categoryName: string): CategoryMeta => {
      if (categoryMetadata[categoryName]) {
        return categoryMetadata[categoryName];
      }
      if (DEFAULT_CATEGORY_META[categoryName]) {
        return DEFAULT_CATEGORY_META[categoryName];
      }
      return { icon: 'Tag', color: '#14B8A6' };
    },
    [categoryMetadata]
  );

  const allCategories = useMemo(() => {
    const combined = [...BUILT_IN_CATEGORIES, ...customCategories];
    return Array.from(new Set(combined));
  }, [customCategories]);

  return (
    <UserSettingsContext.Provider
      value={{
        defaultCurrency,
        timezone,
        fullName,
        email,
        lastNameChange,
        customCategories,
        allCategories,
        categoryMetadata,
        exchangeRates,
        loading,
        updateProfile,
        reauthenticateAndChangeEmail,
        updateDefaultCurrency,
        addCategory,
        updateCategory,
        deleteCategory,
        getCategoryMeta,
        refreshSettings: loadUserSettings,
      }}
    >
      {children}
    </UserSettingsContext.Provider>
  );
}

export function useUserSettings() {
  const context = useContext(UserSettingsContext);
  if (!context) {
    throw new Error('useUserSettings must be used within a UserSettingsProvider');
  }
  return context;
}
