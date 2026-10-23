---
format: 1080x1920
duration: 35s
message: "You're paying for 2.6 subscriptions you don't use — SubHalt names them"
arc: Hook → The pile → The number → The warning → CTA
audience: US awareness — Sarah, 34 (TikTok / Reels / Shorts)
mode: collaborative
music: none
---

# Two Point Six — Video 1

Five frames, 35s, captions-only (no narration; every word typeset in Space
Grotesk). Palette from `app/globals.css`. Stats sourced: Self Financial 2026,
n=1,272 (`docs/MARKETING-FEATURE-AUDIT.md` §1). Claim line: "stops the surprise
charge". Brief: `BRIEF.md`.

Animation contract: the time-coded shot sequences below (with their cited motion
rules) are what the frame workers build. The stills in `boards/stills/` are the
approved poses — motion is added to them, never redesigned.

## Video direction

**World.** Night, dark UI, 1080×1920. Pure black canvas; the phone lock screen and
the SubHalt surface are the only lit objects. Amber marks what's being paid; teal
marks the way out — nothing else gets color. The film is silent (captions-only):
the copy is the content and the beat.

**Pacing.** One continuous quiet beat (F1 + F2 share the same phone), then the
numbers accelerate (F3), the turn lands (F4), and the film settles into stillness
(F5). Reveals are paced across each frame — nothing front-loads, and every frame
ends resolved and still, held to its cut.

**Camera.** Locked. No punch-ins, no drift; the only motion is what changes on
screen. Frame 4 is the exception in kind, not in camera: the surface itself plays.

**Motion register.** Long power3 settles; opacity + small y (8–40px); no bouncy
overshoot, no idle breathing, no exits. Entrances are from-state tweens (fromTo /
from), one idea at a time, each landing with a beat of rest after. Amber and teal
glow only where they're already in the composition.

**Negative list.** No spinning, no particles, no chromatic effects, no camera
moves, no text scaling beyond the counted numbers, nothing that repeats across
frames as a visible template.

**Handoffs.** F1→F2 share one phone: exact geometry (left 248, top 512, 584×1208,
rotate −2.2°, scale 1) and a settled state at the cut — the dim is F2's move, not
a jump. F2→F3, F3→F4, F4→F5 are clean cuts between separate compositions.

## Frame 1: The pile (0-3s)

- act: Act 1 — The pile
- scene: Night lock screen — hook type above a phone quietly collecting charge notifications
- duration: 3s
- poster: 2
- transition_in: cut
- status: animated
- src: compositions/frames/01-pile.html
- assets: assets/fonts/space-grotesk-var.woff2 (type); assets/lock-screen.jpg — the real lock-screen capture from the owner's phone, composited under the typed charge cards (carrier/status row cropped; it supplies the date, clock and status UI)
- blueprint: kinetic-type-beats (Adapt)
- handoff_out: the phone (tp1-phone) is motionless at left 248 / top 512 / 584×1208 / rotate −2.2° / scale 1 / opacity 1; the three notification cards at opacity 1 — frame 2 continues from exactly this state

Shot sequence (3s; no narration — the copy is the beat):

- Scene 1 (0.0–0.9s): the hook builds at the upper third — "You're paying for"
  fades up first, then "2.6 subscriptions you don't use." follows with the big
  line built per-word (→ dynamic-content-sequencing), 2.6 already amber; the
  phone settles in with a short fade + rise (y +36 → 0) ending by ~0.9s and holds
  at left 248, top 512, rotate −2.2°.
- Scene 2 (0.9–2.5s): the pile accumulates — the streaming charge lands (1.1s),
  music streaming (1.5s), cloud storage (1.9s), each card dropping in from
  y −26 with a soft power3 settle (low overshoot), one at a time; "You just can't
  name them." fades up at ~2.0s.
- Scene 3 (2.5–3.0s): resolved — everything still; hold the read into the cut.

Copy (exact): "You're paying for **2.6** subscriptions you don't use." / "You just
can't name them." — 2.6 carries the one specificity number to the end of the film.

No provider is named anywhere in the film — each charge is typeset as a category
(Streaming service $15.49, Music streaming $19.99, Cloud storage $9.99, AI
assistant $20.00). No partnerships or integrations are implied, and the hook
line "you just can't name them" is literally true. Wallet-style cards with
placeholder card digits; no source label or timestamp chrome.

## Frame 2: The pile dims (3-10s)

- act: Act 1 — The pile
- scene: The screen dims; a fourth charge lands and glows amber; the 59.9% stat replaces the hook
- duration: 7s
- poster: 6
- transition_in: cut
- status: animated
- src: compositions/frames/02-pile-dim.html
- assets: identical phone composition to Frame 1 (same assets/lock-screen.jpg backdrop) — continuing element, geometry must not move across the cut
- blueprint: dataviz-countup (Adapt)
- handoff_in: the phone (tp1-phone) enters exactly as frame 1 left it — left 248 / top 512 / 584×1208 / rotate −2.2° / scale 1 / opacity 1, static; the three notification cards at opacity 1 (raise the posed 0.86); the dim veil starts at opacity 0 and does all the dimming

Shot sequence (7s; clean cut from frame 1 — the phone is already there):

