# SubHalt — Marketing Feature Audit & Positioning Playbook

_2026-10-17 · Companion to `docs/FEATURES.md` (the engineering audit). This document is for marketing: every product claim below was verified against the code (file paths inline so you can defend any sentence a year from now), and every market claim is sourced (links at the bottom). No generic filler._

**How to read each feature:** every section has **Why you need it** (the honest, evidence-backed reason a real person cares) and **The pitch** (marketing voice, ready to lift into landing pages, ads, emails). **Proof** tells you where the claim lives in the product.

---

## 1. The market case in one page

**The disease is not overspending. It is forgetting.**

- The average US subscriber has 3.4 active paid subscriptions and spends $35.03/month — and **59.9% admit at least one is completely unused**, averaging **2.6 dead subscriptions costing $26.79/month (~$321/year)**. (Self Financial, March 2026, n=1,272)
- **70% have been locked into a paid subscription because they forgot to cancel a free trial.** That single lapse costs $34.31 on average; for 37.8% it meant cutting back on other spending, and 21.7% had to borrow money. (Self Financial, 2026)
- **67% wanted to cancel a subscription and didn't.** Top excuse: fear of missing out. Second: forgetfulness. (Self Financial, 2026)
- It is getting worse at the edges: **50.4% of ChatGPT subscribers say they're not using it**, and 42.6% for Midjourney. The newest subscriptions are the fastest to go dark. (Self Financial, 2026)
- People don't even know the scale: consumers guess they spend **$86/month**, an itemised tally says **$219**. **89% underestimate their monthly subscription spend.** (C+R Research; West Monroe, n=2,500)
- **74% say recurring charges are easy to forget, and 72% have everything on auto-pay** — the payment never asks permission again. (C+R Research)

**Nigeria makes the same disease sharper:**

- The average Nigerian subscription-e-commerce user spends **₦4,500/month**, and the market is projected at **₦1.1 trillion ($2.4B) in 2026** with 8.2M active users. (StateGlobe, 2026)
- **Only 3.92% card penetration** — the reason local rails (Paystack, mobile money) matter more than a US bank-integration story. (Streaming Radar, 2026)
- The AI stack costs *more* here than in the US, not less: **ChatGPT Plus is ₦31,500/month (+18% vs US)**, Claude Pro +12%, Notion +25% — while streaming is cheaper (Netflix ₦6,500, Spotify ₦1,600, YouTube Premium ₦2,200). So a Nigerian's subscription list is a mix of NGN and USD charges, moving in opposite price directions. (subpriced.com, Oct 2026)
- The rotation behaviour is rational, not disloyal: Showmax shut down in April 2026 and Netflix pulled back Nollywood commissioning under naira devaluation. People *should* rotate streaming — they just need a tool that tells them when and pauses the rest. (3Vision; Streaming Radar)
- The manual "fix" is already circulating as advice: take inventory, annualise it, run a 30-day test, cancel after billing, screenshot, redirect the savings. One Lagos personal-finance piece lists a gym at ₦6,000/month = ₦72,000/year "for a facility you've visited less than your village". People are doing SubHalt's workflow by hand in a notes app. We are the automation of that workflow. (Incash, January 2026)

**No incumbent solves this for both markets:**

| | Rocket Money | Bobby | Monarch / Copilot / Simplifi | Spreadsheet | **SubHalt** |
|---|---|---|---|---|---|
| Works without a bank connection | No (US banks) | Yes | No | Yes | **Yes (Gmail read-only or forward-to-address)** |
| Local NGN payments (Paystack) | No | No | No | n/a | **Yes** |
| Nigerian billers (DISCOs etc.) | No | No | No | Manual | **27 biller integrations, 89 aliases** |
| Warns you *before* the charge | Partial | No | Partial | No | **Staged reminders + 12h second call** |
| Price | $7–14/mo Premium; keeps 35–60% of negotiated savings | Free (iOS only, manual) | $95–99/yr, US/CA only | Free | **Free tier is permanent; Plus $3.99 / 30 days, one-off** |
| Actions on your data by AI | No | No | No | No | **Yes — confirm-card actions (Plus)** |

