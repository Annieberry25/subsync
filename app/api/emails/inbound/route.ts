import { NextResponse } from 'next/server';
import {
  extractPayload,
  processInboundReceipt,
  verifyWebhookAuth,
  isWebhookEnabled,
} from '@/lib/services/inbound-email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Inbound email webhook. Configure your forwarding provider (Mailgun Routes /
 * Resend inbound) to POST multipart/form-data here. The forwarding address is
 * receipts+<userId>@<INBOUND_EMAIL_DOMAIN>.
 */
export async function POST(request: Request) {
  try {
    if (!(await isWebhookEnabled())) {
      return NextResponse.json({ error: 'Inbound email is not configured.' }, { status: 503 });
    }

    let payload: Record<string, string> = {};
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await request.json().catch(() => null);
      if (body && typeof body === 'object') {
        payload = Object.fromEntries(
          Object.entries(body as Record<string, unknown>).map(([key, value]) => [
            key,
            typeof value === 'string' ? value : String(value),
          ])
        );
      }
    } else {
      const form = await request.formData().catch(() => null);
      if (form) {
        for (const [key, value] of form.entries()) {
          if (/^attachment-/i.test(key)) continue;
          if (typeof value === 'string') payload[key] = value;
        }
      }
    }

    const auth = verifyWebhookAuth(payload, request.headers);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error ?? 'Unauthorized.' }, { status: 401 });
    }

    const input = extractPayload(payload);
    if (!input.recipient) {
      return NextResponse.json({ error: 'No recipient field on payload.' }, { status: 400 });
    }

    const result = await processInboundReceipt(input);

    if (result.status === 'invalid') {
      return NextResponse.json(
        {
          status: result.status,
          error: result.error,
          name: result.name,
          price: result.price,
          currency: result.currency,
        },
        { status: 422 }
      );
    }
    if (result.status === 'rate_limited') {
      return NextResponse.json(
        {
          status: result.status,
          error: result.error,
        },
        { status: 429 }
      );
    }
    if (result.status === 'not_configured') {
      return NextResponse.json({ error: result.error }, { status: 503 });
    }

    return NextResponse.json({ status: result.status, id: result.subscriptionId ?? result.inboxItemId });
  } catch (err) {
    console.error('[emails/inbound] unexpected error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}