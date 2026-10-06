import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { sendWelcomeEmail } from '@/lib/email/send';
import { sendPushToUser } from '@/lib/push/send';

/**
 * Supabase database webhook receiver.
 *
 * Chosen over sending from the browser so delivery does not depend on the tab
 * staying open: a user can close the tab the instant they sign up and the mail
 * still goes out. Every trigger is therefore server-side.
 *
 * ## Configure in Supabase
 *   Database -> Webhooks -> create, one per table:
 *     auth.users      INSERT   -> POST {APP_URL}/api/webhooks/supabase
 *     subscriptions   INSERT   -> POST {APP_URL}/api/webhooks/supabase
 *   The "Send HTTP request" body is the row; `type` and `table` identify it.
 *
 * ## Auth
 * Supabase cannot sign its own webhook, so this relies on a shared secret the
 * operator sets (SUPABASE_WEBHOOK_SECRET) and sends in the `x-webhook-secret`
 * header. A constant-time compare, so the endpoint cannot be used as an oracle.
 *
 * ## Retries
 * Supabase retries a non-2xx response. That is deliberate: a 500 asks for a
 * retry, whereas a 200 would tell it the message was handled. Email failures
 * inside the handler are reported as 200 anyway, because retrying will not fix a
 * rejected address and would loop forever.
 */

function verifySecret(request: Request): boolean {
  const expected = process.env.SUPABASE_WEBHOOK_SECRET?.trim();
  if (!expected) {
    // Fail closed. Without a secret the endpoint would accept a POST from anyone
    // who guessed the path and could be used to send mail to arbitrary addresses.
    logger.error('[webhook] SUPABASE_WEBHOOK_SECRET is not set — rejecting all webhooks');
    return false;
  }

  const provided = request.headers.get('x-webhook-secret') ?? '';
  if (provided.length !== expected.length) return false;

  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function POST(request: Request) {
  if (!verifySecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const type = typeof payload.type === 'string' ? payload.type : '';
  const table = typeof payload.table === 'string' ? payload.table : '';

  try {
    if (table === 'users' || type === 'INSERT:auth.users') {
      return await handleSignUp(payload.record as UserInsertRecord);
    }

    if (table === 'subscriptions' || type === 'INSERT:public.subscriptions') {
      return await handleSubscriptionCreated(payload.record as SubscriptionRowPayload);
    }

    logger.warn('[webhook] unrecognised webhook payload', { type, table });
    // 200: an unknown payload is not ours to retry.
    return NextResponse.json({ ok: true, skipped: true });
  } catch (err) {
    // 500 so Supabase retries: this is a transient failure (DB down, etc).
    logger.error('[webhook] handler threw', {
      table,
      type,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }
}

interface UserInsertRecord {
  id?: string;
  email?: string | null;
  raw_user_meta_data?: { full_name?: string | null } | null;
}

async function handleSignUp(record: UserInsertRecord | undefined) {
  const email = record?.email?.trim();
  if (!email) {
    logger.warn('[webhook] sign-up had no email address');
    return NextResponse.json({ ok: true, skipped: true });
  }

  const firstName = record?.raw_user_meta_data?.full_name?.split(' ')[0] ?? null;
  const result = await sendWelcomeEmail(email, firstName);

  return NextResponse.json({ ok: true, email: result.skipped ? 'skipped' : result.ok });
}

interface SubscriptionRowPayload {
  id?: string;
  user_id?: string;
  name?: string;
  price?: number | string;
  currency?: string | null;
  billing_cycle?: string | null;
  next_billing_date?: string;
}

/**
 * A subscription was created: push, never email.
 *
 * This used to send an email per subscription created. On the Resend free tier
 * that is the single most expensive thing in the app — a user adding twelve
 * subscriptions spends twelve of their monthly emails before any renewal is
 * actually due, and none of it is mail they asked for. The confirmation still
 * happens (the row is saved and the UI toasts), it just does not cost an email.
 */
async function handleSubscriptionCreated(record: SubscriptionRowPayload | undefined) {
  if (!record?.id || !record.user_id) {
    logger.warn('[webhook] subscription payload missing id or user_id');
    return NextResponse.json({ ok: true, skipped: true });
  }

  const name = record.name ?? 'Your subscription';
  const price = toNumber(record.price);
  const currency = record.currency ?? 'USD';

  const result = await sendPushToUser(record.user_id, {
    title: 'Subscription added',
    body: `${name} — ${formatAmount(price, currency)} ${cycleLabel(record.billing_cycle ?? undefined)}`,
    url: `/subscriptions?highlight=${record.id}&detail=true`,
    // One notification per subscription rather than a single shared tag, so
    // adding three at once does not leave only the last one visible.
    tag: `sub-created-${record.id}`,
  });

  return NextResponse.json({ ok: true, push: result.skipped ? 'skipped' : result.sent });
}

function cycleLabel(cycle: string | undefined): string {
  switch ((cycle || '').toLowerCase()) {
    case 'yearly':
    case 'annual':
      return 'a year';
    case 'weekly':
      return 'a week';
    case 'quarterly':
      return 'a quarter';
    case 'monthly':
    default:
      return 'a month';
  }
}

function formatAmount(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

function toNumber(value: number | string | undefined): number {
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}