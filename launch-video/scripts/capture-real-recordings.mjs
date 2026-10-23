
// Records REAL SubHalt screen footage for the launch film, replacing the
// generated placeholders. Uses your installed Chrome (no browser download).
//
//   npm i -D playwright
//   $env:SUBHALT_URL="http://localhost:3000"; $env:SUBHALT_EMAIL="you@x.com"; $env:SUBHALT_PASSWORD="..."
//   node scripts/capture-real-recordings.mjs
//
// Tune the SHOTS list to match your own routes/selectors. Output lands in
// assets/capture/ and is ready to rename into assets/product-dashboard.mp4.
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import { mkdirSync, renameSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const URL_BASE = process.env.SUBHALT_URL || "http://localhost:3000";
const EMAIL = process.env.SUBHALT_EMAIL;
const PASSWORD = process.env.SUBHALT_PASSWORD;
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "assets", "capture");
mkdirSync(outDir, { recursive: true });

const SHOTS = [
  { route: "/subscriptions", hold: 3200, scroll: [0, 900, 1800] },
  { route: "/renewals", hold: 2400, scroll: [0, 700] },
  { route: "/bills", hold: 2000, scroll: [0] },
  { route: "/inbox", hold: 2200, scroll: [0] },
];

const browser = await chromium.launch({ channel: "chrome", args: ["--autoplay-policy=no-user-gesture-required"] });
const context = await browser.newContext({
  viewport: { width: 412, height: 892 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  recordVideo: { dir: outDir, size: { width: 1080, height: 1920 } },
});
const page = await context.newPage();

if (EMAIL && PASSWORD) {
  await page.goto(`${URL_BASE}/login`, { waitUntil: "domcontentloaded" });
  const email = page.locator('input[type="email"], input[name="email"]').first();
  const pass = page.locator('input[type="password"], input[name="password"]').first();
  await email.fill(EMAIL);
  await pass.fill(PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForLoadState("networkidle").catch(() => { });
}

for (const shot of SHOTS) {
  await page.goto(`${URL_BASE}${shot.route}`, { waitUntil: "domcontentloaded" }).catch(() => { });
  await page.waitForTimeout(1400);
  for (const y of shot.scroll) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: "smooth" }), y);
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(shot.hold);
}

const video = page.video();
await context.close();
const raw = await video.path();
await browser.close();

const target = join(root, "assets", "product-dashboard.mp4");
if (existsSync(target)) renameSync(target, join(outDir, "product-dashboard.placeholder.mp4"));

const trimmed = spawnSync(
  FFMPEG,
  [
    "-y",
    "-i",
    raw,
    "-vf",
    "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p",
    "-c:v",
    "libx264",
    "-crf",
    "20",
    "-movflags",
    "+faststart",
    target,
  ],
  { stdio: "inherit" }
);

rmSync(raw, { force: true });

if (trimmed.status !== 0) {
  console.log(`Raw recording kept at ${raw}`);
  console.log("ffmpeg could not encode — set FFMPEG_PATH and re-run.");
} else {
  console.log(`Wrote ${target}`);
  console.log("Preview: npx hyperframes snapshot --at 12,15 --no-end -o review");
}