import crypto from 'crypto';

/**
 * Stateless, time-windowed 6-digit confirmation code for account deletion.
 *
 * Used by accounts that signed up via OAuth (Google) and have no password to
 * re-enter at the deletion prompt. Instead of storing a one-off token in the
 * database, the code is derived from `(userId, timeWindow)` with HMAC-SHA256
 * using a server-only secret — the same construction as TOTP — and emailed to
 * the user's own address.
 *
 * A 10-minute window with ±1 window tolerance gives the user 10–20 minutes to
 * read the email and paste the code without needing any schema change.
 */

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
/** Largest multiple of 1,000,000 below 2^32, eliminating modulo bias. */
const UNBIASED_CEILING = 4_294_000_000;

/**
 * Resolves the signing secret. Prefers a dedicated `ACCOUNT_DELETE_SIGNING_KEY`
 * and falls back to `GMAIL_TOKEN_ENCRYPTION_KEY` or `CRON_SECRET`.
 * Deliberately excludes `SUPABASE_WEBHOOK_SECRET` so webhook secrets cannot be
 * used to forge user verification codes.
 */
export function getAccountDeleteSigningKey(): string {
  return (
    process.env.ACCOUNT_DELETE_SIGNING_KEY?.trim() ||
    process.env.GMAIL_TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    ''
  );
}

export function isAccountDeleteCodeConfigured(): boolean {
  return getAccountDeleteSigningKey().length > 0;
}

function codeForBucket(userId: string, bucket: number, key: string): string {
  const derivedKey = crypto
    .createHmac('sha256', 'subhalt:account-delete:v1')
    .update(key)
    .digest();
  const digest = crypto
    .createHmac('sha256', derivedKey)
    .update(`account-delete:${userId}:${bucket}`)
    .digest();

  for (let offset = 0; offset <= digest.length - 4; offset += 4) {
    const val = digest.readUInt32BE(offset);
    if (val < UNBIASED_CEILING) {
      return String(val % 1_000_000).padStart(6, '0');
    }
  }

  const fallback = (digest.readUInt32BE(0) & 0x7fffffff) % 1_000_000;
  return String(fallback).padStart(6, '0');
}

export function generateAccountDeleteCode(userId: string, now = Date.now()): string {
  const key = getAccountDeleteSigningKey();
  if (!key) {
    throw new Error('Account delete signing key is not configured.');
  }
  const bucket = Math.floor(now / WINDOW_MS);
  return codeForBucket(userId, bucket, key);
}

export function verifyAccountDeleteCode(
  userId: string,
  submitted: string,
  now = Date.now()
): boolean {
  const key = getAccountDeleteSigningKey();
  if (!key) return false;

  const clean = submitted.trim();
  if (!/^\d{6}$/.test(clean)) return false;

  const currentBucket = Math.floor(now / WINDOW_MS);
  const cleanBuf = Buffer.from(clean);

  // Check current and previous bucket so a code issued near a boundary stays
  // valid for at least one full window. Constant-time comparison across all
  // candidate buckets avoids leaking partial digit matches via timing.
  let matched = false;
  for (const offset of [0, -1]) {
    const expected = Buffer.from(codeForBucket(userId, currentBucket + offset, key));
    if (expected.length === cleanBuf.length && crypto.timingSafeEqual(expected, cleanBuf)) {
      matched = true;
    }
  }
  return matched;
}
