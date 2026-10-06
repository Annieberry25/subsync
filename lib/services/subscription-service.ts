import { createClient } from '@/lib/supabase/client';
import { USER_CACHE_CLEARED_EVENT } from '@/lib/auth/user-storage';
import { logger } from '@/lib/logger';
import type { Database } from '@/lib/types/database.types';
import {
  getEffectiveTier,
  getPlanLimits,
  hasReachedSubscriptionCap,
} from '@/lib/constants/plan-limits';

import { safeSetItem, safeGetItem } from '@/lib/safe-local-storage';
export type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row'];
export type SubscriptionInsert = Database['public']['Tables']['subscriptions']['Insert'];
export type SubscriptionUpdate = Database['public']['Tables']['subscriptions']['Update'];

export interface AccountLink {
  id: string;
  label?: string;
  url: string;
  email?: string;
}

export interface AttachedReceipt {
  id: string;
  fileName: string;
  uploadDate: string;
  price?: number | null;
  currency?: string | null;
  provider?: string | null;
  rawText?: string | null;
  fileUrl?: string | null;
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

export function getProviderAccountUrl(_name: string, customAccountUrl?: string | null): string | null {
  if (customAccountUrl && customAccountUrl.trim()) {
    const trimmed = customAccountUrl.trim();
    return trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`;
  }
  return null;
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

export function getProviderWebsite(_name: string, providerUrl?: string | null): string | null {
  if (providerUrl && providerUrl.trim()) {
    const trimmed = providerUrl.trim();
    return trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`;
  }
  return null;
}

export function getProviderManagementUrl(_name: string, providerUrl?: string | null): string | null {
  if (providerUrl && providerUrl.trim()) {
    const trimmed = providerUrl.trim();
    return trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`;
  }
  return null;
}

export function parseAttachedReceipts(subscription: SubscriptionRow | null | undefined): AttachedReceipt[] {
  if (!subscription) return [];

  if (Array.isArray(subscription.receipts) && subscription.receipts.length > 0) {
    return subscription.receipts as AttachedReceipt[];
  }

  if (subscription.notes && subscription.notes.includes('[AttachedReceipts:')) {
    try {
      const match = subscription.notes.match(/\[AttachedReceipts:\s*(\[.*?\])\]/);
      if (match && match[1]) {
        const parsed = JSON.parse(match[1]);
        if (Array.isArray(parsed)) {
          return parsed as AttachedReceipt[];
        }
      }
    } catch {
      // Ignore parse error
    }
  }

  return [];
}

export function parseAccountLinks(subscription: SubscriptionRow | null | undefined): AccountLink[] {
  if (!subscription) return [];

  const processLinks = (links: NonNullable<SubscriptionRow['account_links']>): AccountLink[] => {
    return links
      .filter((link) => link && (link.label || link.url || link.email))
      .map((link, idx) => ({
        id: link.id || `link-${idx}-${Date.now()}`,
        label: link.label || 'Personal',
        url: link.url || '',
        email: link.email || '',
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
    .replace(/\[AttachedReceipts:\s*\[.*?\]\]/g, '')
    .replace(/\[HistoryState:\s*\{.*?\}\]/g, '')
    .trim();
}

export function formatNotesWithAccountLinks(
  userNotes: string | null | undefined,
  links: AccountLink[],
  existingHistoryState?: HistoryStateMetadata | null,
  receipts?: AttachedReceipt[] | null
): string | null {
  const clean = cleanNotesUserText(userNotes);
  const parts: string[] = [];
  if (clean) parts.push(clean);
  if (links && links.length > 0) {
    parts.push(`[AccountLinks: ${JSON.stringify(links)}]`);
  }
  if (receipts && receipts.length > 0) {
    parts.push(`[AttachedReceipts: ${JSON.stringify(receipts)}]`);
  }
  if (existingHistoryState) {
    parts.push(`[HistoryState: ${JSON.stringify(existingHistoryState)}]`);
  }
  return parts.length > 0 ? parts.join('\n') : null;
}

/**
 * Rebuilds a row's notes for an archive/delete/restore transition while keeping
 * every metadata block the caller does not explicitly set — attached receipts
 * above all. `formatNotesWithAccountLinks` drops `[AttachedReceipts: ...]`
 * unless receipts are passed, so every call site that rewrites an existing row's
 * notes must route through here or the attachments are silently destroyed.
 */
function rebuildNotesPreservingReceipts(
  subscription: SubscriptionRow,
  userNotes: string | null | undefined,
  links: AccountLink[],
  historyState: HistoryStateMetadata | null
): string | null {
  return formatNotesWithAccountLinks(
    userNotes,
    links,
    historyState,
    parseAttachedReceipts(subscription)
  );
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

/**
 * Whether a row has already been soft-deleted.
 *
 * The history state is carried in the notes metadata, so a deleted row still
 * looks like a normal subscription to anything that only reads `status`. That is
 * what let the delete action be reachable twice on an already-deleted row.
 */
export function isSubscriptionDeleted(subscription: SubscriptionRow): boolean {
  return getSubscriptionHistoryState(subscription).state === 'deleted';
}

let cachedSubscriptions: SubscriptionRow[] | null = null;

/**
 * Drops the in-memory copy after a sign-out or an account switch.
 *
 * Without this the module-level array outlives the localStorage wipe, because
 * `getCachedSubscriptions()` falls back to it whenever the key is absent. So
 * clearing storage alone left the previous account's subscriptions resident in
 * the tab and handed them to the next account — which is why logging out and
 * signing in as someone else "still did not work".
 *
 * Listens for the event rather than being called directly so that sign-out does
 * not have to import this module (and with it the Supabase client).
 */
if (typeof window !== 'undefined') {
  window.addEventListener(USER_CACHE_CLEARED_EVENT, () => {
    cachedSubscriptions = null;
  });
}

export type SubscriptionWriteResult = {
  data: SubscriptionRow | null;
  error: Error | null;
  synced: boolean;
};

const LOCAL_SUBSCRIPTION_USER_ID = 'user_mock';

export function isLocalOnlySubscription(subscription: Pick<SubscriptionRow, 'user_id'>): boolean {
  return subscription.user_id === LOCAL_SUBSCRIPTION_USER_ID;
}

/**
 * Overdue means the next billing date has already passed, compared at local
 * midnight, on a row that is not canceled.
 *
 * Single definition on purpose: the subscriptions list, the dashboard's overdue
 * banner, the renewals page and Past Activities all answer "is this overdue?",
 * and they previously each carried their own copy. They drifted — the renewals
 * page restricted itself to `active`/`trial` while the dashboard accepted any
 * non-canceled status — so a paused row counted as overdue in one place and not
 * the other.
 *
 * Exported because Past Activities synthesises activity entries from overdue rows
 * and must agree with all of them.
 */
export function isOverdueSubscription(
  subscription: Pick<SubscriptionRow, 'status' | 'next_billing_date'>,
  now: Date = new Date()
): boolean {
  if (subscription.status === 'canceled') return false;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const nextBilling = new Date(subscription.next_billing_date);
  if (Number.isNaN(nextBilling.getTime())) return false;
  return nextBilling.getTime() < today.getTime();
}

export function getCachedSubscriptions(): SubscriptionRow[] | null {
  if (typeof window !== 'undefined') {
    try {
      const local = safeGetItem('subhalt_subscriptions');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) {
          cachedSubscriptions = parsed;
          return parsed;
        }
      }
    } catch {
      // Ignore
    }
  }
  return cachedSubscriptions;
}

function writeCachedSubscriptions(list: SubscriptionRow[]): void {
  cachedSubscriptions = list;
  if (typeof window !== 'undefined') {
    try {
      safeSetItem('subhalt_subscriptions', JSON.stringify(list));
    } catch {}
  }
}

function dispatchSubscriptionsUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('subhalt_subscriptions_updated'));
}

/**
 * Pushes locally-created (offline) subscriptions into Supabase once a session
 * exists and the DB is reachable. Successful pushes leave the cache (their
 * canonical rows with real UUIDs arrive on the next fetch); the UI is told via
 * the returned count so callers can refresh.
 */
export async function syncPendingSubscriptions(): Promise<number> {
  const cached = getCachedSubscriptions() || [];
  const pending = cached.filter((sub) => isLocalOnlySubscription(sub));
  if (pending.length === 0) return 0;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const syncedLocalIds = new Set<string>();
  for (const sub of pending) {
    const { error } = await supabase.from('subscriptions').insert({
      user_id: user.id,
      name: sub.name,
      price: sub.price,
      currency: sub.currency,
      billing_cycle: sub.billing_cycle,
      category: sub.category,
      status: sub.status,
      start_date: sub.start_date,
      end_date: sub.end_date,
      next_billing_date: sub.next_billing_date,
      payment_method: sub.payment_method,
      provider_url: sub.provider_url,
      notes: sub.notes,
      account_links: sub.account_links,
      receipts: sub.receipts,
      is_synced: true,
    });

    if (!error) {
      syncedLocalIds.add(sub.id);
    } else {
      logger.warn('[subscription-service] syncPendingSubscriptions insert failed', {
        message: error.message,
        id: sub.id,
      });
    }
  }

  if (syncedLocalIds.size > 0) {
    writeCachedSubscriptions(cached.filter((s) => !syncedLocalIds.has(s.id)));
  }
  return syncedLocalIds.size;
}

export async function fetchSubscriptions(): Promise<{ data: SubscriptionRow[] | null; error: Error | null }> {
  const cached = getCachedSubscriptions() || [];
  try {
    // Reconcile offline-created rows first so the merge below starts clean.
    if (cached.some((sub) => isLocalOnlySubscription(sub))) {
      await syncPendingSubscriptions();
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // No session: there is nothing to fetch, and returning the cache here is how
    // a previous account's rows end up rendered for whoever is signed in now.
    if (!user) {
      writeCachedSubscriptions([]);
      return { data: [], error: null };
    }

    // Scoped to the caller explicitly, even though RLS already enforces
    // `auth.uid() = user_id`. Defence in depth: the browser client uses the
    // publishable key, so a policy that is ever dropped, renamed or made
    // permissive would otherwise expose every row in the table, and an
    // unfiltered `select('*')` is exactly the query that would do it.
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('next_billing_date', { ascending: true })
      .limit(500);

    if (!error && data) {
      // Merge cached local subscriptions with DB subscriptions, matching strictly
      // by id so renamed rows never duplicate.
      const current = getCachedSubscriptions() || [];
      const remoteIds = new Set(data.map((remote) => remote.id));
      // Only rows this user owns may survive the merge. Cached rows are not
      // user-scoped at the key level, so a row belonging to someone else would
      // otherwise be carried forward forever (and, if still marked local-only,
      // re-INSERTed under this user's id by syncPendingSubscriptions).
      const localOnly = current.filter(
        (local) =>
          !remoteIds.has(local.id) &&
          (isLocalOnlySubscription(local) || local.user_id === user.id)
      );
      const merged = [...localOnly, ...data];
      writeCachedSubscriptions(merged);
      return { data: merged, error: null };
    }
    if (error) {
      const dbError = new Error(error.message);
      logger.warn('[subscription-service] fetchSubscriptions DB error, using cache', { message: error.message });
      // Do not fall back to the cache on a query failure: if the failure was an
      // auth failure the cache is the previous account's data.
      return { data: [], error: dbError };
    }
  } catch (err) {
    const dbError = err instanceof Error ? err : new Error(String(err));
    logger.error('[subscription-service] fetchSubscriptions exception', err);
    // Same reasoning as the error branch above: an exception can be an auth
    // failure, and answering with the cache would surface the previous account's
    // rows. An empty list is the safe failure.
    return { data: [], error: dbError };
  }

  return { data: cached, error: null };
}

export async function createSubscription(
  subscriptionData: Omit<SubscriptionInsert, 'user_id'> & { id?: string }
): Promise<SubscriptionWriteResult> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // Plan-tier cap enforced on the write path itself, not just the UI, so
      // any caller (add flow, Gmail import, offline sync re-create) is bounded.
      // is_admin is read here too: an admin resolves to the unlimited tier, so
      // the operator account is not capped while running the app.
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan_tier, is_admin')
        .eq('id', user.id)
        .maybeSingle();
      const isAdmin = profile?.is_admin === true;
      const tier = getEffectiveTier(profile?.plan_tier, isAdmin);
      const { count } = await supabase
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .not('status', 'eq', 'canceled');
      const activeCount = typeof count === 'number' ? count : 0;
      if (hasReachedSubscriptionCap({ tier, activeCount, isAdmin })) {
        const limit = getPlanLimits(tier).maxSubscriptions;
        return {
          data: null,
          error: new Error(`Upgrade to Plus to track more than ${limit} subscriptions.`),
          synced: false,
        };
      }

      const { data, error } = await supabase
        .from('subscriptions')
        .insert({
          ...subscriptionData,
          user_id: user.id,
        })
        .select()
        .single();

      if (!error && data) {
        const existingList = getCachedSubscriptions() || [];
        const list = [data, ...existingList.filter((s) => s.id !== data.id)];
        cachedSubscriptions = list;
        if (typeof window !== 'undefined') {
          safeSetItem('subhalt_subscriptions', JSON.stringify(list));
          window.dispatchEvent(new CustomEvent('subhalt_subscription_created', { detail: data }));
          window.dispatchEvent(new Event('subhalt_subscriptions_updated'));
        }
        return { data, error: null, synced: true };
      }
      if (error) {
        const dbError = new Error(error.message);
        logger.warn('[subscription-service] createSubscription DB error', { message: error.message });
        return { data: null, error: dbError, synced: false };
      }
    } else {
      logger.warn('[subscription-service] createSubscription called without authenticated user');
    }
  } catch (err) {
    logger.error('[subscription-service] createSubscription exception, persisting locally', err);
  }

  // Offline / storage-only fallback: persisted locally, flagged for later sync.
  const mockSub: SubscriptionRow = {
    id: subscriptionData.id || 'sub_' + Date.now(),
    user_id: LOCAL_SUBSCRIPTION_USER_ID,
    name: subscriptionData.name,
    price: subscriptionData.price,
    currency: subscriptionData.currency || 'USD',
    billing_cycle: subscriptionData.billing_cycle || 'monthly',
    category: subscriptionData.category || 'Software',
    next_billing_date: subscriptionData.next_billing_date,
    start_date: subscriptionData.start_date || new Date().toISOString().split('T')[0],
    end_date: subscriptionData.end_date || null,
    status: subscriptionData.status || 'active',
    payment_method: subscriptionData.payment_method || null,
    provider_url: subscriptionData.provider_url || null,
    notes: subscriptionData.notes || null,
    account_links: subscriptionData.account_links || null,
    receipts: subscriptionData.receipts || null,
    is_synced: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const existingList = getCachedSubscriptions() || [];
  const list = [mockSub, ...existingList.filter((s) => s.id !== mockSub.id)];
  writeCachedSubscriptions(list);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('subhalt_subscription_created', { detail: mockSub }));
    dispatchSubscriptionsUpdated();
  }

  return { data: mockSub, error: null, synced: false };
}

export async function updateSubscription(
  id: string,
  subscriptionData: SubscriptionUpdate
): Promise<SubscriptionWriteResult> {
  // Offline-created rows live only in the cache — update them locally.
  const localRow = (getCachedSubscriptions() || []).find((s) => s.id === id && isLocalOnlySubscription(s));
  if (localRow) {
    const updated: SubscriptionRow = {
      ...localRow,
      ...(subscriptionData as Partial<SubscriptionRow>),
      updated_at: new Date().toISOString(),
      is_synced: false,
    };
    const list = (getCachedSubscriptions() || []).map((s) => (s.id === id ? updated : s));
    writeCachedSubscriptions(list);
    dispatchSubscriptionsUpdated();
    return { data: updated, error: null, synced: false };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('subscriptions')
    .update(subscriptionData)
    .eq('id', id)
    .select()
    .single();

  if (error) return { data: null, error: new Error(error.message), synced: false };

  if (data) {
    const current = getCachedSubscriptions() || [];
    const list = [data, ...current.filter((s) => s.id !== data.id)];
    writeCachedSubscriptions(list);
    dispatchSubscriptionsUpdated();
  }
  return { data, error: null, synced: true };
}

export async function deleteSubscription(id: string): Promise<{ error: Error | null; synced: boolean }> {
  // Offline-created rows live only in the cache — remove them locally.
  const localRow = (getCachedSubscriptions() || []).find((s) => s.id === id && isLocalOnlySubscription(s));
  if (localRow) {
    const list = (getCachedSubscriptions() || []).filter((s) => s.id !== id);
    writeCachedSubscriptions(list);
    dispatchSubscriptionsUpdated();
    return { error: null, synced: false };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('subscriptions')
    .delete()
    .eq('id', id);

  if (error) return { error: new Error(error.message), synced: false };

  const current = getCachedSubscriptions() || [];
  writeCachedSubscriptions(current.filter((s) => s.id !== id));
  dispatchSubscriptionsUpdated();
  return { error: null, synced: true };
}

export async function archiveSubscription(id: string): Promise<SubscriptionWriteResult> {
  // Offline-created rows live only in the cache.
  const localRow = (getCachedSubscriptions() || []).find((s) => s.id === id && isLocalOnlySubscription(s));
  if (localRow) {
    const links = parseAccountLinks(localRow);
    const userNotes = cleanNotesUserText(localRow.notes);
    const historyMetadata: HistoryStateMetadata = {
      state: 'archived',
      previousStatus: localRow.status,
      archivedAt: new Date().toISOString(),
    };
    const newNotes = rebuildNotesPreservingReceipts(localRow, userNotes, links, historyMetadata);
    return updateSubscription(id, { notes: newNotes });
  }

  const supabase = createClient();
  const { data: sub, error: fetchErr } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !sub) {
    return { data: null, error: new Error(fetchErr?.message || 'Subscription not found.'), synced: false };
  }

  const links = parseAccountLinks(sub);
  const userNotes = cleanNotesUserText(sub.notes);
  const historyMetadata: HistoryStateMetadata = {
    state: 'archived',
    previousStatus: sub.status,
      archivedAt: new Date().toISOString(),
    };

  const newNotes = rebuildNotesPreservingReceipts(sub, userNotes, links, historyMetadata);

  return await updateSubscription(id, { notes: newNotes });
}

export async function softDeleteSubscription(id: string): Promise<SubscriptionWriteResult> {
  // Offline-created rows live only in the cache.
  const localRow = (getCachedSubscriptions() || []).find((s) => s.id === id && isLocalOnlySubscription(s));
  if (localRow) {
    const links = parseAccountLinks(localRow);
    const userNotes = cleanNotesUserText(localRow.notes);
    const historyMetadata: HistoryStateMetadata = {
      state: 'deleted',
      previousStatus: localRow.status,
      deletedAt: new Date().toISOString(),
    };
    const newNotes = rebuildNotesPreservingReceipts(localRow, userNotes, links, historyMetadata);
    return updateSubscription(id, { notes: newNotes });
  }

  const supabase = createClient();
  const { data: sub, error: fetchErr } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !sub) {
    return { data: null, error: new Error(fetchErr?.message || 'Subscription not found.'), synced: false };
  }

  const links = parseAccountLinks(sub);
  const userNotes = cleanNotesUserText(sub.notes);
  const historyMetadata: HistoryStateMetadata = {
    state: 'deleted',
    previousStatus: sub.status,
    deletedAt: new Date().toISOString(),
  };

  const newNotes = rebuildNotesPreservingReceipts(sub, userNotes, links, historyMetadata);

  return await updateSubscription(id, { notes: newNotes });
}

export const RESTORED_STORAGE_KEY = 'subhalt_restored_history';

export function getRestoredHistory(): RestoredHistoryRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = safeGetItem(RESTORED_STORAGE_KEY);
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
    safeSetItem(RESTORED_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

export async function restoreSubscription(id: string): Promise<SubscriptionWriteResult> {
  // Offline-created rows live only in the cache.
  const localRow = (getCachedSubscriptions() || []).find((s) => s.id === id && isLocalOnlySubscription(s));
  if (localRow) {
    const links = parseAccountLinks(localRow);
    const userNotes = cleanNotesUserText(localRow.notes);
    const newNotes = rebuildNotesPreservingReceipts(localRow, userNotes, links, null);
    const result = await updateSubscription(id, {
      notes: newNotes,
      status: 'active',
    });
    if (!result.error && result.data) {
      addRestoredHistoryRecord({
        id: `restored-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        subscriptionId: id,
        name: localRow.name,
        provider: localRow.name,
        previousState: 'Archived',
        dateRestored: new Date().toISOString(),
      });
    }
    return result;
  }

  const supabase = createClient();
  const { data: sub, error: fetchErr } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !sub) {
    return { data: null, error: new Error(fetchErr?.message || 'Subscription not found.'), synced: false };
  }

  const { state: currentState, metadata } = getSubscriptionHistoryState(sub);
  const previousStateLabel: 'Archived' | 'Deleted' = currentState === 'archived' ? 'Archived' : 'Deleted';

  const links = parseAccountLinks(sub);
  const userNotes = cleanNotesUserText(sub.notes);
  const newNotes = rebuildNotesPreservingReceipts(sub, userNotes, links, null);

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

