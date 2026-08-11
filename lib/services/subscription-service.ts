import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/types/database.types';

export type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row'];
export type SubscriptionInsert = Database['public']['Tables']['subscriptions']['Insert'];
export type SubscriptionUpdate = Database['public']['Tables']['subscriptions']['Update'];

export interface AccountLink {
  id: string;
  label?: string;
  url: string;
}

const KNOWN_PROVIDER_WEBSITES: Record<string, string> = {
  netflix: 'https://www.netflix.com',
  spotify: 'https://www.spotify.com',
  amazon: 'https://www.amazon.com',
  'amazon prime': 'https://www.amazon.com',
  'prime video': 'https://www.primevideo.com',
  prime: 'https://www.amazon.com',
  github: 'https://github.com',
  'github pro': 'https://github.com',
  chatgpt: 'https://chatgpt.com',
  openai: 'https://openai.com',
  youtube: 'https://www.youtube.com',
  'youtube premium': 'https://www.youtube.com',
  apple: 'https://www.apple.com',
  icloud: 'https://www.apple.com',
  'apple music': 'https://music.apple.com',
  'apple tv': 'https://tv.apple.com',
  disney: 'https://www.disneyplus.com',
  'disney+': 'https://www.disneyplus.com',
  hulu: 'https://www.hulu.com',
  hbo: 'https://www.max.com',
  max: 'https://www.max.com',
  adobe: 'https://www.adobe.com',
  'creative cloud': 'https://www.adobe.com',
  photoshop: 'https://www.adobe.com',
  dropbox: 'https://www.dropbox.com',
  google: 'https://www.google.com',
  'google one': 'https://one.google.com',
  'google drive': 'https://drive.google.com',
  slack: 'https://slack.com',
  notion: 'https://www.notion.so',
  microsoft: 'https://www.microsoft.com',
  'office 365': 'https://www.microsoft.com',
  m365: 'https://www.microsoft.com',
  linkedin: 'https://www.linkedin.com',
  twitter: 'https://x.com',
  x: 'https://x.com',
  vercel: 'https://vercel.com',
  stripe: 'https://stripe.com',
  linear: 'https://linear.app',
  zoom: 'https://zoom.us',
  canva: 'https://www.canva.com',
  duolingo: 'https://www.duolingo.com',
  grammarly: 'https://www.grammarly.com',
  coursera: 'https://www.coursera.org',
  udemy: 'https://www.udemy.com',
  playstation: 'https://www.playstation.com',
  'ps plus': 'https://www.playstation.com',
  xbox: 'https://www.xbox.com',
  'xbox game pass': 'https://www.xbox.com',
  nintendo: 'https://www.nintendo.com',
  steam: 'https://store.steampowered.com',
  nordvpn: 'https://nordvpn.com',
  expressvpn: 'https://expressvpn.com',
  '1password': 'https://1password.com',
  bitwarden: 'https://bitwarden.com',
  figma: 'https://www.figma.com',
  loom: 'https://www.loom.com',
  miro: 'https://miro.com',
  trello: 'https://trello.com',
  asana: 'https://asana.com',
};

