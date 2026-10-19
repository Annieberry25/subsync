/**
 * Server-only Gmail OAuth + receipt scanning service.
 *
 * NEVER import this module from client components. It holds the Google client
 * secret path and reads/writes user tokens through the service-role Supabase
 * client. The browser only talks to the API routes under /api/gmail.
 */
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { randomBytes } from 'node:crypto';
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
  normalizeSubscriptionName,
  GENERIC_PROVIDER_NAME,
} from '@/lib/services/receipt-discovery';
import {
  encryptGmailCredentials,
  decryptGmailCredentials,
  isGmailTokenEncryptionConfigured,
  looksEncrypted,
  warnMissingEncryptionKey,
  type StoredGmailCredentials,
} from '@/lib/services/gmail-token-crypto';
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

/**
 * The stored Google grant is no longer usable: it expired (an unverified OAuth
 * app left in Google's "Testing" mode expires refresh tokens after 7 days), or
 * the user revoked access. Distinct from a transient API failure because the
 * only fix is a fresh authorization — retrying cannot recover it.
 */
export class GmailTokenExpiredError extends Error {
  constructor(message = 'Gmail authorization has expired.') {
    super(message);
    this.name = 'GmailTokenExpiredError';
  }
}

function errorStatus(err: unknown): number | null {
  if (typeof err !== 'object' || err === null) return null;
  const candidate = err as { response?: { status?: unknown }; code?: unknown; status?: unknown };
  for (const value of [candidate.response?.status, candidate.code, candidate.status]) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

/**
 * Does this failure mean "the grant is dead, re-authorize"?
 *
 * Deliberately conservative: it only claims a dead grant when Google said so in
 * words. A 403 (quota, for example) is not treated as an expired grant, because
 * flipping the connection into a "reconnect" state on a transient blip would
 * send the user through an unnecessary OAuth round-trip.
 */
export function isGmailTokenError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? '');
  const haystack = message.toLowerCase();
  if (
    haystack.includes('invalid_grant') ||
    haystack.includes('unauthorized_client') ||
    haystack.includes('revoked')
  ) {
    return true;
  }
  if (haystack.includes('token') && (haystack.includes('expired') || haystack.includes('invalid'))) {
    return true;
  }
  return errorStatus(err) === 401;
}

/**
 * CSRF state for the Gmail OAuth flow, bound to the user who started it.
 *
 * Format: `<hex nonce>.<user id>`. The nonce is stored in an httpOnly cookie
 * and validated on return; the embedded user id additionally pins the state to
 * the authenticated session, so a state minted for one account cannot be
 * replayed against another even if it leaks somewhere the cookie does not.
 */
export function createGmailState(userId: string): string {
  const nonce = randomBytes(16).toString('hex');
  return `${nonce}.${userId}`;
}

/** Does this `state` belong to `userId` and parse as a nonce.userId pair? */
export function gmailStateMatches(state: string, userId: string): boolean {
  const separator = state.lastIndexOf('.');
  if (separator <= 0) return false;
  const nonce = state.slice(0, separator);
  const boundUserId = state.slice(separator + 1);
  return boundUserId === userId && /^[a-f0-9]{32}$/.test(nonce);
}

export interface GmailStatus {
  connected: boolean;
  email?: string;
  lastScanAt?: string | null;
  lastScanCount?: number | null;
  /** A connection row exists, but its Google grant is gone and must be re-authorized. */
  needsReconnect?: boolean;
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
  // Only the refresh credential is ever written. The access_token and
  // expiry_date are short-lived and regenerated from the refresh token on
  // demand, so persisting them just widens the blast radius of a leak.
  const stored: StoredGmailCredentials = {
    refresh_token: tokens.refresh_token,
    scope: tokens.scope ?? scope,
    token_type: tokens.token_type,
  };

  let credentialsValue: string | StoredGmailCredentials = stored;
  if (isGmailTokenEncryptionConfigured()) {
    credentialsValue = encryptGmailCredentials(stored);
  } else {
    warnMissingEncryptionKey();
  }

