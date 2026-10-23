# WhatsApp Integration Plan — SubHalt

Written 2026-10-19. Companion to `SUBHALT-FEATURES.md` (which lists what the app
has today and records WhatsApp/SMS as a deliberate gap).

---

## 1. Verdict

**Yes, we can integrate it, and it is worth it.** It is the only notification
channel that solves the iOS push problem: WhatsApp delivers to any phone with
no install and no OS notification permission, while web push on iOS only fires
for subscriptions created from an installed Home Screen app.

**It costs nothing to integrate.** The only cost is per message sent.

---

## 2. What it costs

| Item | Cost |
| --- | --- |
| Meta Cloud API access | Free |
| Business verification | Free (but takes days — needs your business documents) |
| Message template submission and approval | Free |
| Sender number | A cheap prepaid SIM, or a business number |
| **Each message sent** | **The only real cost — Meta prices template messages per message, by market** |
| Development | No fee; a day or so of work |

Meta moved from conversation-based to per-message pricing in 2025, and has
historically included a small free monthly allowance. Check the current
Business Platform pricing page before modelling cost — do not assume a number.

**Cost control, since it is per-message:** make WhatsApp a **Plus** feature, or
cap Free at one message per renewal cycle. A free user with 3 subscriptions
getting 4 stages each is 12 messages per renewal month — that multiplies.

### The free alternative, if you want to test demand first
A `wa.me` deep link that opens WhatsApp with a prefilled message
("Hi, I want to cancel my Netflix subscription"). No API, no template approval,
no business verification, no per-message cost. The user still has to press send,
so it is not automatic — but it costs nothing to build and tells you whether
people actually want this channel before you commit to the API.

---

## 3. Why a dedicated number (and not your personal one)

The API requires a number registered as the **sender** on a WhatsApp Business
Account. Three reasons to use a separate one:

1. **Your personal WhatsApp is bound to your phone.** Using it as a business
   sender means moving it onto a WhatsApp Business App profile, and every
   customer message then lands in your personal chat list.
2. **You cannot hand it off.** A number bound to your device and account is
   stuck with you. A dedicated number can later move to a team or a business
   account you own separately.
3. **It reads better.** "SubHalt" on the contact card is better than a personal
   name when a customer gets a renewal warning.

The number does not need to be expensive — a cheap prepaid SIM with a local
number is enough. Meta does require that you can receive an **SMS or voice
call** on it to verify the number, and it must not already be registered to
another WhatsApp account.

---

## 4. What you have to do in the Meta console

1. **Meta Business Portfolio** — a business account, with your legal details
   and verification documents. This is the slow step.
2. **WhatsApp Business Account (WABA)** — created inside the portfolio.
3. **Register the number** in the WABA, and complete the SMS/voice
   verification.
4. **Create and submit message templates** — approval is required before you
   can send anything outside a 24-hour customer-service window. Rejections are
   normal on the first attempt; read the rejection reason, it is usually a
   wording or variable problem.
5. **Get your WhatsApp Business Account approved for your business category**
   (a subscription-tracking app sits under a finance/billing utility).

---

## 5. The 24-hour rule (the constraint that shapes everything)

Outside a 24-hour window opened by a user messaging you, **WhatsApp only
allows pre-approved templates**. Your reminders are unsolicited, so they must
be templates. Free-form text is not available to you for a renewal warning.

**This is why you need templates for each stage you want to send.** Suggested
set — start with one, not four:

| Stage | Channel today | Template needed? | Priority |
| --- | --- | --- | --- |
| 10 days out | Push | Yes, if you want it on WhatsApp | Low — too early to act |
| 2 days out (monthly) | Push + email | Yes | Medium |
| 1 day out | Push | Yes | **Highest — this is the one to build first** |
| 12 hours out | Push | Yes | High — the actionable "last call" |
| Weekly recap | Push | Yes, or skip on WhatsApp | Low |

**Sample template text** (variables in `{{1}}` form, as Meta requires):

