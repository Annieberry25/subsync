---
workflow: product-launch-video
flow: automation
storyboard: yes
message: "You're paying for 2.6 subscriptions you don't use — SubHalt names them"
destination: tiktok-reels-shorts
aspect: 1080x1920
language: en
audience: US awareness — Sarah, 34 (TikTok / Reels / Shorts)
length: 35s
angle: loss-aversion
---

# SubHalt — launch videos

## Video 1 — "Two Point Six" (2026-10-17)

### Intent

Loss-aversion ad for SubHalt: the subscriptions you pay for and can't name. US
awareness audience (Sarah, 34) on TikTok / Reels / Shorts. 35s, vertical,
captions burned in and no narration (sound-off safe), one re-hook, exactly one
CTA. Tone: night-quiet, editorial, real — nothing glitchy, nothing that looks
generated. Sell the outcome, don't tour the product.

### Assets

- launch-video/assets/wordmark.png — real wordmark (synced from public/logo_wordmark_light.png by scripts/sync-brand.mjs) — end card.
- launch-video/assets/brandmark.png — real app mark — on-screen brand row.
- launch-video/assets/fonts/space-grotesk-var.woff2 — the app's typeface; every word is typeset in it.
- launch-video/assets/product-dashboard.mp4 — MOCK capture of SubHalt's UI; swaps 1:1 for a real recording (scripts/capture-real-recordings.mjs) — labelled stand-in only.
- Lock-screen notifications — typeset in-frame mock using real services and real prices; swaps for a real lock-screen photograph when the user supplies one.

### Customizations

- Realistic phone lock-screen mock built now with real details only (real service names, real prices, real app strings where used); clearly note it as a placeholder — it is replaced when a real screenshot arrives.
- A/B hook variant for ad testing (not in the film): "In a year, $321 leaves for things you forgot. SubHalt can name them tonight."

### Notes

- Claim guardrail: "stops the surprise charge" — the app warns, routes and tracks; it never cancels with a provider. Never "stops the charge", "cancels for you", "stops the next payment".
- Stats exact and sourced (docs/MARKETING-FEATURE-AUDIT.md §1, Self Financial 2026): 2.6 dead subscriptions, $26.79/month, ~$321/year, 59.9% have at least one completely unused subscription.
- Real assets only: no AI-generated UI, text, or logos anywhere; all text typeset in Space Grotesk.
- CTA is subhalt.xyz (the production domain).
- This project also hosts the earlier 30s launch film (root `launch-film.html`); keep it renderable with `render -c launch-film.html`.