  const admin = createAdminClient();
  await admin.from('gmail_connections').upsert(
    {
      user_id: userId,
      email,
      credentials: credentialsValue as unknown as Json,
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

/**
 * Read the stored refresh credentials back out of a row.
 *
 * Accepts both the encrypted blob format (current) and the legacy plaintext
 * object so pre-encryption rows keep working. When encryption is configured and
 * a plaintext row is found, it is re-encrypted in place.
 */
async function readGmailCredentials(
  admin: ReturnType<typeof createAdminClient>,
  conn: GmailConnectionRow
): Promise<StoredGmailCredentials> {
  const raw = conn.credentials as unknown;

  if (looksEncrypted(raw)) {
    if (!isGmailTokenEncryptionConfigured()) {
      // Encrypted on disk, key now missing: the token is unreadable. Do not
      // silently delete the row; surface the configuration gap.
      throw new Error('Gmail credentials are encrypted but GMAIL_TOKEN_ENCRYPTION_KEY is not configured.');
    }
    return decryptGmailCredentials(raw);
  }

  if (isGmailTokenEncryptionConfigured()) {
    // Legacy plaintext row; upgrade it now that a key exists.
    const creds = raw as unknown as StoredGmailCredentials;
    await admin
      .from('gmail_connections')
      .update({ credentials: encryptGmailCredentials(creds) as unknown as Json })
      .eq('user_id', conn.user_id);
    return creds;
  }

  warnMissingEncryptionKey();
  return (raw ?? {}) as StoredGmailCredentials;
}

/** Build an authenticated Gmail client for the user (refresh handled automatically). */
export async function getAuthedGmailClient(
  userId: string
): Promise<{ gmail: gmail_v1.Gmail; email: string }> {
  const conn = await getGmailConnection(userId);
  if (!conn || conn.status !== 'connected') {
    throw new Error('Gmail is not connected.');
  }
  const admin = createAdminClient();
  const credentials = await readGmailCredentials(admin, conn);
  if (!credentials.refresh_token) {
    throw new Error('Gmail connection is missing a refresh token.');
  }
  const client = createGoogleOAuthClient();
  client.setCredentials({
    refresh_token: credentials.refresh_token,
    scope: credentials.scope,
    token_type: credentials.token_type,
  });
  // Force a token exchange up front so a caller can never act on a stale or
  // absent access_token. The library refreshes whenever the stored access token
  // is missing/expiring, and we never persisted one.
  try {
    await client.getAccessToken();
  } catch (err) {
    if (isGmailTokenError(err)) {
      // Persist the dead-grant state so the UI can offer a reconnect instead of
      // letting every future scan fail with the same opaque message.
      await markGmailGrantExpired(userId);
      throw new GmailTokenExpiredError();
    }
    throw err;
  }
  const gmail = google.gmail({ version: 'v1', auth: client });
  return { gmail, email: conn.email };
}

/**
 * Split a scan's discoveries into the ones worth showing and the ones the user
 * already has.
 *
 * A receipt scan re-reads a year of mail, so without this the sheet re-offers
 * everything on every visit — which reads as "it scanned and found the same
 * thing again" and invites duplicate imports. Matches the background monitor's
 * own filter (gmail-monitor) so both paths agree on what counts as new.
 */
export function partitionNewDiscoveries(
  discovered: DiscoveredSubscription[],
  existingNames: string[]
): { discovered: DiscoveredSubscription[]; alreadyKnown: number } {
  const existing = new Set(existingNames.map((name) => normalizeSubscriptionName(name)));
  const fresh = discovered.filter(
    (item) => !existing.has(normalizeSubscriptionName(item.providerName))
  );
  return { discovered: fresh, alreadyKnown: discovered.length - fresh.length };
}

/**
 * Mark the stored grant as unusable.
 *
 * `gmail_connections.status` is constrained to ('connected', 'revoked',
 * 'error') by migration 008, so a dead grant is stored as 'error' and read
 * back as `needsReconnect`. Best-effort: a failure to write must not mask the
 * original error the caller is about to surface.
 */
export async function markGmailGrantExpired(userId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin
      .from('gmail_connections')
      .update({
        status: 'error',
        last_scan_at: new Date().toISOString(),
        last_scan_status: 'error',
      })
      .eq('user_id', userId);
  } catch (err) {
    console.error(
      '[gmail] could not record the expired grant:',
      err instanceof Error ? err.message : err
    );
  }
}

/** Record a failed scan for a connection whose grant is still considered live. */
export async function recordGmailScanFailure(userId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin
      .from('gmail_connections')
      .update({
        last_scan_at: new Date().toISOString(),
        last_scan_status: 'error',
      })
      .eq('user_id', userId);
  } catch (err) {
    console.error(
      '[gmail] could not record the failed scan:',
      err instanceof Error ? err.message : err
    );
  }
}

export async function disconnectGmail(userId: string): Promise<void> {
  const conn = await getGmailConnection(userId);
  if (conn) {
    try {
      const admin = createAdminClient();
      const credentials = await readGmailCredentials(admin, conn);
      if (credentials.refresh_token) {
        const client = createGoogleOAuthClient();
        await client.revokeToken(credentials.refresh_token);
      }
    } catch {
      // Revocation is best-effort; the stored row is still removed below.
    }
  }
  const admin = createAdminClient();
  await admin.from('gmail_connections').delete().eq('user_id', userId);
}

/**
 * Map a connection row to the client-safe status shape.
 *
 * A row that exists but is no longer 'connected' means the grant died (or was
 * revoked): the user still has a Gmail connection on file, but scanning it
 * would fail until they re-authorize. Split out from the query so the mapping
 * stays testable without a database.
 */
export function gmailStatusFromRow(conn: GmailConnectionRow | null): GmailStatus {
  if (!conn) return { connected: false };
  if (conn.status === 'connected') {
    return {
      connected: true,
      email: conn.email,
      lastScanAt: conn.last_scan_at,
      lastScanCount: conn.last_scan_count,
    };
  }
  return { connected: false, needsReconnect: conn.status === 'error' || conn.status === 'revoked' };
}

export async function getGmailStatus(userId: string): Promise<GmailStatus> {
  return gmailStatusFromRow(await getGmailConnection(userId));
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