**One-sentence positioning:** *Most apps tell you what you spent. SubHalt stops the surprise charge — for free, in your currency, without a bank login.*

---

## 2. Who this is for

**Tunde, 29, Lagos.** Earns in NGN whose buying power keeps sliding. Pays Netflix ₦6,500, Spotify ₦1,600, a ChatGPT Plus at an *above-US* price, a gym he's dodging, and a DISCO bill he can't automate anywhere else. His subscriptions run in two currencies and neither US app knows what a DISCO is. **What he needs:** everything in one place, NGN-first, with a warning before every charge and a total he can trust on a bad FX week.

**Sarah, 34, United States.** Twelve subscriptions, three she couldn't name under pressure. She's forgotten a free trial before ($34.31, and she cut back on going out that month). She tried a spreadsheet once. Rocket Money wants her bank credentials and $7–14/month; Bobby is manual and iPhone-only. **What she needs:** a free tracker that finds the dead subscriptions in her inbox and warns her two days before the next charge — not a subscription to manage subscriptions.

**The diaspora payer.** Pays their own subs in USD/GBP and family bills back home in NGN. The iROKOtv story proves this person pays reliably — 89% of its revenue came from outside Nigeria when it exited the domestic market. No mainstream tracker holds both sides of their financial life. **What she needs:** one app, many currencies, one honest total.

---

## 3. The features, and how to sell each one

### 3.1 The inventory: every subscription in one place, and nothing ever silently deleted

**What it is.** Full CRUD for subscriptions — price, currency, cycle (weekly/monthly/quarterly/yearly/custom), category, status (active/paused/canceled/trial), dates, notes — in list and card views with search, filters and four sort modes. An **Archive → Delete → Restore** lifecycle with dedicated history pages for each stage.

**Why you need it.** You cannot cancel what you can't see, and 42% of people admit they stopped using a subscription but forgot they were still paying (C+R Research). The second problem is fear: people hesitate to organise financial data in an app that might eat it. SubHalt never silently destroys anything — you can archive, delete, and *resurrect* a subscription, with its history intact. That lifecycle is the reason it's safe to try.

**The pitch.** *Your subscriptions live here. Not "manage" here — *live* here: paused ones you'll resume next season, canceled ones you might regret, trials that became charges. And nothing ever disappears. Delete it, restore it — the history is still there. An app that keeps your financial memory should have a better memory than you do.*

**Proof.** CRUD + lifecycle in the subscription services and `app/history/archive`, `app/history/deleted`, `app/history/restored`; caps enforced via `lib/constants/plan-limits.ts` (`hasReachedSubscriptionCap`).

---

### 3.2 Know before money leaves: the reminder engine

**What it is.** Automatic renewal warnings by **email and Web Push**, staged by billing cycle: **monthly charges get 2 days + 1 day; annual charges get 7 days + 1 day** — because a yearly hit deserves a week's notice, not a night's (`lib/reminders/plan.ts`). On top: a **10-day push-only heads-up** ("coming up — still worth it?") and a **12-hour "second call"** the evening before, carrying a cancel action. Delivery is keyed so **the same reminder can never double-send**. A Saturday weekly recap rounds it out. You can also set your own opt-in reminder offset and channel per subscription.

**Why you need it.** This is the whole thesis of the product: totals don't save money — *timing* does. A warning that arrives at the right moment is worth more than every chart in every finance app. The 2-day/7-day asymmetry is the kind of detail competitors don't build because they've never been on the wrong end of an annual charge.

**The pitch.** *A $35.03/month habit on autopay is a habit that never asks permission again. SubHalt gives it back a voice — two days before a monthly charge, a week before an annual one. Ten days out you get a gentle "still worth it?" push. The night before, a last call with the cancel button in it. The two things a reminder must never do? Arrive late, or arrive twice. Ours can't do either.*

