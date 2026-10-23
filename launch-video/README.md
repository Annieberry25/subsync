# SubHalt launch film — 30s vertical (9:16)

Rendered master: `renders/subhalt-launch-9x16.mp4` — 1080×1920, 30 fps, h264 + AAC, 30.000 s.

Written as a HyperFrames composition: one HTML file per beat, timing declared with
`data-*` attributes, motion driven by paused GSAP timelines. No React, no keyframes,
no After Effects — edit text or timing and re-render.

## Beat sheet

| # | File | Window | What happens |
|---|------|--------|--------------|
| 1 | `compositions/01-hook.html` | 0.0 – 3.4 s | "Still paying for subscriptions you forgot existed?" — masked line reveals, red glow, white flash out |
| 2 | `compositions/02-charges.html` | 3.4 – 12.0 s | Dimmed bank statement scroll, six charge chips land one by one, total counts to $267.47/mo, "$3,209.52 a year" |
| 3 | `compositions/03-dashboard.html` | 12.0 – 19.6 s | Dashboard in a device frame, slow push-in, three feature callouts crossfade |
| 4 | `compositions/04-alert.html` | 19.6 – 25.0 s | App blurred behind, renewal notification springs in, "Told **before** it renews." |
| 5 | `compositions/05-cta.html` | 25.0 – 30.0 s | Wordmark, "Never get surprise-charged again.", subhalt.xyz, fade out |
| — | `compositions/06-overlay.html` | 0.0 – 30.0 s | Film grain + vignette across the whole film |

Brand palette comes from `app/globals.css`: `#14B8A6` teal, `#D9363E` danger,
`#F5F7F6` / `#94A3B8` text, `#000` background. Type is Space Grotesk, vendored in
`assets/fonts/` so renders never depend on a CDN.

## Commands

```bash
npm run dev      # Studio preview with hot reload (localhost:3002)
npm run check    # lint + runtime + layout + motion + contrast — run after every edit
npm run render   # renders/subhalt-launch-9x16.mp4

npx hyperframes@0.8.168 snapshot --at 1.6,9.6,13.8,23.6 --no-end -o review
npx hyperframes@0.8.168 render -o renders/review.mp4 --quality draft   # fast loop
npx hyperframes@0.8.168 render -o renders/master.mp4 --quality high --docker  # reproducible
```

Requires Node ≥ 22 and FFmpeg on PATH (`npx hyperframes doctor` checks this).

## Swapping in the real footage

Both clips are placeholders right now — generated mocks of your own UI so the film
renders today. Drop real recordings in with the **same filenames and durations** and
nothing else changes:

| File | Duration needed | What to record |
|------|-----------------|----------------|
| `assets/bank-statement.mp4` | ≥ 8.6 s, 1080×1920 | Your bank / card app scrolling, or a real statement export PDF |
| `assets/product-dashboard.mp4` | ≥ 9.4 s (16 s recommended) | `/subscriptions` → scroll → `/renewals` → open a renewal |

```bash
npm i -D playwright
$env:SUBHALT_URL="https://your-deploy.com"; $env:SUBHALT_EMAIL="..."; $env:SUBHALT_PASSWORD="..."
node scripts/capture-real-recordings.mjs
```

Scene 2 dims and desaturates its clip via CSS `filter`, so raw screen footage needs no
pre-processing. Scene 4 reuses the same dashboard clip from `data-media-start="4"` with
a heavy blur — cut point is the `data-media-start` value.

## Swapping the music

`assets/music.m4a` is a generated placeholder bed (120 BPM, deterministic synth —
`scripts/make-placeholder-music.mjs`). Replace it with any licensed track and keep the
filename:

```bash
ffmpeg -i your-track.mp3 -c:a aac -b:a 160k -movflags +faststart assets/music.m4a
npx hyperframes beats assets/music.m4a          # find the drop, then move scene boundaries
```

For a trending TikTok/Shorts sound you must use the platform's own licensed library —
upload the rendered MP4 to the app and attach the sound there, or use a Commercial Music
Library track. Volume and tail are controlled by `data-volume="0.8"` and
`data-fade-out="1.2"` on the `<audio>` clip in `index.html`.

## Editing copy or timing

Text lives in the scene files. To retime, move the `data-start` on the scene host in
`index.html` — scene length comes from its GSAP timeline, not from `data-duration`, so
the last `tl.set(..., T)` in each scene's script is what pins the cut.

Copy variants without touching HTML:

```bash
npx hyperframes@0.8.168 render -o renders/v2.mp4 --variables '{"headline":"..."}'
```

(Requires `data-composition-variables` declarations on the root — see
`npx hyperframes docs compositions`.)

## Other aspect ratios

The composition is authored 9:16 only. For 16:9 or 1:1, change `data-width` /
`data-height` on the root in `index.html` and on each scene root, then reposition the
absolute blocks — vertical layouts do not reflow on their own. Re-scaffold with
`npx hyperframes init <dir> --resolution landscape` and port the scenes.

## Layout rules that matter here

- Timed elements need `data-start` + `data-duration` and `class="clip"`.
- `data-track-index` is a Studio display lane only — paint order comes from CSS
  `z-index` on the scene hosts in `index.html`.
- Never call `video.play()`, never hide clips by script: the runtime owns playback and
  mounting from the attributes.
- No `Date.now()`, no unseeded `Math.random()`, no infinite timelines — the renderer
  seeks frame by frame and must be reproducible.