# Two Point Six — design truth (Video 1)

Design tokens for the frame workers. The posed files in `compositions/frames/` are
the user-approved compositions; this file records what they are made of. Use these
values exactly; do not redesign.

## Canvas

- 1080×1920, 30fps, pure black (#000000) ground.
- Composition ids: `tps-pile`, `tps-pile-dim`, `tps-counter`, `tps-renewals`,
  `tps-endcard` — mounted from `index.html`; each frame's registered timeline key
  uses the same id. Element ids inside a frame use the frame's `tp<n>-` prefix
  (tp1- … tp5-).

## Type

- Space Grotesk only (variable, weights 300–700), declared once in `index.html`
  (`assets/fonts/space-grotesk-var.woff2`); frames use
  `font-family: 'Space Grotesk', system-ui, sans-serif`.
- Ramp in use: hook 96/88px w600; counted numbers 168px w600; stat headline 92px
  w600; section heads 54px w600; claim/body 34–36px w500; labels 30px; lock-screen
  UI 25px / 21px; card prices 30px w600; chip/caption 17px w500 letter-spaced
  +0.08em.
- Numbers use `font-variant-numeric: tabular-nums`.

## Palette

| Token | Value | Role |
| --- | --- | --- |
| canvas | #000000 | ground |
| card | #0B0D0D | phone / lock-screen body |
| elevated | #0F1111 | notification cards, tiles |
| border | #1A1D1D | hairlines, card borders |
| text | #F5F7F6 | primary copy |
| secondary | #94A3B8 | support copy, lock-screen UI |
| muted | #C9D1D0 | kickers, dimmed support |
| teal | #14B8A6 | the way out — domain, dot marker |
| amber | #F59E0B | what's being paid — the hook number, the fourth charge |
| danger | #D9363E | the twelve ticks |

## Components (as posed)

- Lock-screen phone (F1/F2): 584×1208 rounded rect, card ground, border hairline,
  real lock-screen capture `assets/lock-screen.jpg` as the screen content (the
  carrier/status row is cropped off at the top; the capture supplies the date,
  clock, alarm pill, flashlight/camera row and home indicator — no typed clock,
  notch or home indicator), plus three Wallet-style notification cards
  (elevated ground, category label — no provider names anywhere in the film —
  price line with placeholder card digits "4821"; no source label or timestamp
  chrome) composited over it. Frame 2 adds the internal dim veil
  (rgba(0,0,0,0.24), z-index 2) above
  the three base cards and below the amber charge and its halo.
- Typeset stat stack (F2/F3): headline number in text color with the accent token
  on what matters; supporting label two lines in secondary color.
- Twelve ticks (F3): 12 tiles, danger fill, faint border.
- SubHalt surface (F4): device frame (border hairline, card ground), brand header,
  teal dot marker + claim line, nested mock recording
  (`assets/product-dashboard.mp4`) playing inside the device, MOCK CAPTURE chip
  below the device (17px, secondary).
- End card (F5): wordmark image, claim two lines (first muted, payoff in text
  color), teal hairline rule, address line with the domain in teal.

## Motion truth

- Entrances are from-state tweens (fromTo / set + to), opacity + small y only; no
  exits before the final frame; every frame holds its resolved state.
- One paused root timeline per frame, registered on `window.__timelines` under the
  composition id; deterministic (no Date.now, no Math.random).
