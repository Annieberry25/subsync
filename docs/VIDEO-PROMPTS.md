# SubHalt — 5 Video Marketing Prompts (v2)

_Written 2026-10-17 · Companion to `docs/MARKETING-FEATURE-AUDIT.md` (stats: §1/§8; guardrails: §7). **v2 changes:** every prompt now mandates the real brand assets (§0.1), bans AI-generated UI/text/logos (§0.2), directs a professional human edit (§0.3), adds re-hooks and hook A/B variants (§0.4) — and the end-card claim was corrected to "stops the surprise charge" because the app warns, routes and tracks but never cancels with a provider (the in-app AI card says so itself)._

**Format for all five:** 9:16 vertical · 30–40s · captions burned in (sound-off safe) · hook inside the first 3 seconds · one re-hook mid-video · exactly one CTA.

---

## 0. Ground rules — real assets or it doesn't ship

### 0.1 Asset manifest (use exactly these; never generate lookalikes)

**Brand marks** (pick per background; verify by eye):

| File | Use |
|---|---|
| `public/logo_wordmark_light.png` | wordmark for dark backgrounds — end cards |
| `public/logo_wordmark_dark_email.png` | dark wordmark for light backgrounds |
| `public/logo_white_bg.png` · `public/logo_black_bg.png` | full lockups on white/black plates |
| `public/logo_icon.png` · `public/icons/icon-192.png` · `public/icons/icon-512.png` | app icon, watermark |
| `launch-video/assets/wordmark.png` · `launch-video/assets/brandmark.png` | render-ready copies (synced via `launch-video/scripts/sync-brand.mjs`) |

**Colour system** — from `app/globals.css` (Version 2.0, Midnight theme). These and nothing else:

| Token | Hex | Use in ads |
|---|---|---|
| Background | `#000000` | film base, end cards |
| Card / section | `#0B0D0D` | UI-inset frames, lower thirds |
| Elevated surface | `#0F1111` | cards on top of cards |
| Border | `#1A1D1D` | hairlines around callouts |
| Text primary | `#F5F7F6` | captions, headlines |
| Text secondary | `#94A3B8` | caption body, meta |
| Accent (teal) | `#14B8A6` | SubHalt actions, ticks, savings |
| Warning | `#F59E0B` | "renews soon" moments |
| Danger | `#D9363E` | the charge moments — only |

**Type:** Space Grotesk everywhere (`app/globals.css` → `--font-space-grotesk`; vendored at `launch-video/assets/fonts/space-grotesk-var.woff2`). One word may take the teal; the rest stays `#F5F7F6`. No other typeface.

**Real UI footage:** record it with the project's own pipeline — `launch-video/scripts/capture-real-recordings.mjs` drives a logged-in Chrome through `/subscriptions` → `/renewals` → `/bills` → `/inbox` at 1080×1920 into `launch-video/assets/product-dashboard.mp4`. The current `product-dashboard.mp4` and `bank-statement.mp4` are **placeholders (mock UI)** — replace before publishing. Use a demo account with realistic data; never film a real person's inbox.

**Working reference:** existing master film `launch-video/renders/subhalt-launch-9x16.mp4` + beat sheet (`launch-video/README.md`). Reuse its end card behaviour ("Never get surprise-charged again.", subhalt.xyz). Landing CTA: **subhalt.xyz** (as used in the film).

### 0.2 Never let a generator draw these (the fake-UI line)

Text-to-video and image models invent UI, warp text and hallucinate logos. Hard rules:

- **UI screens, notifications, receipts, chat windows, logos, prices: real capture or typeset — never generated in-frame.**
- **All text is typeset** in Space Grotesk in the editor. AI-generated lettering is banned.
- **AI imagery at all** only for textures/fog/abstract b-roll, graded to match the real capture. Prefer licensed real stock or self-shot footage.
- If a tool "helpfully" re-renders a phone screen, cut that shot. One fake UI frame kills finance-app trust.

### 0.3 Human-edited, not AI-edited

- Cuts land on beat; hold shots 1.5–3s; one idea per shot.
- Real sound first: device vibration, notification ping, keystroke, room tone. Music is a bed, not the story. No whoosh on every cut.
- Banned clichés: glitch morphs, datamosh, morphing text, floating 3D credit cards, uncanny hands.
- Keep small imperfections: natural hand shake, real screen glare, a reflection. That's the human signal.
- Notifications on camera are **real** — trigger the app's own test push or a live reminder from a demo account and film the actual lock screen. Never typeset a fake notification over a screen.

### 0.4 Retention recipe + hook testing

0–3s hook (text-first pattern interrupt) → 40% re-hook (a new question, number or twist) → 75% payoff → ≤4s end card. Every video ships with **two hooks**; test both before scaling spend (alternates below).