**Proof.** `lib/reminders/plan.ts` (`AUTO_LEAD_MINUTES_MONTHLY`, `AUTO_LEAD_MINUTES_ANNUAL`, `UPCOMING_LEAD_MINUTES`, `SECOND_CALL_LEAD_MINUTES`); idempotent delivery keys (`subscriptionId|renewalDate|leadMinutes|channel`); Saturday recap claimed atomically via migration `020_weekly_recap_idempotency.sql`.

---

### 3.3 Discovery: the subscriptions you forgot you had

**What it is.** Two ways to find what you've forgotten: connect Gmail (read-only scope) and SubHalt scans for subscription/bill receipts, shows you candidates, and creates them in one flow — with OAuth tokens encrypted at rest (AES-256-GCM) and a background daily rescan. Or skip Gmail entirely and forward any receipt to your personal `receipts+<uuid>@` address — parsed into a draft automatically (HMAC-verified webhook, burst limits, monthly quota). Deduplication means the same receipt never creates two rows.

**Why you need it.** Manual tracking fails at step one: remembering to enter things. The average person carries 2.6 *unused* subscriptions; the discovery layer is what finds them. And the two-path design matters — the people most afraid of connecting Gmail to a finance app get the forwarding address instead. The privacy-conscious and the convenience-seeking both get an on-ramp.

**The pitch.** *You can't cancel what you can't see, and your inbox has been keeping receipts the whole time. Connect Gmail (read-only — we can look, never touch) or forward a receipt to your private SubHalt address and let the daily scan do the remembering. The average user is carrying 2.6 dead subscriptions. This is where SubHalt finds yours.*

**Proof.** Gmail connect + encrypted tokens in the Gmail services and `app/api` routes; forwarding webhook with HMAC verification; dedupe in `lib/services/receipt-discovery.ts`; Plus-gated (`hasGmailConnect`, `hasEmailForwarding` in `lib/constants/plan-limits.ts`).

---

### 3.4 A receipt becomes a tracked subscription in seconds

**What it is.** Upload a PDF, paste text, or photograph a paper receipt. A deterministic parser extracts provider, amount, date, cycle and category — **with per-field confidence scores and the evidence for each field** — and AI vision is used only to transcribe pixels, never to invent numbers. Low-confidence fields are flagged and editable before anything saves. Files are stored privately with signed links.

**Why you need it.** Bank auto-detection is the feature US apps sell, and it requires a bank login — which 96% of Nigerians can't or won't give (3.92% card penetration; and trust, not just access). Receipts are the honest alternative: everyone gets a receipt, in email, WhatsApp or paper. And the "confidence + evidence" design is a direct answer to the #1 fear about AI in finance apps: *did it make that number up?* No — every field shows where it came from.

**The pitch.** *No bank login required. Photograph the receipt — SubHalt reads it, shows you exactly which words it used for each number, and flags anything it isn't sure about before it saves. The AI never invents an amount; it only reads pixels. Your money data deserves a paper trail, so we keep one.*

**Proof.** Deterministic parser (`lib/services/receipt-parser.ts`, per-field confidence/evidence); vision transcription only; private storage with signed links; quota `maxReceiptScansPerMonth` (free 3, Plus 50).

---

### 3.5 Bills that match how Nigeria actually pays

**What it is.** A guided pay-a-bill flow: country → category → provider → amount, built for Nigerian electricity/DISCO-style billers, with a registry of **27 billers and 89 name aliases** (type "ikedc" or "ikeja disco" and it finds Ikeja Electric), verified-biller marks, regions, frequency, receipt scanning for bills, and a searchable `/bills/history` with analytics. Official payment links and cancellation steps live in a curated catalog of **34 providers**.

**Why you need it.** International trackers model "subscriptions" as Netflix and Spotify. Nobody else models *Ikeja Electric*. In Nigeria, the biggest recurring payments are DISCOs, data plans and cable — the bills a spreadsheet handles worst because they vary month to month. Track-and-pay-intent for these is a category of one.