const KNOWN_PROVIDER_MANAGEMENT_URLS: Record<string, string> = {
  netflix: 'https://www.netflix.com/youraccount',
  spotify: 'https://www.spotify.com/account/overview/',
  amazon: 'https://www.amazon.com/mc/manage',
  'amazon prime': 'https://www.amazon.com/mc/manage',
  'prime video': 'https://www.amazon.com/mc/manage',
  prime: 'https://www.amazon.com/mc/manage',
  github: 'https://github.com/settings/billing',
  'github pro': 'https://github.com/settings/billing',
  chatgpt: 'https://chatgpt.com/#settings/Subscription',
  openai: 'https://chatgpt.com/#settings/Subscription',
  youtube: 'https://www.youtube.com/paid_memberships',
  'youtube premium': 'https://www.youtube.com/paid_memberships',
  apple: 'https://support.apple.com/HT202039',
  icloud: 'https://support.apple.com/HT202039',
  'apple music': 'https://support.apple.com/HT202039',
  'apple tv': 'https://support.apple.com/HT202039',
  disney: 'https://www.disneyplus.com/account',
  'disney+': 'https://www.disneyplus.com/account',
  hulu: 'https://hulu.com/account',
  hbo: 'https://auth.max.com/account',
  max: 'https://auth.max.com/account',
  adobe: 'https://account.adobe.com/plans',
  'creative cloud': 'https://account.adobe.com/plans',
  photoshop: 'https://account.adobe.com/plans',
  dropbox: 'https://www.dropbox.com/account/plan',
  google: 'https://one.google.com/settings',
  'google one': 'https://one.google.com/settings',
  'google drive': 'https://one.google.com/settings',
  slack: 'https://slack.com/account/settings',
  notion: 'https://www.notion.so/settings',
  microsoft: 'https://account.microsoft.com/services',
  'office 365': 'https://account.microsoft.com/services',
  m365: 'https://account.microsoft.com/services',
  linkedin: 'https://www.linkedin.com/mypreferences/d/subscriptions',
  twitter: 'https://x.com/settings/premium',
  x: 'https://x.com/settings/premium',
  vercel: 'https://vercel.com/dashboard/billing',
  stripe: 'https://dashboard.stripe.com/settings/billing',
  linear: 'https://linear.app/settings/billing',
  zoom: 'https://zoom.us/billing',
  canva: 'https://www.canva.com/settings/billing-and-teams',
  duolingo: 'https://www.duolingo.com/settings/super',
  grammarly: 'https://account.grammarly.com/subscription',
  coursera: 'https://www.coursera.org/account-settings/my-purchases',
  udemy: 'https://www.udemy.com/user/edit-subscription/',
  playstation: 'https://store.playstation.com/subscriptions',
  'ps plus': 'https://store.playstation.com/subscriptions',
  xbox: 'https://account.microsoft.com/services',
  'xbox game pass': 'https://account.microsoft.com/services',
  nintendo: 'https://ec.nintendo.com/membership',
  steam: 'https://store.steampowered.com/account/store_transactions/',
  nordvpn: 'https://my.nordaccount.com/dashboard/nordvpn/',
  expressvpn: 'https://www.expressvpn.com/subscriptions',
  '1password': 'https://my.1password.com/profile/billing',
  bitwarden: 'https://vault.bitwarden.com/#/settings/subscription',
  figma: 'https://www.figma.com/settings',
  loom: 'https://www.loom.com/settings/plan',
  miro: 'https://miro.com/app/dashboard/',
  trello: 'https://trello.com/billing',
  asana: 'https://app.asana.com/-/admin_console',
};

const KNOWN_PROVIDER_ACCOUNT_URLS: Record<string, string> = {
  netflix: 'https://www.netflix.com/youraccount',
  spotify: 'https://www.spotify.com/account/overview/',
  amazon: 'https://www.amazon.com/youraccount',
  'amazon prime': 'https://www.amazon.com/youraccount',
  'prime video': 'https://www.amazon.com/youraccount',
  prime: 'https://www.amazon.com/youraccount',
  github: 'https://github.com/settings/profile',
  'github pro': 'https://github.com/settings/profile',
  chatgpt: 'https://chatgpt.com/#settings/Account',
  openai: 'https://chatgpt.com/#settings/Account',
  youtube: 'https://www.youtube.com/account',
  'youtube premium': 'https://www.youtube.com/account',
  apple: 'https://appleid.apple.com/account/manage',
  icloud: 'https://appleid.apple.com/account/manage',
  'apple music': 'https://appleid.apple.com/account/manage',
  'apple tv': 'https://appleid.apple.com/account/manage',
  disney: 'https://www.disneyplus.com/account',
  'disney+': 'https://www.disneyplus.com/account',
  hulu: 'https://hulu.com/account',
  hbo: 'https://auth.max.com/account',
  max: 'https://auth.max.com/account',
  adobe: 'https://account.adobe.com/',
  'creative cloud': 'https://account.adobe.com/',
  photoshop: 'https://account.adobe.com/',
  dropbox: 'https://www.dropbox.com/account',
  google: 'https://myaccount.google.com/',
  'google one': 'https://myaccount.google.com/',
  'google drive': 'https://myaccount.google.com/',
  slack: 'https://slack.com/account/settings',
  notion: 'https://www.notion.so/settings',
  microsoft: 'https://account.microsoft.com/',
  'office 365': 'https://account.microsoft.com/',
  m365: 'https://account.microsoft.com/',
  linkedin: 'https://www.linkedin.com/settings/',
  twitter: 'https://x.com/settings/account',
  x: 'https://x.com/settings/account',
  vercel: 'https://vercel.com/account',
  stripe: 'https://dashboard.stripe.com/settings/account',
  linear: 'https://linear.app/settings/account',
  zoom: 'https://zoom.us/profile',
  canva: 'https://www.canva.com/settings/your-account',
  duolingo: 'https://www.duolingo.com/settings/account',
  grammarly: 'https://account.grammarly.com/',
  coursera: 'https://www.coursera.org/account-settings/profile',
  udemy: 'https://www.udemy.com/user/edit-profile/',
  playstation: 'https://store.playstation.com/account',
  'ps plus': 'https://store.playstation.com/account',
  xbox: 'https://account.microsoft.com/',
  'xbox game pass': 'https://account.microsoft.com/',
  nintendo: 'https://accounts.nintendo.com/',
  steam: 'https://store.steampowered.com/account/',
  nordvpn: 'https://my.nordaccount.com/',
  expressvpn: 'https://www.expressvpn.com/users/sign_in',
  '1password': 'https://my.1password.com/profile',
  bitwarden: 'https://vault.bitwarden.com/#/settings/account',
  figma: 'https://www.figma.com/settings',
  loom: 'https://www.loom.com/settings/account',
  miro: 'https://miro.com/app/dashboard/',
  trello: 'https://trello.com/my/profile',
  asana: 'https://app.asana.com/-/profile',
};