---

## Video 1 — "Two Point Six"

**Angle:** Loss aversion. The subscriptions you're paying for that you can't even name.
**Audience:** Sarah (US), awareness stage. TikTok / Reels / Shorts.
**Marketing rules:** Pattern-interrupt hook · negativity bias · one specificity number carried to the end (2.6).

| Time | Visual | On-screen text |
|---|---|---|
| 0–3s | Handheld shot of a real phone at night; real charge notifications arrive one by one, unread and ignored. | **"You're paying for 2.6 subscriptions you don't use. You just can't name them."** |
| 3–10s | The screen dims under the pile; the last notification glows amber, then holds. | "59.9% of people have at least one completely unused subscription." |
| 10–18s | Typeset counter, motion-designed in the edit: $26.79 drains monthly; twelve ticks total ~$321. | "$26.79 a month. **$321 a year.** Leaving quietly." |
| 18–28s | Real capture of `/renewals` from a demo account: the renewal card with its real date, cancel route one tap away. | "SubHalt names them. Then it warns you before they charge again." |
| 28–35s | End card: real wordmark on `#000000`. | **"Most apps tell you what you spent. SubHalt stops the surprise charge."** · "Free to start — subhalt.xyz" |

**Real footage:** lock screen = real push to a real phone, filmed with a second phone (shot-of-a-phone beats a screen recording); renewal beat = `product-dashboard.mp4` capture; counter = typeset motion graphic, not AI.
**Edit & sound:** stacked vibration buzz, then near-silence; one teal tick when the app names the charge. No glitch effects.
**A/B hook (alt):** "In a year, $321 leaves for things you forgot. SubHalt can name them tonight."
**Withhold / don't say:** the feature list, discovery mechanics — and never imply it cancels anything.
**Paste prompt (b-roll + composite instructions):**
> Composite, don't generate. Open on a real handheld night shot of a phone whose lock screen collects real payment notifications (film the device; do not render a phone). One notification glows #F59E0B. Then a typeset motion counter: "$26.79/mo → $321/yr". Then a real screen-record of the SubHalt /renewals page (1080×1920, from assets/product-dashboard.mp4) with one card outlined #1A1D1D and a teal #14B8A6 action tick — do not invent any UI or text. End card: real wordmark public/logo_wordmark_light.png on #000000, typeset in Space Grotesk, line "Most apps tell you what you spent. SubHalt stops the surprise charge." Editing: hard cuts, restrained pacing, silence over music, real vibration SFX. Absolutely no glitch/morph transitions, no generated screens, no generated text.

---

## Video 2 — "You Pay More For The Same App"

**Angle:** Local price pain + pride. Nigeria pays more for AI than America — and half of it goes unused.
**Audience:** Tunde (Lagos), awareness stage. TikTok / Reels / WhatsApp status.
**Marketing rules:** Specificity sells (real NGN prices) · us-vs-them framing without victimhood · curiosity gap in the hook.

| Time | Visual | On-screen text |
|---|---|---|
| 0–3s | Split frame of real Lagos street b-roll, dimmed to near-black; two typographic price blocks rise. | **"Netflix costs less here. ChatGPT costs MORE than in America. Guess which one you forgot."** |
| 3–10s | The ₦31,500 block climbs +18%, sitting taller than the US block. | "ChatGPT Plus: ₦31,500 a month. **18% more than the US.**" |
| 10–18s | Quick cuts: abandoned chat windows, a closed tab, an expired "new chat" — real screen recordings of a demo device. | "And 50% of ChatGPT subscribers say they're not using it." |
| 18–28s | Real capture of `/subscriptions`: naira charges and dollar charges in **separate lanes**, honest totals. | "One place for everything. Naira in naira. Dollars in dollars. No fake conversions." |
| 28–36s | End card. | **"Built for Nigeria first. Try SubHalt free — no card needed."** · subhalt.xyz |

**Real footage:** price blocks = typeset with the real sourced numbers (audit §8); street b-roll = licensed real Lagos footage (no AI); app beats = real captures.
**Edit & sound:** tight 1–2s cuts on a percussive beat; naira figures land with a hard type-on; no VO needed (captions carry it).
**A/B hook (alt):** "The same ChatGPT you opened twice this month costs more here than in America."
**Withhold / don't say:** discovery mechanics, biller-registry internals — and never a merged ₦/$ total.
**Paste prompt (b-roll + composite instructions):**
> Composite, don't generate. Use licensed real Lagos street footage, graded dark/neutral as background (no AI footage, no AI city). Typeset the price story in Space Grotesk: "₦31,500 vs US" climbing +18%, Netflix "₦6,500", Spotify "₦1,600" — text is typeset, never generated in-frame. Insert real screen captures of the SubHalt subscriptions list showing naira rows and dollar rows as separate sections (from assets/product-dashboard.mp4) inside a #0B0D0D frame with #1A1D1D hairline. Accent colour #14B8A6 only on SubHalt elements; #D9363E reserved for the "more than the US" figure. Hard cuts on beat, real keystroke/tap SFX, burned-in captions. End card: wordmark + "Built for Nigeria first. Try SubHalt free — no card needed." No generated UI, no morph transitions.