**The pitch.** *Netflix is a subscription. So is your electricity. SubHalt speaks both languages — type your DISCO the way you say it, "ikedc", and it just works. Every biller with its official link, every payment logged, every month searchable. The first subscription tracker that knows what a DISCO is.*

**Proof.** `lib/constants/provider-registry.ts` (27 billers, 89 aliases), `lib/constants/provider-catalog.ts` (34 providers with payment/cancellation URLs), bills flow + `/bills/history`; feature-flagged.

---

### 3.6 The Inbox: one feed, zero "I'll deal with it later"

**What it is.** Every item needing a decision lands in one feed: unread, action-required, favourites, archived. Mark-all-read, deep links straight to the subscription or bill in question.

**Why you need it.** 67% of people wanted to cancel something and didn't (Self Financial). The obstacle isn't knowledge — it's the decision being scattered across email, app notifications and memory. The inbox concentrates every pending money decision in one place, and the push notifications land there too, so a 2am "ugh, later" becomes a two-tap resolution on the commute.

**The pitch.** *Somewhere between "I should cancel that" and actually cancelling it, money keeps leaving. SubHalt's inbox is where every pending decision waits for you — one place, deep-linked, never lost. Deal with all of it over one coffee.*

**Proof.** Inbox feed with filters, favourite/archive actions, deep links; push notifications route to inbox items.

---

### 3.7 Ask SubHalt — the AI that knows your actual subscriptions (headline feature)

**What it is.** A tool-calling agent, not a chatbot. It answers from **your real rows** — subscriptions, spending summaries, bill totals, insight engine — via 11 tools (`lib/ai/tools.ts`), with **live web search and citations** for external facts. No figure is hardcoded: every number in an answer comes from a tool result (`lib/ai/agent.ts`). On Plus, it can also *propose* changes — add, edit, pause, resume, cancel a subscription; log or correct a bill payment — but it **never executes a write itself**. Each proposal renders as a **confirmation card** in the chat, and only tapping Confirm (re-validated server-side against auth, plan and schema in `/api/ai/actions`) performs the change. Reads are free; conversations are saved; if AI is unavailable, a deterministic offline engine keeps the assistant useful.

**Why you need it.** Every AI finance tool on the market has the same flaw: it has never seen your data, so it gives you advice a blog post could give. Ask SubHalt answers "what's actually charging me on the 14th?" with *your* 14th — and "is Netflix still worth it in 2026?" with your renewal date and a cited comparison. This is also the feature that inverts the usual generative-AI risk: because the agent proposes and you confirm, the blast radius of a hallucination is a card you didn't tap.

**The pitch.** *Ask a chatbot about subscriptions and it guesses. Ask SubHalt and it checks — its own records, then the web, with sources. "What do I spend monthly?" gets your true normalised number, not an average. "Cancel the gym" doesn't silently cancel your gym — it fills the paperwork and holds it in front of you: one tap to confirm, done. The AI prepares, you decide. Your data is the ground truth, and it never leaves the walls of your account.*

**Proof.** `lib/ai/tools.ts` (11 tools: reads + writes), `lib/ai/agent.ts` (tool loop, max 5 rounds), `lib/ai/server.ts` (Groq transport + browser_search citations), `app/api/ai/chat/route.ts`, `app/api/ai/actions/route.ts` (confirm endpoint: auth + plan + schema re-validation), confirmation UI in `components/ai/ask-subhalt-modal.tsx`; plan gate `hasAssistantActions` (free reads, Plus actions).

---

### 3.8 Smart insights, and Cancellation Intelligence that proves the app pays for itself

**What it is.** An insights card shared with push notifications that surfaces expensive plans, upcoming renewals and expiring trials. **Cancellation Intelligence** goes further: it finds cheaper plans, links the provider's official cancellation page, books the savings you confirm (with an **8-second undo**), and the dashboard's total-savings figure accumulates as proof.

