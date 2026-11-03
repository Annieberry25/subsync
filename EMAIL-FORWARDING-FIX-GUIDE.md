# Email Forwarding Fix Guide — Admin Account First

This guide walks you through making email forwarding work on **one admin account** before releasing it to everyone.

## How it works (architecture)

```
User forwards a receipt to receipts+<userId>@mail.subhalt.xyz
        │
        ▼
Inbound provider (Resend Inbound / Mailgun Routes) POSTs webhook
        │
        ▼
POST /api/emails/inbound  (verifies signature/secret → parses receipt → creates subscription)
        ▲
        │
Self-test: POST /api/emails/test  (signed-in user sends a sample receipt through the same pipeline, no external mail needed)
        ▲
        │
GET /api/emails/forwarding-address  (returns the user's personal receipts+<id>@<domain> address)
```

Key files:
- `app/api/emails/forwarding-address/route.ts` — GET the user's address
- `app/api/emails/inbound/route.ts` — provider webhook
- `app/api/emails/test/route.ts` — authenticated self-test
- `lib/services/inbound-email.ts` — webhook auth + receipt parsing pipeline
- `lib/services/receipt-ingestion.ts` — address build/parse + subscription creation + quota
- `components/integrations/integrations-settings-panel.tsx` — UI card (Copy address / Send Test Receipt)

## Prerequisites already in `.env.local`

These are already set (verified):

| Var | Value | Purpose |
|-----|-------|---------|
| `INBOUND_EMAIL_DOMAIN` | `mail.subhalt.xyz` | Host of `receipts+<id>@mail.subhalt.xyz` |
| `INBOUND_WEBHOOK_SECRET` | `yoursubhalt_secretkey_xyz_0606_okay` | Shared secret for inbound webhook auth |
| `SUPABASE_SERVICE_ROLE_KEY` | set | Server-side DB access for ingestion |
| `NEXT_PUBLIC_EMAIL_FORWARDING_ENABLED` | defaults `true` | Feature is on |
| `NEXT_PUBLIC_EMAIL_FORWARDING_ADMIN_ONLY` | defaults `true` | Only admins can use it (that's what we want right now) |

No env change is needed to start.

## Step 1 — Make your account an admin

The feature flag is `adminOnly`, so your account needs `profiles.is_admin = true`.

Run this in **Supabase Dashboard → SQL Editor** (match on your email):

```sql
UPDATE public.profiles
SET is_admin = true
WHERE email = 'your-email@example.com';
```

Verify:

```sql
SELECT id, email, is_admin FROM public.profiles WHERE is_admin = true;
```

Then **sign out and sign back in** (the sidebar reads the flag once on mount).

## Step 2 — Confirm the UI shows the Email Forwarding card

1. Sign in as your admin account.
2. Go to **Settings → Integrations**.
3. You should see an **Email Forwarding** card with:
   - A read-only input showing `receipts+<uuid>@mail.subhalt.xyz`
   - A **Copy** button
   - A **Send Test Receipt** button

If the card doesn't appear:
- Confirm `is_admin = true` persisted (re-run the SELECT above).
- Hard-reload / sign out and back in.
- Confirm `NEXT_PUBLIC_EMAIL_FORWARDING_ENABLED` is not set to `false` anywhere.

## Step 3 — Run the self-test (no external mail provider needed)

Click **Send Test Receipt** on the Email Forwarding card.

This POSTs to `/api/emails/test`, which runs a sample Netflix receipt through the real pipeline (`processInboundReceiptWithSelfTest` → `ingestReceiptDraft` → creates a subscription row).

Expected results:
- **Success**: toast "Test receipt extracted and saved!" + a new inbox item "Forwarded Receipt Processed". A Netflix subscription row appears in your subscriptions.
- **503 "Email forwarding is not configured yet."**: `INBOUND_EMAIL_DOMAIN` is unset or empty. (Already set in `.env.local` — check it's loaded after a dev-server restart.)
- **403 "Email Forwarding is not available yet."**: your account is not an admin.
- **401**: session expired; sign in again.

If the self-test works, the full pipeline is functional. You can stop here for the admin account if you only want to validate the feature.

## Step 4 — Enable real email reception (external inbound provider)

For actual forwarded emails (not just the self-test), you need an inbound email provider to receive mail at `receipts+<userId>@mail.subhalt.xyz` and POST a webhook to your app.

**Option A: Resend Inbound (recommended — matches STEPS-GMAIL-INTEGRATION.md)**

1. In Resend: **Domains → Add domain → Type: Inbound** → domain `mail.subhalt.xyz`.
2. Resend gives you an MX record. Add it to your DNS provider for `mail.subhalt.xyz`.
3. In Resend: create an inbound route/webhook that POSTs multipart/form-data to:
   ```
   https://subhalt.xyz/api/emails/inbound
   ```
   Include the secret (form field `secret`, header `x-webhook-secret`, or `Authorization: Bearer`) matching `INBOUND_WEBHOOK_SECRET`.
4. Forward a real receipt to `receipts+<your-user-id>@mail.subhalt.xyz`.

**Option B: Mailgun Routes**

1. Set up a Mailgun route matching `receipts+*@mail.subhalt.xyz` → forward to `https://subhalt.xyz/api/emails/inbound`.
2. Set `MAILGUN_SIGNING_KEY` in env (the route then verifies Mailgun's HMAC-SHA256 signature instead of the shared secret).

## Step 5 — Verify real forwarded receipt

1. Forward a real receipt/invoice email to `receipts+<your-user-id>@mail.subhalt.xyz`.
2. Check the app: a new subscription draft should appear (provider name, amount, currency extracted).
3. Check the inbox for the "Forwarded Receipt Processed" item.

## Quotas that apply to the admin account

Enforced server-side in `lib/services/receipt-ingestion.ts`:

| Limit | Free | Plus/Premium (admin counts as Plus) |
|-------|------|-------------------------------------|
| Forwarded receipts/month | 0 (blocked immediately) | 100 |
| Burst per hour | 30 | 30 |
| Max subscriptions | tier cap | tier cap |

Admins bypass the plan check (`isPlusUser` returns `true` for `is_admin`), so the admin account is not blocked by the free-tier 0/month limit.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Email Forwarding card missing | Not an admin, or flag off | Run the admin UPDATE; sign out/in; confirm env flags |
| Address shows `null` / 503 | `INBOUND_EMAIL_DOMAIN` unset | Confirm `.env.local` has `INBOUND_EMAIL_DOMAIN=mail.subhalt.xyz`; restart dev server |
| Test receipt 403 | Not admin | Promote account in `profiles` table |
| Test receipt 503 "not configured" | Missing `SUPABASE_SERVICE_ROLE_KEY` or domain | Confirm both env vars are set |
| Real forwarded email never arrives | DNS/MX not pointing to provider; webhook not configured | Add MX record; create inbound route to `/api/emails/inbound` |
| Webhook returns 401 | Wrong/missing secret | Ensure provider sends `INBOUND_WEBHOOK_SECRET` |
| Receipt parsed but no subscription | Amount missing / provider unknown | Receipt text must contain a detectable amount; parser rejects $0 |

## Release to everyone (later)

When you're ready to open forwarding to all Plus users (not just admins), set in `.env.local` / production env:

```
NEXT_PUBLIC_EMAIL_FORWARDING_ADMIN_ONLY=false
```

Then rebuild/redeploy. No code change required — the flag is read at build time.