> *Hi {{1}} — a quick reminder that {{2}} renews on {{3}} for {{4}}. Cancel or
> pause it in SubHalt if you don't want it to renew: {{5}}*

Keep it one idea, one link, no marketing language, and use the **utility**
category, not marketing. Marketing templates need explicit opt-in and are
reviewed more strictly; a renewal notice is a transactional utility message.

---

## 6. What we would build in the code

The good news: the reminder engine is already channel-shaped, so this is an
extension rather than a rewrite.

**New**
- `lib/whatsapp/send.ts` — Cloud API client (token handling, send, error mapping).
- `lib/whatsapp/templates.ts` — registry mapping a lead time to a template name
  and variable set.
- `app/api/whatsapp/webhook/route.ts` — delivery status callbacks
  (sent / delivered / read / failed), so the app learns the real outcome.
- `app/api/whatsapp/opt-in/route.ts` — consent capture.
- A migration adding `phone_e164`, `whatsapp_opt_in_at`, `whatsapp_opt_out_at`
  to the profile.

**Changed**
- `lib/reminders/plan.ts` — `ReminderChannel` becomes `'push' | 'email' | 'whatsapp'`.
- `lib/reminders/run-reminders.ts` — deliver the third channel; the existing
  skip reasons and the delivery ledger already generalise, and the idempotency
  key `subscription|renewal|lead|channel` gives us "no double-send" for free.
- `app/settings/page.tsx` — a WhatsApp section: phone number, opt-in toggle,
  a test message button next to the existing "Send test notification".
- `lib/contexts/user-settings-context.tsx` — surface the channel state.

**Already handled by existing machinery**
- The `reminder_deliveries` ledger — no schema change needed for idempotency.
- The Delivery Check row — WhatsApp status can slot in beside push and email.
- The skip logic — `push_disabled` becomes a per-channel equivalent.

**Consent handling (mandatory, not optional)**
- Explicit opt-in at the moment the user connects a number, with a timestamp.
- `STOP` (and `UNSUBSCRIBE`, `CANCEL`, `END`, `QUIT`) must auto-opt-out and
  stop all sends to that number. This is required by Meta and is checked.
- Opt-out must be honoured immediately — no "ignore the previous message" games.

---

## 7. Rollout plan

**Phase 0 — decide (you)**
Pick a number, start the Meta Business verification, submit **one** template
(the 1-day warning). Expect a few days for verification and template approval.

**Phase 1 — build while waiting**
Sender module, phone + consent migration, settings UI, test-message button.
Ship dark: no cron wiring, no automatic sends.

**Phase 2 — internal test**
Send to your own number, confirm template variables render, confirm the status
webhook fires.

**Phase 3 — gated rollout**
Enable for admins and Plus users first, behind a flag
(the same pattern as `NEXT_PUBLIC_BILL_PAYMENT_ENABLED`). Watch delivery and
failure rates.

**Phase 4 — generalise**
Free tier, if the per-message cost works out, capped at one message per cycle.

---

## 8. Risks to know before you commit

| Risk | Mitigation |
| --- | --- |
| Template rejected | Read the reason, reword, resubmit. Start with one template so you only iterate on one. |
| 24-hour window surprises you | Every automated message must be a template. Build the registry so a missing template is a skip, not a failure. |
| Per-message cost exceeds revenue | Plus-only, or one message per cycle on Free. Cap it in code, not by hope. |
| User's number is wrong or a landline | Validate on entry, send a test message before enabling the channel, fall back to email when WhatsApp fails. |
| Meta quality rating drops | Never message users who haven't opted in; honour STOP immediately; no promotional content in transactional templates. |
| Phone numbers are personal data | Store E.164 only, encrypt at rest like the Gmail tokens, and add a deletion path on account deletion. |

---

## 9. One-line answer

**Do the free `wa.me` link first to test demand, get the Meta account and one
template approved, then build the sender against Plus users.**