**Why you need it.** "You're overspending" is a feeling; "you saved ₦97,400 this year" is a receipt. Most apps end at awareness. This is the loop-closer: insight → decision → action → *measured* result. And it's the honest counter to the "$3.99 is another subscription" objection — one confirmed cancellation typically covers months of Plus.

**The pitch.** *SubHalt doesn't just show you the leak. It finds the cheaper plan, loads the cancellation page, remembers what you said you'd save, and keeps the receipt. Watch the saved-counter climb. Then tell us again that a subscription tracker is ironic.*

**Proof.** Insights engine + push integration; cancellation flow with 8-second undo; dashboard savings total; savings recommendation types live in `lib/types` and the dashboard components.

---

### 3.9 One honest number

**What it is.** Monthly spend normalised across every cycle (weekly ×52/12, quarterly ÷3, yearly ÷12), annualised cost, category breakdown, most expensive plan — **grouped by currency, never fake-converted** into a total that mixes ₦ and $ at a rate you didn't choose. Reporting currency is one of **exactly 30 supported codes**, NGN first.

**Why you need it.** 89% of people underestimate their subscription spend (West Monroe). The underestimate persists because summing mixed cycles and currencies is genuinely hard — a ₦6,500 subscription, a $19.99 one and a yearly one are not naturally comparable. Normalisation is the calculation that makes "the number" true. And honest grouping beats a falsely precise single total when FX moves weekly.

**The pitch.** *Your "oh, it's only ₦2,000 here and there" adds up to a real number, and SubHalt computes it properly: every cycle normalised, every currency in its lane, a true monthly and annual figure. No made-up exchange rates. No flattering rounding. Just the number you've been avoiding — which is exactly the one that changes things.*

**Proof.** Normalisation logic in the dashboard services (`monthlyEquivalent` pure helper exported from `lib/ai/tools.ts`); currency list in `lib/services/currency-service.ts` (30 codes).

---

### 3.10 High-stakes data, engineered like it

**What it is.** TOTP two-factor auth with QR enrollment and a remembered-account chooser; AES-256-GCM-encrypted Gmail tokens; row-level security on every table; constant-time secret comparisons; HMAC-verified webhooks; server-authoritative billing; account deletion gated by an emailed 6-digit HMAC code. **No bank connections anywhere — Gmail is a read-only scope, and forwarding is an alternative that requires no integration at all.**

**Why you need it.** An app that sees your receipts and payment history is a high-value target, and the person evaluating it knows that. The absence of bank-login requirements is not a missing feature — it is the security position: we can't leak what we never ask for. Everything else is built to the standard that position implies.

**The pitch.** *SubHalt never asks for your bank login. Gmail access is read-only — we can look, we can't touch — and encrypted the moment it arrives. Bank-grade protections, zero bank credentials. The safest finance app is the one with less to lose.*

**Proof.** `app/settings/authentication/setup/page.tsx` + `lib/auth/mfa.ts` (QR enrollment); AES-256-GCM token encryption; RLS migrations (21 files, 001–020 + 010b); HMAC deletion codes; rate limiting across abuse-prone routes (migration-backed `check_rate_limit`).

---

### 3.11 Free is the product; Plus is NGN-friendly

**What it is.** Free forever: 3 subscriptions, 10 bills, 3 receipt scans/month, full manual tracking, no card, no trial clock. Plus ($3.99 / 30 days): 50 subscriptions, 100 bills, 50 scans, Gmail + forwarding discovery (100/month), unlimited account links per subscription, CSV/JSON export, assistant actions. Charged in **NGN via Paystack at checkout**, purchased as a **one-off 30-day period — no auto-renew** — and cancelling keeps access until expiry.

**Why you need it.** Two deliberate inversions of the category: the free tier isn't bait (3 subscriptions genuinely covers the average paid stack of 3.4 before discovery — and discovery is the upgrade), and Plus doesn't auto-renew. An app whose entire pitch is "you forget subscriptions" that then hides a recurring charge on you would be self-refuting. We don't auto-renew because we're not trying to be the thing you forget.

