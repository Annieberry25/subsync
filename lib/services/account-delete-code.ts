/**
 * Stateless, email-delivered verification for high-risk account actions.
 *
 * Deleting an account requires this code for every user, password or
 * OAuth-only alike, so ownership is always proven by access to the account
 * email. The app emails a 6-digit code that is the HMAC of `userId` + a
 * 30-second time window, signed with a server secret. No state is stored; the
 * code is valid for the window it was issued in plus one step on each side to
 * absorb clock skew and delivery lag.
 *
 * The signing key comes from ACCOUNT_DELETE_SIGNING_KEY, falling back to the
 * existing SUPABASE_WEBHOOK_SECRET / CRON_SECRET values so deployments that
 * already rotate secrets can go live without a new variable.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

const STEP_MS = 30 * 1000;
/** How far either side of the current window a code is still accepted. */
const SKEW_STEPS = 1;

export function getAccountDeleteSigningKey(): string {
  const explicit = process.env.ACCOUNT_DELETE_SIGNING_KEY?.trim();
  if (explicit) return explicit;
  return (
    process.env.SUPABASE_WEBHOOK_SECRET?.trim() || process.env.CRON_SECRET?.trim() || ''
  );
}

export function isAccountDeleteCodeConfigured(): boolean {
  return getAccountDeleteSigningKey().length > 0;
}

function codeForStep(userId: string, step: number): string {
  const key = getAccountDeleteSigningKey();
  const digest = createHmac('sha256', key).update(`${userId}:${step}`).digest();
  const value = digest.readUInt32BE(0) % 1_000_000;
  return String(value).padStart(6, '0');
}

export function generateAccountDeleteCode(userId: string, now = Date.now()): string {
  return codeForStep(userId, Math.floor(now / STEP_MS));
}

export function verifyAccountDeleteCode(
  userId: string,
  code: string,
  now = Date.now()
): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const currentStep = Math.floor(now / STEP_MS);
  for (let offset = -SKEW_STEPS; offset <= SKEW_STEPS; offset += 1) {
    const expected = codeForStep(userId, currentStep + offset);
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(code, 'utf8');
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}