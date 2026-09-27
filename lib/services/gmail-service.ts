/**
 * Server-only Gmail OAuth + receipt scanning service.
 *
 * NEVER import this module from client components. It holds the Google client
 * secret path and reads/writes user tokens through the service-role Supabase
 * client. The browser only talks to the API routes under /api/gmail.
 */
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import type { gmail_v1 } from 'googleapis';
import { env } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Database, Json } from '@/lib/types/database.types';
import {
  parseReceiptDocument,
  normalizeDocumentText,
} from '@/lib/services/receipt-parser';
import {
  deriveProviderFromSender,
  stripHtmlToText,
  GENERIC_PROVIDER_NAME,
} from '@/lib/services/receipt-discovery';
import type { DiscoveredSubscription } from '@/lib/types/gmail.types';

export type GmailConnectionRow = Database['public']['Tables']['gmail_connections']['Row'];

export interface GmailCredentials {
  access_token: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  expiry_date?: number | null;
}

export const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
export const GMAIL_STATE_COOKIE = 'subhalt_gmail_oauth_state';

export interface GmailStatus {
  connected: boolean;
  email?: string;
  lastScanAt?: string | null;
  lastScanCount?: number | null;
}

/** True when Google OAuth credentials are present in the environment. */
export function isGmailConfigured(): { ok: boolean; reason?: string } {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return {
      ok: false,
      reason:
        'Gmail connection is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your environment. See STEPS-GMAIL-INTEGRATION.md.',
    };
  }
  return { ok: true };
}

export function getGoogleRedirectUri(): string {
  return env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/gmail/oauth/callback';
}

export function createGoogleOAuthClient(): OAuth2Client {
  return new OAuth2Client({
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: getGoogleRedirectUri(),
  });
}

/** Build the accounts.google.com consent URL for the receipt-scanning scope. */
export function createGoogleAuthUrl(state: string, loginHint?: string): string {
  const client = createGoogleOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [GMAIL_READONLY_SCOPE],
    state,
    login_hint: loginHint,
    include_granted_scopes: true,
  });
}

type GoogleCredentialsLike = {
  access_token?: string | null;
  refresh_token?: string | null;
  scope?: string | null;
  token_type?: string | null;
  expiry_date?: number | null;
};

function normalizeCredentials(tokens: GoogleCredentialsLike): GmailCredentials {
  return {
    access_token: tokens.access_token ?? '',
    refresh_token: tokens.refresh_token ?? undefined,
    scope: tokens.scope ?? undefined,
    token_type: tokens.token_type ?? undefined,
    expiry_date: tokens.expiry_date ?? null,
  };
}

async function getGmailUserEmail(auth: OAuth2Client): Promise<string> {
  const gmail = google.gmail({ version: 'v1', auth });
  const { data } = await gmail.users.getProfile({ userId: 'me' });
  return data.emailAddress ?? '';
}

/** Exchange the one-time authorization code for tokens + the user's Gmail address. */
export async function exchangeAuthorizationCode(
  code: string
): Promise<{ tokens: GmailCredentials; email: string }> {
  const client = createGoogleOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  const email = await getGmailUserEmail(client);
  return { tokens: normalizeCredentials(tokens), email };
}

// ---------------------------------------------------------------------------
// Token storage (supabase.gmail_connections, service-role only)
// ---------------------------------------------------------------------------

export async function storeGmailConnection(
  userId: string,
  email: string,
  tokens: GmailCredentials,
  scope: string
): Promise<void> {
  const admin = createAdminClient();
  await admin.from('gmail_connections').upsert(
    {
      user_id: userId,
      email,
      credentials: normalizeCredentials(tokens) as unknown as Json,
      scope,
      status: 'connected',
    },
    { onConflict: 'user_id' }
  );
}

export async function getGmailConnection(
  userId: string
): Promise<GmailConnectionRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('gmail_connections')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return data ?? null;
}

/** Build an authenticated Gmail client for the user (refresh handled automatically). */
export async function getAuthedGmailClient(
  userId: string
): Promise<{ gmail: gmail_v1.Gmail; email: string }> {
  const conn = await getGmailConnection(userId);
  if (!conn || conn.status !== 'connected') {
    throw new Error('Gmail is not connected.');
  }
  const client = createGoogleOAuthClient();
  client.setCredentials(conn.credentials as unknown as GmailCredentials);
  const gmail = google.gmail({ version: 'v1', auth: client });
  return { gmail, email: conn.email };
}

export async function disconnectGmail(userId: string): Promise<void> {
  const conn = await getGmailConnection(userId);
  if (conn) {
    try {
      const client = createGoogleOAuthClient();
      client.setCredentials(conn.credentials as unknown as GmailCredentials);
      if (conn.credentials && (conn.credentials as Json & { refresh_token?: string }).refresh_token) {
        await client.revokeToken(
          (conn.credentials as Json & { refresh_token: string }).refresh_token
        );
      }
    } catch {
      // Revocation is best-effort; the stored row is still removed below.
    }
  }
  const admin = createAdminClient();
  await admin.from('gmail_connections').delete().eq('user_id', userId);
}