**The pitch.** *Free isn't a trial — it's the product. Track three subscriptions forever, no card, no countdown. Go Plus when your list outgrows it: $3.99 for 30 days, paid your way through Paystack, one-off. We don't auto-renew. A subscription tracker that secretly bills you monthly would be a joke we refuse to be.*

**Proof.** `lib/constants/plan-limits.ts` (free 3/10/3; plus 50/100/50); `lib/constants/plus-plan.ts` ($3.99, 30 days, one-off); Paystack checkout with server-verified callback + HMAC-SHA512 webhook + reconciliation; cancel-keeps-access in the billing service.

---

### 3.12 In your pocket, on your lock screen

**What it is.** An installable PWA: web manifest, push-only service worker, mobile bottom dock, contextual FAB, safe-area handling on modern phones.

**Why you need it.** Renewal decisions happen on the lock screen, not at a desk. The push reminder is the product's sharpest edge, and a notification you can act on from the lock screen is the difference between cancelling and another year of charges.

**The pitch.** *Add SubHalt to your home screen in two taps. From then on the warnings come to you — the 10-day "still worth it?", the night-before last call with the cancel button. Your money moves on autopilot; at least let the alarm be automatic too.*

**Proof.** PWA manifest, push service worker, bottom dock/FAB components; Web Push delivery in the reminders pipeline.

---

### 3.13 Your data leaves when you do

**What it is.** CSV/JSON export and import with a preview before anything is written (Plus), JSON export of your account, local-cache wipe, telemetry toggle, and self-service account deletion with the HMAC-verified email flow.

**Why you need it.** Data-hostage design is the norm in this category — importing from a competitor is deliberately painful and exporting is behind support tickets. Being *better* at leaving is a trust feature: it says we keep you by being worth $3.99, not by holding your history.

**The pitch.** *Export everything to CSV or JSON whenever you like, bring your history in with a preview before anything changes, and delete your account without writing a support email. We'd rather earn the next 30 days than keep you by keeping your data.*

**Proof.** Export/import services with preview; account-deletion flow with emailed 6-digit HMAC code + optional churn survey; privacy controls in settings.

---

## 4. The AI assistant, sold properly

This deserves its own section because it's the only feature in the product that's genuinely new to the category, and it's easy to undersell as "chat with your finance app".

**The three jobs it does — in customer language:**

1. **"What did you actually do to my money?"** — an analyst. *"What do I spend on AI tools?"* returns a currency-grouped total from your rows: ₦31,500 ChatGPT, $20 Midjourney — actual charges, actual dates, no guessing.
2. **"Is this still worth it?"** — a researcher. *"Is my Netflix plan still competitive?"* finds current pricing and cheaper tiers on the web and returns them **with citation links** — plus your renewal date and what you actually pay.
3. **"Then do something about it."** — a clerk. *"Cancel the gym, pause Audible until December"* produces confirmation cards. You tap confirm; the server re-validates and writes through the same tables the app UI uses. No black box.

**Why "no hardcoded answers" is a marketing line, not just engineering hygiene.** Every AI answer about your money that isn't grounded in your data is, by definition, a guess. Questions like "how much do I spend on streaming?" have exactly one correct source — your records. SubHalt's answers visibly come from tool results; the sources are shown. That is auditable AI, and it's the difference between a demo and a tool you'd act on.

**Sample exchange (use verbatim in marketing):**

> **You:** What's actually costing me the most right now?
> **SubHalt:** Your biggest lines this month: ChatGPT Plus — ₦31,500 on the 3rd. Netflix Standard — ₦6,500 on the 8th. Spotify — ₦1,600 on the 12th. But the one I'd look at first is ChatGPT: it renewed 6 days ago and it's your most expensive subscription. Want me to show you cheaper AI alternatives, or set a decision reminder before the next renewal?
> **You:** Set a reminder, and compare alternatives.
> **SubHalt:** Reminder set for 2 days before the next charge (Nov 1). On alternatives: [cited comparison]. Want me to prepare a pause proposal in case you decide against it?

