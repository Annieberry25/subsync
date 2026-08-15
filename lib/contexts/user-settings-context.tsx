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

export interface NotificationPreferences {
  inApp: boolean;
  email: boolean;
  sms: boolean;
  push: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  inApp: true,
  email: true,
  sms: false,
  push: true,
};

export interface BillingDetails {
  email: string;
  fullName: string;
  country: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateProvince?: string;
  postalCode?: string;
}

export interface PaymentMethodItem {
  id: string;
  brand: string;
  last4: string;
  expMonth: string;
  expYear: string;
  isDefault: boolean;
}

export interface TransactionItem {
  id: string;
  planName: string;
  date: string;
  status: 'Paid' | 'Pending' | 'Failed';
  amount: string;
}

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
  notificationPreferences: NotificationPreferences;
  planTier: 'free' | 'plus';
  isPlus: boolean;
  isPremium: boolean;
  loading: boolean;
  billingDetails: BillingDetails | null;
  paymentMethods: PaymentMethodItem[];
  billingTransactions: TransactionItem[];
  updateProfile: (data: { fullName?: string; timezone?: string }) => Promise<void>;
  reauthenticateAndChangeEmail: (password: string, newEmail: string) => Promise<void>;
  updateDefaultCurrency: (newCurrency: string) => Promise<void>;
  updateNotificationPreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
  updatePlanTier: (newTier: 'free' | 'plus') => Promise<void>;
  updateBillingDetails: (details: BillingDetails) => Promise<void>;
  addPaymentMethod: (card: Omit<PaymentMethodItem, 'id'>) => Promise<void>;
  deletePaymentMethod: (id: string) => Promise<void>;
  setDefaultPaymentMethod: (id: string) => Promise<void>;
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
  const [notificationPreferences, setNotificationPreferencesState] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [planTier, setPlanTierState] = useState<'free' | 'plus'>('free');
  const [billingDetails, setBillingDetailsState] = useState<BillingDetails | null>(null);
  const [paymentMethods, setPaymentMethodsState] = useState<PaymentMethodItem[]>([]);
  const [billingTransactions, setBillingTransactionsState] = useState<TransactionItem[]>([]);
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

        const savedNotifs = localStorage.getItem('subsync_notification_preferences');
        if (savedNotifs) {
          try {
            setNotificationPreferencesState(JSON.parse(savedNotifs));
          } catch {}
        }

        const savedPlan = localStorage.getItem('subsync_plan_tier');
        if (savedPlan === 'plus' || savedPlan === 'premium') {
          setPlanTierState('plus');
        } else if (savedPlan === 'free') {
          setPlanTierState('free');
        }

        const savedBilling = localStorage.getItem('subsync_billing_details');
        if (savedBilling) {
          try {
            setBillingDetailsState(JSON.parse(savedBilling));
          } catch {}
        }

        const savedPM = localStorage.getItem('subsync_payment_methods');
        if (savedPM) {
          try {
            setPaymentMethodsState(JSON.parse(savedPM));
          } catch {}
        }

        const savedTX = localStorage.getItem('subsync_billing_transactions');
        if (savedTX) {
          try {
            setBillingTransactionsState(JSON.parse(savedTX));
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
        if (meta.plan_tier === 'plus' || meta.plan_tier === 'premium') {
          setPlanTierState('plus');
          if (typeof window !== 'undefined') {
            localStorage.setItem('subsync_plan_tier', 'plus');
          }
        } else if (meta.plan_tier === 'free') {
          setPlanTierState('free');
          if (typeof window !== 'undefined') {
            localStorage.setItem('subsync_plan_tier', 'free');
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

  const updateNotificationPreferences = async (prefs: Partial<NotificationPreferences>) => {
    const updated = { ...notificationPreferences, ...prefs };
    setNotificationPreferencesState(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('subsync_notification_preferences', JSON.stringify(updated));
    }
    const { error } = await supabase.auth.updateUser({
      data: { notification_preferences: updated },
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

  const updateBillingDetails = async (details: BillingDetails) => {
    setBillingDetailsState(details);
    if (typeof window !== 'undefined') {
      localStorage.setItem('subsync_billing_details', JSON.stringify(details));
    }
  };

  const addPaymentMethod = async (card: Omit<PaymentMethodItem, 'id'>) => {
    const newCard: PaymentMethodItem = {
      ...card,
      id: `pm_${Date.now()}`,
    };
    let updated = [...paymentMethods];
    if (card.isDefault) {
      updated = updated.map((item) => ({ ...item, isDefault: false }));
    }
    updated.unshift(newCard);
    setPaymentMethodsState(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('subsync_payment_methods', JSON.stringify(updated));
    }
  };

  const deletePaymentMethod = async (id: string) => {
    const updated = paymentMethods.filter((item) => item.id !== id);
    if (updated.length > 0 && !updated.some((item) => item.isDefault)) {
      updated[0].isDefault = true;
    }
    setPaymentMethodsState(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('subsync_payment_methods', JSON.stringify(updated));
    }
  };

  const setDefaultPaymentMethod = async (id: string) => {
    const updated = paymentMethods.map((item) => ({
      ...item,
      isDefault: item.id === id,
    }));
    setPaymentMethodsState(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('subsync_payment_methods', JSON.stringify(updated));
    }
  };

  const updatePlanTier = async (newTier: 'free' | 'plus') => {
    setPlanTierState(newTier);
    if (typeof window !== 'undefined') {
      localStorage.setItem('subsync_plan_tier', newTier);
    }
    if (newTier === 'plus') {
      if (!billingDetails) {
        const defaultBilling: BillingDetails = {
          email: email || 'anitaonyema25@gmail.com',
          fullName: fullName || 'Anita Onyema',
          country: 'Nigeria',
          addressLine1: 'Umuchima, Ihiagwa, Owerri.',
          addressLine2: '',
          city: 'Owerri',
          stateProvince: 'Imo',
          postalCode: '460106',
        };
        setBillingDetailsState(defaultBilling);
        if (typeof window !== 'undefined') {
          localStorage.setItem('subsync_billing_details', JSON.stringify(defaultBilling));
        }
      }
      if (paymentMethods.length === 0) {
        const defaultPM: PaymentMethodItem[] = [
          { id: 'pm_1', brand: 'Mastercard', last4: '6730', expMonth: '12', expYear: '2028', isDefault: true },
        ];
        setPaymentMethodsState(defaultPM);
        if (typeof window !== 'undefined') {
          localStorage.setItem('subsync_payment_methods', JSON.stringify(defaultPM));
        }
      }
      if (billingTransactions.length === 0) {
        const defaultTX: TransactionItem[] = [
          { id: 'tx_1', planName: 'SubHalt', date: '7/28/2026', status: 'Paid', amount: '$4.99' },
        ];
        setBillingTransactionsState(defaultTX);
        if (typeof window !== 'undefined') {
          localStorage.setItem('subsync_billing_transactions', JSON.stringify(defaultTX));
        }
      }
    }
    try {
      await supabase.auth.updateUser({
        data: { plan_tier: newTier },
      });
    } catch {
      // Ignore auth update errors if offline/demo
    }
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
        notificationPreferences,
        planTier,
        isPlus: planTier === 'plus',
        isPremium: planTier === 'plus',
        loading,
        billingDetails,
        paymentMethods,
        billingTransactions,
        updateProfile,
        reauthenticateAndChangeEmail,
        updateDefaultCurrency,
        updateNotificationPreferences,
        updatePlanTier,
        updateBillingDetails,
        addPaymentMethod,
        deletePaymentMethod,
        setDefaultPaymentMethod,
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