- Scene 1 (0.0–1.2s): the pile dims — the veil inside the screen fades 0 → 1
  (the notification cards stay at opacity 1; the veil does the dimming); no new
  copy yet.
- Scene 2 (1.2–3.4s): the stat lands — "59.9%" counts 0 → 59.9 with its scale
  settling from 1.14 into its final size (→ counting-dynamic-scale); the two-line
  label reveals beneath it in one slow pass.
- Scene 3 (3.4–4.6s): the fourth charge — AI assistant, $20.00 — drops into the
  stack last and settles amber (→ spring-pop-entrance, low overshoot), a bounded
  amber glow blooming softly behind it (→ ambient-glow-bloom, opacity ≤ 0.5).
- Scene 4 (4.6–7.0s): resolved — hold the read; the amber card's glow only
  completes its bloom and settles; nothing else moves.

Copy (exact): "59.9% of people have at least one completely unused subscription."

The amber charge: AI assistant, $20.00 — the expensive one going dark. The fourth
charge is named by category only. sfx (later): stacked vibration buzzes.

## Frame 3: The number (10-18s)

- act: Act 2 — The number
- scene: Typeset counter — $26.79 a month, twelve monthly ticks, $321 a year
- duration: 8s
- poster: 14
- transition_in: cut
- status: animated
- src: compositions/frames/03-counter.html
- blueprint: dataviz-countup (Adapt)

Shot sequence (8s; flat typeset stack, camera locked):

- Scene 1 (0.0–2.4s): "$26.79" counts up from 0 and its scale settles from 1.12
  into the final 168px type (→ counting-dynamic-scale); "a month." fades in
  beside it as the number resolves.
- Scene 2 (2.4–5.0s): the twelve monthly ticks fill in one left-to-right
  staggered pass, one red tile per month (→ stat-bars-and-fills, growth-bar
  form) — a year of quiet charges writing itself.
- Scene 3 (5.0–7.2s): the annual total lands — "$321" counts up in the same
  register (→ counting-dynamic-scale) while "$26.79" above dims one step;
  "a year." joins.
- Scene 4 (7.2–8.0s): "Leaving quietly." fades up last; the stack resolves and
  holds to the cut.

Copy (exact): "$26.79 a month." / "$321 a year." / "Leaving quietly."

Numbers are the sourced figures for 2.6 dead subscriptions — exact, not rounded.

## Frame 4: The warning (18-28s)

- act: Act 3 — The answer
- scene: SubHalt on screen — the renewal card with its date, the route to cancel one tap away
- duration: 10s
- poster: 23
- transition_in: cut
- status: animated
- src: compositions/frames/04-renewals.html
- assets: assets/product-dashboard.mp4 (MOCK capture — a real /renewals recording swaps in 1:1); assets/brandmark.png
- blueprint: device-surface-showcase (Adapt)

Shot sequence (10s; static camera — the surface itself is the motion):

- Scene 1 (0.0–1.2s): establish — the phone surface settles in (fade + short
  rise) with the SubHalt brand header arriving first; the recording
  (`#tp4-video`) plays underneath from the first frame.
- Scene 2 (1.6–6.0s): the read assembles — the teal dot pops on first, then
  "SubHalt names them. Then it warns you before they charge again." reveals
  word-by-word in its two visual lines (→ dynamic-content-sequencing) while the
  recording keeps playing — renewals, dates, the cancellation route one tap
  away.
- Scene 3 (6.0–10.0s): resolved — the copy holds still; the surface keeps
  playing. No punch-in, no drift; the MOCK CAPTURE chip stays static below the
  phone.

Copy (exact): "SubHalt names them. Then it warns you before they charge again."

The turn: the same charges, now named and warned. The stand-in carries a visible
"MOCK CAPTURE" chip in-frame — remove it only when the real recording lands;
never publish with it.

## Frame 5: End card (28-35s)

- act: Act 3 — The answer
- scene: Wordmark on black with the claim line and the address
- duration: 7s
- poster: 31
- transition_in: cut
- status: animated
- src: compositions/frames/05-endcard.html
- assets: assets/wordmark.png (synced from public/logo_wordmark_light.png)
- blueprint: titlecard-reveal (Adapt)

Shot sequence (7s; the stillness beat — calm register, camera static, no exit
before the final frame):

- Scene 1 (0.0–0.9s): the wordmark fades in with a subtle scale settle
  (0.97 → 1) at its posed position.
- Scene 2 (0.9–2.6s): the claim assembles — "Most apps tell you what you spent."
  fades up first; the bold payoff "SubHalt stops the surprise charge." settles
  in beneath it on a slower beat.
- Scene 3 (2.6–4.4s): the hairline rule sweeps left-to-right beneath the claim
  (→ stat-bars-and-fills, progress form), then "Free to start — subhalt.xyz"
  fades up with the teal domain as the accent.
- Scene 4 (4.4–7.0s): resolved — hold the final read to the end of the film.

Copy (exact): "Most apps tell you what you spent." / "SubHalt stops the surprise
charge." / "Free to start — subhalt.xyz"

Guardrail: never "stops the charge", "cancels for you", or "stops the next
payment" — the app warns before the charge, links the official cancellation
route, and tracks what the user confirms.