**The free/Plus split is deliberate:** reads and analysis are free (the assistant that knows your data should be the thing that makes you trust the app), writes are Plus (they're the labor-saving layer). One caveat for honesty: the agent requires `GROQ_API_KEY` (and optionally `GROQ_WEB_SEARCH` for cited web search) to be configured in deployment; the deterministic offline engine covers the assistant when AI is unavailable.

**Proof.** See 3.7. Tests: `lib/ai/__tests__/tools.test.ts` (14), `lib/ai/__tests__/agent.test.ts` (6).

---

## 5. Objection handling

| Objection | Answer |
|---|---|
| "I'll just use a spreadsheet." | Spreadsheets don't wake you two days before a charge, can't scan your inbox, and don't know that Showmax shut down leaving you with a subscription on a dead platform. 72% of people are on autopay — the payment stopped asking permission; SubHalt is the permission layer. |
| "Why not Rocket Money / Bobby / Monarch?" | Rocket Money needs US bank access and $7–14/month, and keeps 35–60% of negotiated savings. Bobby is manual and iOS-only. Monarch/Simplifi/Copilot are US/Canada and cost $95–99/year. SubHalt: no bank login, permanent free tier, $3.99 one-off, NGN-first, and it speaks DISCO. |
| "Is connecting Gmail safe?" | Read-only scope — we can read receipts, not your mail; tokens encrypted with AES-256-GCM; disconnect anytime. Or skip Gmail entirely and use your private forward-to address. |
| "Can the AI mess up my data?" | It can propose; it cannot execute. Every write is a confirmation card you tap, then the server re-validates before writing. Reads are free and scoped by row-level security to your account only. |
| "$3.99 is another subscription!" | It's a 30-day one-off, paid in NGN through Paystack — we deliberately don't auto-renew. And the dashboard keeps score: cancellations you confirm are measured savings. One forgotten trial ($34.31 average) covers eight months. |
| "Does it work outside the US?" | It works *specifically* outside the US: Paystack in NGN, 30 currencies, Nigerian billers, and a free tier that doesn't require a credit card — because 96% of Nigerians can't complete a card checkout in the first place. |

---

## 6. Copy bank

**Taglines / hero lines**
- Most apps tell you what you spent. SubHalt stops the surprise charge.
- You can't cancel what you can't see.
- The warning before the charge.
- Never get surprise-charged again.
- Your subscriptions, on a leash.
- Built for the 3.92%.
- Free to track. Cheap to act. Never silent.

**Push notification copy (these mirror the real reminder stages)**
- _10-day nudge (push):_ "Netflix renews in 10 days — ₦6,500. Still worth it?"
- _2-day (monthly):_ "₦6,500 leaves for Netflix in 2 days. Cancel from here."
- _7-day (annual):_ "That ₦85,000 annual charge lands in a week. Decide now, not then."
- _12h second call:_ "Last call: Netflix charges you tomorrow. One tap to cancel."
- _Weekly recap (Saturday):_ "3 renewals this week — ₦9,700 total. Two look cancelable."

**Email subjects**
- "You're paying for 2 things you haven't used this month"
- "₦9,700 renews this week — here's the lineup"
- "The $34.31 mistake 70% of people make (and how to dodge it)"

**Landing page angles (test in this order)**
1. **Fear:** "70% of people have been locked into a paid subscription by a free trial they forgot to cancel. SubHalt is the alarm that can't be ignored."
2. **Ironic-detachment:** "A subscription tracker that's free — and the paid tier deliberately doesn't auto-renew. We're not trying to be the thing you forget."
3. **Local pride:** "Netflix is ₦6,500. ChatGPT is ₦31,500 — more than Americans pay. One of them you haven't opened in 30 days. SubHalt knows which."
4. **AI-era stack:** "50% of ChatGPT subscribers aren't using it. Are you one of them, or will you find out from your bank statement?"

**AI feature ad line**
- "Every other AI has never seen your subscriptions. Ask SubHalt has. It checks, it cites, it prepares — you tap confirm."

---

## 7. Claims guardrails — what we may and may not say

**Safe (verified):**
- 30 currencies exactly; 34 providers in the curated catalog (official payment + cancellation links); 27 biller integrations with 89 aliases; 64 brand/domain mappings; 42 official provider URLs across the website/management/account maps.
- Free: 3 subscriptions, 10 bills, 3 scans. Plus: 50/100/50.
- Plus $3.99 per 30 days, one-off, no auto-renew, charged in NGN via Paystack.
- Reminder stages: monthly 2d + 1d; annual 7d + 1d; 10-day push-only nudge; 12h push-only second call; idempotent delivery.
- 11 AI tools; writes require in-chat confirmation; reads free, actions Plus.

**Do NOT say (unsupported or untrue):**
- "~664 known providers" (the docs' old number — actual code counts: 34 catalog / 27 billers / 89 aliases / 64 brand domains).
- "30+ currencies" — it is exactly 30; "30 currencies" is fine.
- "Bank-level connection" / "connects to your bank" — there is no bank integration anywhere; that's a feature, not a gap: Gmail read-only or forwarding only.
- "AI always available" — requires `GROQ_API_KEY` in deployment; there is a deterministic fallback, but don't promise AI unconditionally.
- "Free forever for everything" — free tier is permanent, but Gmail/forwarding/export/actions/insights are Plus.
- "We negotiate your bills for you" — SubHalt routes to cancellation pages and books savings you confirm; it doesn't call providers.
- "SubHalt cancels your subscriptions" / "stops the charge" — the user cancels with the provider; SubHalt warns before the charge, links the official cancellation route, then tracks what the user confirms and stops its own reminders. The app's own AI card says "This does not cancel it with the provider — cancel there too if you haven't", and ads must not contradict the product.
- "Ivory and Sand themes" — designed but not shipped; only Midnight is live.
- Any savings figure from a merged multi-currency total — currency totals are grouped, never fake-converted.

---

## 8. Sources

- Self Financial — Cost of Unused Paid Subscriptions 2026 (n=1,272): https://www.self.inc/info/cost-of-unused-paid-subscriptions/
- The Streamable — $321/year unused subscription coverage: https://thestreamable.com/money-wasted-unused-subscriptions-survey-2026
- MakeMyReceipt — Subscription spending statistics 2026 (aggregates Self Financial, C+R Research): https://www.makemyreceipt.com/reports/subscription-spending-statistics
- GCN — "$86 guessed vs $219 actual", C+R Research and West Monroe underestimate data: https://gcn.com/most-americans-guess-spend-month-subscriptions/21150/
- StateGlobe — Subscription e-commerce statistics in Nigeria 2026: https://data.stateglobe.com/nigeria/subscription-ecommerce-statistics
- Subscription Price Monitor — Nigeria price index (162 products, Oct 2026): https://subpriced.com/country/nigeria
- 3Vision — Africa Streaming Market Forecast 2026–2031: https://www.3vision.tv/news-insights/sub-saharan-africa-streaming-market-forecast-2026-2031-youtube-avod-revenue-outpaces-netflix-svod-across-the-region
- Streaming Radar — "5 Things People Get Wrong About Streaming in Africa" (3.92% card penetration; mobile money rails): https://lens.streaming-radar.com/5-things-streaming-africa
- Incash (Medium) — "The Hidden Money Drains: 7 Subscriptions You're Paying For But Never Use" (Lagos, Jan 2026): https://blog.incash.africa/the-hidden-money-drains-7-subscriptions-youre-paying-for-but-never-use-52526d8bc740
- Product facts: this repository — `docs/FEATURES.md` and the file paths cited inline above.