export function getKnownProviderAccountUrl(name: string): string | null {
  const norm = name.toLowerCase().trim();
  if (!norm) return null;
  if (KNOWN_PROVIDER_ACCOUNT_URLS[norm]) {
    return KNOWN_PROVIDER_ACCOUNT_URLS[norm];
  }
  for (const [key, url] of Object.entries(KNOWN_PROVIDER_ACCOUNT_URLS)) {
    if (norm.includes(key)) {
      return url;
    }
  }
  return null;
}

export function getProviderAccountUrl(name: string, customAccountUrl?: string | null): string | null {
  if (customAccountUrl && customAccountUrl.trim()) {
    const trimmed = customAccountUrl.trim();
    return trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`;
  }
  return getKnownProviderAccountUrl(name);
}

export function getKnownProviderWebsite(name: string): string | null {
  const norm = name.toLowerCase().trim();
  if (!norm) return null;
  if (KNOWN_PROVIDER_WEBSITES[norm]) {
    return KNOWN_PROVIDER_WEBSITES[norm];
  }
  for (const [key, url] of Object.entries(KNOWN_PROVIDER_WEBSITES)) {
    if (norm.includes(key)) {
      return url;
    }
  }
  return null;
}

export function getKnownProviderManagementUrl(name: string): string | null {
  const norm = name.toLowerCase().trim();
  if (!norm) return null;
  if (KNOWN_PROVIDER_MANAGEMENT_URLS[norm]) {
    return KNOWN_PROVIDER_MANAGEMENT_URLS[norm];
  }
  for (const [key, url] of Object.entries(KNOWN_PROVIDER_MANAGEMENT_URLS)) {
    if (norm.includes(key)) {
      return url;
    }
  }
  return null;
}

export function getProviderWebsite(name: string, providerUrl?: string | null): string | null {
  const known = getKnownProviderWebsite(name);
  if (known) return known;

  if (providerUrl && providerUrl.trim()) {
    return providerUrl.trim();
  }

  return null;
}

export function getProviderManagementUrl(name: string, providerUrl?: string | null): string | null {
  const knownWebsite = getKnownProviderWebsite(name);
  const knownManagement = getKnownProviderManagementUrl(name);

  if (providerUrl && providerUrl.trim() && providerUrl.trim() !== knownWebsite) {
    return providerUrl.trim();
  }

  if (knownManagement) {
    return knownManagement;
  }

  if (knownWebsite) {
    return knownWebsite;
  }

  if (providerUrl && providerUrl.trim()) {
    return providerUrl.trim();
  }

  return null;
}

export function parseAccountLinks(subscription: SubscriptionRow | null | undefined): AccountLink[] {
  if (!subscription) return [];

  const processLinks = (links: any[]): AccountLink[] => {
    return links
      .filter((link) => link && (link.label || link.url))
      .map((link, idx) => ({
        id: link.id || `link-${idx}-${Date.now()}`,
        label: link.label || 'Personal',
        url: link.url || '',
      }));
  };

  if (Array.isArray(subscription.account_links) && subscription.account_links.length > 0) {
    return processLinks(subscription.account_links);
  }
  if (subscription.notes && subscription.notes.includes('[AccountLinks:')) {
    try {
      const match = subscription.notes.match(/\[AccountLinks:\s*(\[.*?\])\]/);
      if (match && match[1]) {
        const parsed = JSON.parse(match[1]);
        if (Array.isArray(parsed)) {
          return processLinks(parsed);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }
  return [];
}

export interface HistoryStateMetadata {
  state: 'archived' | 'deleted';
  previousStatus?: 'active' | 'paused' | 'canceled' | 'trial';
  archivedAt?: string;
  deletedAt?: string;
}

export interface RestoredHistoryRecord {
  id: string;
  subscriptionId: string;
  name: string;
  provider: string;
  previousState: 'Archived' | 'Deleted';
  dateRestored: string;
}

export function getSubscriptionHistoryState(subscription: SubscriptionRow | null | undefined): {
  state: 'active' | 'archived' | 'deleted';
  metadata?: HistoryStateMetadata;
} {
  if (!subscription || !subscription.notes) {
    return { state: 'active' };
  }
  if (subscription.notes.includes('[HistoryState:')) {
    try {
      const match = subscription.notes.match(/\[HistoryState:\s*(\{.*?\})\]/);
      if (match && match[1]) {
        const parsed: HistoryStateMetadata = JSON.parse(match[1]);
        if (parsed.state === 'archived' || parsed.state === 'deleted') {
          return { state: parsed.state, metadata: parsed };
        }
      }
    } catch {
      // Ignore parse errors
    }
  }
  return { state: 'active' };
}

export function cleanNotesUserText(notesText: string | null | undefined): string {
  if (!notesText) return '';
  return notesText
    .replace(/\[AccountLinks:\s*\[.*?\]\]/g, '')
    .replace(/\[HistoryState:\s*\{.*?\}\]/g, '')
    .trim();
}

export function formatNotesWithAccountLinks(
  userNotes: string | null | undefined,
  links: AccountLink[],
  existingHistoryState?: HistoryStateMetadata | null
): string | null {
  const clean = cleanNotesUserText(userNotes);
  const parts: string[] = [];
  if (clean) parts.push(clean);
  if (links && links.length > 0) {
    parts.push(`[AccountLinks: ${JSON.stringify(links)}]`);
  }
  if (existingHistoryState) {
    parts.push(`[HistoryState: ${JSON.stringify(existingHistoryState)}]`);
  }
  return parts.length > 0 ? parts.join('\n') : null;
}

export function filterActiveSubscriptions(subscriptions: SubscriptionRow[]): SubscriptionRow[] {
  return subscriptions.filter((sub) => getSubscriptionHistoryState(sub).state === 'active');
}

export function filterArchivedSubscriptions(subscriptions: SubscriptionRow[]): SubscriptionRow[] {
  return subscriptions.filter((sub) => getSubscriptionHistoryState(sub).state === 'archived');
}

export function filterDeletedSubscriptions(subscriptions: SubscriptionRow[]): SubscriptionRow[] {
  return subscriptions.filter((sub) => getSubscriptionHistoryState(sub).state === 'deleted');
}

let cachedSubscriptions: SubscriptionRow[] | null = null;

export function getCachedSubscriptions(): SubscriptionRow[] | null {
  return cachedSubscriptions;
}

export async function fetchSubscriptions(): Promise<{ data: SubscriptionRow[] | null; error: Error | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .order('next_billing_date', { ascending: true });

  if (error) return { data: cachedSubscriptions, error: new Error(error.message) };
  if (data) {
    cachedSubscriptions = data;
  }
  return { data: data || cachedSubscriptions, error: null };
}

export async function createSubscription(
  subscriptionData: Omit<SubscriptionInsert, 'user_id'>
): Promise<{ data: SubscriptionRow | null; error: Error | null }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: new Error('User is not authenticated.') };
  }

  const { data, error } = await supabase
    .from('subscriptions')
    .insert({
      ...subscriptionData,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) return { data: null, error: new Error(error.message) };
  return { data, error: null };
}

export async function updateSubscription(
  id: string,
  subscriptionData: SubscriptionUpdate
): Promise<{ data: SubscriptionRow | null; error: Error | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('subscriptions')
    .update(subscriptionData)
    .eq('id', id)
    .select()
    .single();

  if (error) return { data: null, error: new Error(error.message) };
  return { data, error: null };
}

export async function deleteSubscription(id: string): Promise<{ error: Error | null }> {
  const supabase = createClient();
  const { error } = await supabase
    .from('subscriptions')
    .delete()
    .eq('id', id);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function archiveSubscription(id: string): Promise<{ data: SubscriptionRow | null; error: Error | null }> {
  const supabase = createClient();
  const { data: sub, error: fetchErr } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !sub) {
    return { data: null, error: new Error(fetchErr?.message || 'Subscription not found.') };
  }

  const links = parseAccountLinks(sub);
  const userNotes = cleanNotesUserText(sub.notes);
  const historyMetadata: HistoryStateMetadata = {
    state: 'archived',
    previousStatus: sub.status as any,
    archivedAt: new Date().toISOString(),
  };

  const newNotes = formatNotesWithAccountLinks(userNotes, links, historyMetadata);

  return await updateSubscription(id, { notes: newNotes });
}

export async function softDeleteSubscription(id: string): Promise<{ data: SubscriptionRow | null; error: Error | null }> {
  const supabase = createClient();
  const { data: sub, error: fetchErr } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !sub) {
    return { data: null, error: new Error(fetchErr?.message || 'Subscription not found.') };
  }

  const links = parseAccountLinks(sub);
  const userNotes = cleanNotesUserText(sub.notes);
  const historyMetadata: HistoryStateMetadata = {
    state: 'deleted',
    previousStatus: sub.status as any,
    deletedAt: new Date().toISOString(),
  };

  const newNotes = formatNotesWithAccountLinks(userNotes, links, historyMetadata);

  return await updateSubscription(id, { notes: newNotes });
}

export const RESTORED_STORAGE_KEY = 'subsync_restored_history';

export function getRestoredHistory(): RestoredHistoryRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RESTORED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addRestoredHistoryRecord(record: RestoredHistoryRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getRestoredHistory();
    const updated = [record, ...current];
    localStorage.setItem(RESTORED_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

export async function restoreSubscription(id: string): Promise<{ data: SubscriptionRow | null; error: Error | null }> {
  const supabase = createClient();
  const { data: sub, error: fetchErr } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !sub) {
    return { data: null, error: new Error(fetchErr?.message || 'Subscription not found.') };
  }

  const { state: currentState, metadata } = getSubscriptionHistoryState(sub);
  const previousStateLabel: 'Archived' | 'Deleted' = currentState === 'archived' ? 'Archived' : 'Deleted';

  const links = parseAccountLinks(sub);
  const userNotes = cleanNotesUserText(sub.notes);
  const newNotes = formatNotesWithAccountLinks(userNotes, links, null);

  const restoredStatus = metadata?.previousStatus || 'active';

  const result = await updateSubscription(id, {
    notes: newNotes,
    status: restoredStatus,
  });

  if (!result.error && result.data) {
    addRestoredHistoryRecord({
      id: `restored-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      subscriptionId: sub.id,
      name: sub.name,
      provider: sub.name,
      previousState: previousStateLabel,
      dateRestored: new Date().toISOString(),
    });
  }

  return result;
}

export async function permanentlyDeleteSubscription(id: string): Promise<{ error: Error | null }> {
  return await deleteSubscription(id);
}

export async function bulkCreateSubscriptions(
  items: Omit<SubscriptionInsert, 'user_id'>[]
): Promise<{ count: number; error: Error | null }> {
  if (!items || items.length === 0) return { count: 0, error: null };
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { count: 0, error: new Error('User is not authenticated.') };
  }

  const recordsToInsert = items.map((item) => ({
    ...item,
    user_id: user.id,
  }));

  const { data, error } = await supabase.from('subscriptions').insert(recordsToInsert).select();

  if (error) return { count: 0, error: new Error(error.message) };
  return { count: data?.length || 0, error: null };
}

