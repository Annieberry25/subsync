import 'server-only';

import webpush from 'web-push';
import { env } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';

/**
 * Web Push sender (VAPID).
 *
 * Server-only. Everything needed to push — the private key, the endpoint list —
 * must stay off the client, so this is `server-only` and the browser half lives
 * in `lib/push/client.ts` with no access to the key material.
 *
 * ## Why this is worth the setup
 *
 * It exists to stop spending the Resend free tier. The Resend allowance is a
 * per-month email count, and renewal reminders at a 10-day lead multiply it by
 * every subscription a user holds. Push has no comparable per-message bill for
 * this volume, and the 10-day "upcoming" notice is exactly the kind of thing
 * that does not need an inbox: it is a nudge, and a phone notification is a
 * better delivery mechanism than mail.
 *
 * ## Failure handling
 *
 * Every send is best-effort and logged. A dead endpoint (the browser dropped it,
 * the subscription expired) returns 404/410 and is deleted — keeping it would
 * retry a corpse on every future send.
 */

export interface PushPayload {
  title: string;
  body: string;
  /** Absolute URL the notification opens. */
  url: string;
  /** Small badge/category hint so the client can group or style the message. */
  tag?: string;
}

interface PushRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false;

  webpush.setVapidDetails(
    // Contact address push services require. Not optional in practice: browsers
    // reject a subscription whose sender has no `mailto:` or `https:` subject.
    env.VAPID_SUBJECT || 'mailto:hello@mail.subhalt.xyz',
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY
  );
  configured = true;
  return true;
}

export function isPushConfigured(): boolean {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

/** The public key handed to the browser. Safe to expose; the private key is not. */
export function getVapidPublicKey(): string | null {
  return env.VAPID_PUBLIC_KEY || null;
}

export interface PushSendResult {
  sent: number;
  failed: number;
  removed: number;
  skipped: boolean;
}

/**
 * Pushes one payload to every live endpoint a user holds.
 *
 * A user with notifications on in three browsers gets three copies by design —
 * that is what per-device subscriptions mean, and collapsing them would leave a
 * desktop-only user with nothing.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<PushSendResult> {
  const result: PushSendResult = { sent: 0, failed: 0, removed: 0, skipped: false };

  if (!ensureConfigured()) {
    result.skipped = true;
    logger.warn('[push] VAPID keys not set — push skipped', { userId });
    return result;
  }

  let rows: PushRow[];
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId);

    if (error) throw error;
    rows = (data ?? []) as PushRow[];
  } catch (err) {
    result.skipped = true;
    logger.error('[push] could not read subscriptions', {
      userId,
      message: err instanceof Error ? err.message : String(err),
    });
    return result;
  }

  if (rows.length === 0) {
    // Nobody has granted permission. Normal, not an error.
    result.skipped = true;
    return result;
  }

  const body = JSON.stringify(payload);
  const deadEndpoints: string[] = [];

  for (const row of rows) {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        body,
        // 10 days is the default reminder horizon. Anything longer and a push
        // service that cannot reach the device drops it rather than holding it,
        // which is the correct outcome — a stale renewal nudge is noise.
        { TTL: 60 * 60 * 24 * 10 }
      );
      result.sent++;
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;

      // 404/410 mean the endpoint is gone for good. Retrying it is wasted work,
      // so it is deleted rather than left to fail on every future send.
      if (statusCode === 404 || statusCode === 410) {
        deadEndpoints.push(row.id);
        result.removed++;
        logger.info('[push] removing expired endpoint', { userId, statusCode });
        continue;
      }

      // 401/403 means the VAPID keys changed. Not per-endpoint, so the key
      // material is the thing to fix, not these rows.
      result.failed++;
      logger.warn('[push] send failed', {
        userId,
        statusCode,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (deadEndpoints.length > 0) {
    try {
      const supabase = createAdminClient();
      await supabase.from('push_subscriptions').delete().in('id', deadEndpoints);
    } catch (err) {
      logger.error('[push] could not prune expired endpoints', {
        userId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}