---

## Video 3 — "The Last Call"

**Angle:** Product hero. Timing is the product — the warning before the charge.
**Audience:** Both markets, consideration stage. All platforms; strongest as retargeting.
**Marketing rules:** Show, don't tell · relief after tension · the rule-of-two line ("late… or twice").

| Time | Visual | On-screen text |
|---|---|---|
| 0–3s | A real phone on a bedside table, 9:47pm. One push lands — real notification: "Netflix renews tomorrow". | **"This is the message Netflix hopes you never see."** |
| 3–8s | The real notification body: "Cancel it now if you do not want to be charged again." A thumb taps it; the app opens straight to that subscription. | "The night before a charge, SubHalt makes its last call — and opens the cancel route." |
| 8–18s | Typeset calendar beats: 10-day nudge ("still worth it?"), 2-day monthly warning, 7-day annual warning. | "Ten days out: still worth it? Two days before a monthly charge. A **week** before an annual one." |
| 18–26s | Two identical notifications appear; one dissolves into a teal checkmark. | "The two things a reminder must never do: arrive late, or arrive twice. Ours can't do either." |
| 26–35s | End card on the phone screen itself. | **"The warning before the charge. Free to start — no card, no countdown."** |

**Real footage:** trigger a real reminder (or the app's test push) to a real device and film the lock screen; the deep-link open is a real capture of the app landing on that subscription (`?highlight=…&detail=true`). Pull notification strings from the live app — do not retype by hand.
**Edit & sound:** real vibration + ping; slow 500ms push-in on the notification; quiet room tone, no music until the end card.
**A/B hook (alt):** "At 9:47pm, one notification decides what happens to ₦6,500 at midnight."
**Withhold / don't say:** delivery plumbing, the recap — and never say SubHalt cancels for the user; it opens the route.
**Paste prompt (b-roll + composite instructions):**
> Composite, don't generate. Film a real phone on a nightstand with a real push notification visible ("Netflix renews tomorrow") — do not render a phone UI. Real thumb taps it; cut to a real screen-record of the app opening that subscription (assets/product-dashboard.mp4). Typeset the staged-reminder beats (10-day / 2-day / 7-day) as clean calendar cards in Space Grotesk on #0B0D0D with #1A1D1D hairlines; the teal #14B8A6 checkmark resolves the duplicate-notification beat. Warm dim room light, handheld micro-movement, real vibration SFX, silence before the end card. End card: real wordmark, "The warning before the charge. Free to start." Editorial cut only — no glitch, no morph, no generated text anywhere.

---

## Video 4 — "Your Inbox Has Receipts"

**Angle:** Discovery + trust. The forgotten subscriptions are already sitting in your email.
**Audience:** Privacy-conscious, both markets. YouTube pre-roll + Reels.
**Marketing rules:** Curiosity gap · objection pre-handling (privacy answered before it's raised) · one metaphor end-to-end ("receipts").

| Time | Visual | On-screen text |
|---|---|---|
| 0–3s | Slow scroll of a **controlled demo inbox** ("Your subscription is confirmed…", "Payment received…"), non-receipt rows blurred. | **"Your inbox has been keeping receipts on you."** |
| 3–10s | Receipts softly highlight as they pass, forming a rising counter. | "Every 'confirmed' you ever tapped. Every trial you meant to cancel. Still there." |
| 10–16s | Real capture of the connect screen: "Connect Gmail — read-only" beside "Forward to your private address". | "Connect Gmail **read-only — we can look, we can't touch** — or forward receipts to your own private address." |
| 16–24s | Real capture: the subscriptions list assembling on the demo account. | "67% of people wanted to cancel something and never did. This is where SubHalt finds yours." |
| 24–32s | A calm circular sweep motif over the real app screen. | "Then it keeps watching — quietly, daily — so remembering stops being your job." |
| 32–40s | End card. | **"The average person is carrying 2.6 dead subscriptions. Find yours."** · subhalt.xyz |

**Real footage:** demo inbox only (own the mailbox, blur everything non-receipt); connect screen and list = real captures; sweep = typeset motion graphic.
**Edit & sound:** quiet, trust-building pace; soft keystroke SFX; no dramatic tension — this video is reassurance.
**A/B hook (alt):** "Somewhere in your inbox is a receipt for a subscription you forgot. Actually — 2.6 of them."
**Withhold / don't say:** parsing internals, encryption algorithms, quotas — and never "connects to your bank".
**Paste prompt (b-roll + composite instructions):**
> Composite, don't generate. Screen-record a controlled demo inbox scrolling slowly; typeset fading highlight bars over receipt rows in #1A1D1D with #F5F7F6 text in Space Grotesk (all text typeset, none generated). Insert real captures of the SubHalt Gmail connect screen and the resulting subscriptions list (assets/product-dashboard.mp4) inside #0B0D0D frames. A calm teal #14B8A6 sweep motif crosses the app screen once. Muted palette like the app — no red, no alarm energy. Soft ambient bed, keystroke SFX. End card: wordmark + "The average person is carrying 2.6 dead subscriptions. Find yours." No generated UI or text, no morph transitions.

---

## Video 5 — "It Checks Before It Speaks"

**Angle:** The AI differentiator. Every other AI guesses about your money; this one checks — and never acts without you.
**Audience:** Both markets, decision stage. Retargeting + organic (the demo **is** the ad).
**Marketing rules:** Verbatim proof beats description (real sample exchange, audit §4) · risk-reversal ("the AI prepares, you decide") · radical honesty as a flex (show the app's own "it won't cancel for you" line).

| Time | Visual | On-screen text |
|---|---|---|
| 0–3s | Real capture: a chat bubble types… then a teal cursor blinks in empty space. | **"Every other AI guesses about your money. This one checks."** |
| 3–14s | Real recorded exchange on a demo Plus account, verbatim from the app: "What's actually costing me the most right now?" → the real answer (ChatGPT Plus ₦31,500 on the 3rd; Netflix ₦6,500 on the 8th; Spotify ₦1,600 on the 12th — "the one I'd look at first is ChatGPT: it renewed 6 days ago"). | (silent — the answer is the proof) |
| 14–24s | Second question: "Is my Netflix plan still competitive?" → cited comparison, source links visible on screen. | **"It checks its own records. Then the web. With sources."** |
| 24–34s | "Cancel the gym." The real confirm card appears — including the app's own honesty line: "This does not cancel it with the provider — cancel there too if you haven't." A thumb taps Confirm. | "It won't pretend to cancel for you. **The AI prepares. You decide.**" |
| 34–42s | End card. | **"Ask SubHalt. It checks, it cites, it prepares — you tap confirm."** · "Free to start. Plus $3.99/30 days — **no auto-renew**." · subhalt.xyz |

**Real footage:** record a real session with a live key configured (a Groq key is set locally) from a demo Plus account. Capture the actual modal and confirm card from `components/ai/ask-subhalt-modal.tsx`. Never composite a fake chat.
**Edit & sound:** real keyboard/tap SFX; type-on animation mirrors real typing speed; hold the confirm-card beat 2 extra seconds — that's the trust moment.
**A/B hook (alt):** "Ask your AI what you spend on subscriptions. Then watch it guess. This one doesn't have to."
**Withhold / don't say:** the tool architecture, provider/model names — and never "AI always available"; frame as "asks from your real subscriptions".
**Paste prompt (b-roll + composite instructions):**
> Composite, don't generate. Screen-record a real SubHalt AI session on a demo Plus account at 1080×1920 — real chat, real data, real confirm card (this is the footage; do not animate a synthetic chat). Add typeset Space Grotesk overlays on #000000: "Every other AI guesses. This one checks." and "It checks its own records. Then the web. With sources." Teal #14B8A6 for the confirm action; #D9363E nowhere in this film. If an abstract opener is needed, one whisper of dark texture only — no generated screens, no morph transitions, no synthetic lettering. Real keystroke/tap SFX, restrained bed. End card: real wordmark + "Ask SubHalt. It checks, it cites, it prepares — you tap confirm." + "Plus $3.99/30 days — no auto-renew."

---

## Global guardrails for whoever generates these

- Pull every stat from `docs/MARKETING-FEATURE-AUDIT.md` §1 and §8 — sourced; do not invent or round.
- **The claim line:** "stops the surprise charge" — never "stops the charge", "cancels subscriptions for you", or "stops the next payment". The app warns, routes to official cancellation pages, tracks what you confirm, and stops **its own** reminders once you tell it you've cancelled. Ads may not contradict the app's own screens.
- Never show or say: internal provider/alias counts, the AI tool list, encryption algorithms, "bank connection" of any kind, or a merged ₦/$ total.
- One CTA per video. Free tier is the CTA; Plus ($3.99 · 30 days · no auto-renew) is the reassurance, not the ask.
- If a shot cannot be filmed or captured for real, cut the shot — don't generate the fake.
