import 'server-only';

import { Resend } from 'resend';
import { logger } from '@/lib/logger';
import { renderWelcomeEmail, renderSubscriptionCreatedEmail, renderRenewalReminderEmail, renderAccountDeleteCodeEmail } from './templates';
import { SIGN_IN_URL } from './layout';
import type { EmailKind, SubscriptionEmailData } from './types';

/**
 * Transactional email sender.
 *
 * Server-only by construction. `import 'server-only'` makes an accidental import
 * from a client component a build error rather than a runtime leak of the API
 * key into the browser bundle.
 *
 * ## Why this file never throws
 *
 * Email is a side effect on someone else's inbox, not part of the request the
 * user is waiting for. A user creating their first subscription must not see
 * "Save Error" because Resend was slow or rate-limited. Every failure is logged
 * and swallowed, and the caller's own operation continues. The one thing that is
 * not acceptable is failing silently with no record, which is why every branch
 * here logs.
 */

const FROM_DOMAIN = process.env.EMAIL_FROM_DOMAIN || 'subhalt.xyz';
const FROM_ADDRESS = process.env.EMAIL_FROM || `SubHalt <no-reply@${FROM_DOMAIN}>`;

/**
 * Resolved lazily so a missing key cannot break a build or a route that merely
 * imports this module.
 */
function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  return new Resend(key);
}

export interface SendResult {
  ok: boolean;
  /** True when RESEND_API_KEY is unset and the send was skipped. */
  skipped?: boolean;
  id?: string;
  error?: string;
}

async function deliver(to: string, subject: string, html: string): Promise<SendResult> {
  const client = getClient();

  if (!client) {
    // Not an error: the pipeline has to be inert on a machine without keys (local
    // dev, a preview deploy) without spamming logs on every trigger.
    logger.warn('[email] RESEND_API_KEY not set — email skipped', { to, subject });
    return { ok: false, skipped: true, error: 'RESEND_API_KEY not set' };
  }

  if (!to.includes('@')) {
    logger.warn('[email] refusing to send to an invalid address', { to, subject });
    return { ok: false, error: 'Invalid recipient address' };
  }

  try {
    const { data, error } = await client.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
    });

    if (error) {
      logger.error('[email] Resend rejected the message', { to, subject, message: error.message });
      return { ok: false, error: error.message };
    }

    logger.info('[email] sent', { to, subject, id: data?.id });
    return { ok: true, id: data?.id };
  } catch (err) {
    // Network failure, timeout, invalid API key. Still must not propagate.
    logger.error('[email] send threw', {
      to,
      subject,
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function sendWelcomeEmail(to: string, firstName?: string | null): Promise<SendResult> {
  const { subject, html } = renderWelcomeEmail({ firstName, loginUrl: SIGN_IN_URL });
  return deliver(to, subject, html);
}

export function sendSubscriptionCreatedEmail(
  to: string,
  sub: SubscriptionEmailData
): Promise<SendResult> {
  const { subject, html } = renderSubscriptionCreatedEmail(sub);
  return deliver(to, subject, html);
}

export function sendRenewalReminderEmail(
  to: string,
  sub: SubscriptionEmailData
): Promise<SendResult> {
  const { subject, html } = renderRenewalReminderEmail(sub);
  return deliver(to, subject, html);
}

export function sendAccountDeleteCodeEmail(to: string, code: string): Promise<SendResult> {
  const { subject, html } = renderAccountDeleteCodeEmail(code);
  return deliver(to, subject, html);
}

export const EMAIL_KINDS: EmailKind[] = [
  'welcome',
  'subscription_created',
  'renewal_reminder',
  'account_delete_code',
];