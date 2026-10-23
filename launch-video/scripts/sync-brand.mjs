// The render/preview server is rooted at launch-video/, so it cannot serve
// assets from ../public/. This copies the brand marks out of the app's public
// folder into launch-video/assets so the composition has them locally.
//
// public/ stays the single source of truth: after changing a logo there,
// re-run `npm run sync-brand`.
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(here, '../../public');
const assetsDir = resolve(here, '../assets');

// [source relative to public/, destination in assets/]
const BRAND_ASSETS = [
  ['icons/icon-512.png', 'brandmark.png'],
  ['logo_wordmark_dark_email.png', 'wordmark.png'],
];

mkdirSync(assetsDir, { recursive: true });

let copied = 0;
for (const [from, to] of BRAND_ASSETS) {
  const src = join(publicDir, from);
  const dest = join(assetsDir, to);

  if (!existsSync(src)) {
    console.error(`missing source: ${src}`);
    process.exitCode = 1;
    continue;
  }

  const before = existsSync(dest) ? statSync(dest).mtimeMs : 0;
  copyFileSync(src, dest);
  const after = statSync(dest).mtimeMs;

  if (after !== before) copied++;
  console.log(`${from} -> assets/${to}  (${(statSync(dest).size / 1024).toFixed(1)} KB)`);
}

console.log(copied ? `synced ${copied} asset(s)` : 'already up to date');