export async function getGmailStatus(userId: string): Promise<GmailStatus> {
  const conn = await getGmailConnection(userId);
  if (!conn || conn.status !== 'connected') {
    return { connected: false };
  }
  return {
    connected: true,
    email: conn.email,
    lastScanAt: conn.last_scan_at,
    lastScanCount: conn.last_scan_count,
  };
}

// ---------------------------------------------------------------------------
// Receipt scanning
// ---------------------------------------------------------------------------

const RECEIPT_QUERY =
  'subject:(receipt OR invoice OR "payment confirmation" OR "your subscription" OR "order confirmation" OR "billing statement") newer_than:1y';

const SUBJECT_RECEIPT_RE =
  /receipt|invoice|payment|subscription|billing|order|renew|charge|thank you/i;

function headerValue(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string
): string {
  if (!headers) return '';
  const found = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return found?.value ?? '';
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data, 'base64').toString('utf8');
}

function extractBodyText(payload?: gmail_v1.Schema$MessagePart): string {
  if (!payload) return '';
  const collect = (mimeType: string): string => {
    const out: string[] = [];
    const walk = (part: gmail_v1.Schema$MessagePart): void => {
      if (part.mimeType === mimeType && part.body?.data) {
        out.push(decodeBase64Url(part.body.data));
        return;
      }
      for (const child of part.parts ?? []) walk(child);
    };
    walk(payload);
    return out.join('\n');
  };

  const plain = collect('text/plain');
  if (plain.trim()) return plain;

  // Gmail frequently sends HTML-only marketing mail. Parsing raw markup makes
  // the amount regex pick up tag fragments, so the HTML is flattened first.
  const html = collect('text/html');
  return html ? stripHtmlToText(html) : '';
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

function toDiscoveredSubscription(
  id: string,
  from: string,
  subject: string,
  date: string,
  bodyText: string
): DiscoveredSubscription {
  const parsed = parseReceiptDocument(normalizeDocumentText(bodyText), {
    kind: 'subscription',
  });
  let providerName = parsed.providerName.value ?? '';
  if (!providerName || providerName === GENERIC_PROVIDER_NAME) {
    providerName = deriveProviderFromSender(from);
  }
  return {
    id,
    providerName,
    amount: parsed.amount.value ?? 0,
    currency: parsed.currency.value ?? 'USD',
    category: parsed.category.value ?? 'Other',
    billingCycle: parsed.billingCycle.value || 'unknown',
    from,
    subject,
    date: parsed.paymentDate.value ?? parsed.nextBillingDate.value ?? date,
  };
}

/**
 * Search the connected inbox for receipt/billing emails and return deduplicated
 * subscription candidates. Phase 1 reads message metadata; phase 2 fetches the
 * body of the most promising messages to extract provider + price.
 */
export async function scanGmailForSubscriptions(
  userId: string,
  maxResults = 60
): Promise<{ discovered: DiscoveredSubscription[]; scannedAt: string }> {
  const { gmail } = await getAuthedGmailClient(userId);

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: RECEIPT_QUERY,
    maxResults,
  });
  const messages = listRes.data.messages ?? [];

  const metas = await mapWithConcurrency(
    messages,
    8,
    async (message: gmail_v1.Schema$Message) => {
      if (!message.id) return null;
      const res = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      });
      const payload = res.data.payload;
      return {
        id: message.id,
        from: headerValue(payload?.headers, 'From'),
        subject: headerValue(payload?.headers, 'Subject'),
        date: headerValue(payload?.headers, 'Date'),
      };
    }
  );

  const candidates = metas
    .filter((m): m is NonNullable<typeof m> => !!m)
    .filter((m) => SUBJECT_RECEIPT_RE.test(m.subject))
    .slice(0, 20);

  const enriched = await mapWithConcurrency(
    candidates,
    5,
    async (candidate) => {
      const res = await gmail.users.messages.get({
        userId: 'me',
        id: candidate.id,
        format: 'full',
      });
      const bodyText = extractBodyText(res.data.payload);
      return toDiscoveredSubscription(
        candidate.id,
        candidate.from,
        candidate.subject,
        candidate.date,
        bodyText
      );
    }
  );

  const providerByName = new Map<string, DiscoveredSubscription>();
  for (const sub of enriched) {
    if (!sub.providerName || sub.providerName === GENERIC_PROVIDER_NAME) continue;
    const key = sub.providerName.toLowerCase().trim();
    const existing = providerByName.get(key);
    if (!existing || (sub.amount > 0 && existing.amount === 0)) {
      providerByName.set(key, sub);
    }
  }

  const discovered = Array.from(providerByName.values());

  const admin = createAdminClient();
  await admin
    .from('gmail_connections')
    .update({
      last_scan_at: new Date().toISOString(),
      last_scan_status: 'success',
      last_scan_count: discovered.length,
    })
    .eq('user_id', userId);

  return { discovered, scannedAt: new Date().toISOString() };
}