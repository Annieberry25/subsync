// Placeholder music bed: 30s, 120 BPM, deterministic (no Math.random).
// Usage: node scripts/make-placeholder-music.mjs
// Writes assets/music.wav, then encodes assets/music.m4a with ffmpeg
// (set FFMPEG_PATH if ffmpeg is not on PATH; WAV is still written either way).
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SR = 44100;
const DUR = 30;
const N = SR * DUR;
const L = new Float32Array(N);
const R = new Float32Array(N);
const BEAT = 0.5;

function mix(t, dur, gen, pan = 0) {
  const start = Math.max(0, Math.floor(t * SR));
  const len = Math.floor(dur * SR);
  for (let i = 0; i < len; i++) {
    const idx = start + i;
    if (idx >= N) break;
    const s = gen(i / SR);
    L[idx] += s * (1 - Math.max(0, pan));
    R[idx] += s * (1 + Math.min(0, pan));
  }
}

const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));
const sine = (f, t) => Math.sin(2 * Math.PI * f * t);

function kick(t0) {
  mix(t0, 0.42, (t) => {
    const f = 118 - 74 * Math.min(1, t / 0.07);
    return Math.sin(2 * Math.PI * f * t) * env(t, 0.002, 0.11) * 0.85;
  });
}

let seed = 20251016;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

function hat(t0, gain) {
  mix(t0, 0.06, (t) => (rand() * 2 - 1) * env(t, 0.001, 0.012) * gain, 0.12);
}

function bassNote(t0, dur, freq, gain = 0.3) {
  mix(t0, dur, (t) => (sine(freq, t) + 0.35 * sine(freq * 2, t)) * env(t, 0.008, dur * 0.42) * gain);
}

function pad(t0, dur, freqs, gain = 0.07) {
  mix(t0, dur, (t) => {
    const sum = freqs.reduce((acc, f) => acc + sine(f, t) + 0.4 * sine(f * 1.005, t), 0);
    return (sum / freqs.length) * env(t, 0.35, dur * 0.5) * gain;
  });
}

function pluck(t0, freq, gain = 0.16) {
  mix(t0, 0.3, (t) => (sine(freq, t) + 0.5 * sine(freq * 2, t) + 0.25 * sine(freq * 3, t)) * env(t, 0.004, 0.09) * gain, -0.15);
}

function riser(t0, t1) {
  mix(t0, t1 - t0, (t) => {
    const p = t / (t1 - t0);
    return (rand() * 2 - 1) * p * p * 0.22;
  });
}

const A1 = 55;
const F1 = 43.65;
const G1 = 49;
const roots = [A1, A1, F1, G1];
const arp = [440, 523.25, 659.25, 523.25];

for (let bar = 0; bar * 2 < DUR; bar++) {
  const barT = bar * 2;
  if (barT >= DUR) break;
  const root = roots[bar % roots.length];

  kick(barT);
  kick(barT + 1);
  if (bar >= 6) kick(barT + 1.75);

  for (let e = 0; e < 8; e++) {
    const ht = barT + e * 0.25;
    if (ht >= DUR) break;
    hat(ht, e % 2 === 0 ? 0.055 : 0.085);
  }

  bassNote(barT, 0.45, root, 0.34);
  bassNote(barT + 0.75, 0.35, root, 0.2);
  bassNote(barT + 1, 0.45, root, 0.32);
  if (bar >= 6) bassNote(barT + 1.75, 0.35, root, 0.2);

  if (bar % 2 === 0) pad(barT, 2, [root * 2, root * 2.378, root * 2.997], 0.075);

  if (bar >= 6 && bar < 14) {
    for (let e = 0; e < 4; e++) {
      const pt = barT + 0.25 + e * 0.5;
      if (pt >= DUR) break;
      pluck(pt, arp[(e + bar) % arp.length], 0.13);
    }
  }
}

riser(11, 12);
kick(12);
for (let b = 0; b < 6; b++) kick(24 + b * 0.5);
kick(25, 0);

let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const norm = 0.89 / (peak || 1);

const bytes = Buffer.alloc(44 + N * 4);
bytes.write("RIFF", 0);
bytes.writeUInt32LE(36 + N * 4, 4);
bytes.write("WAVE", 8);
bytes.write("fmt ", 12);
bytes.writeUInt32LE(16, 16);
bytes.writeUInt16LE(1, 20);
bytes.writeUInt16LE(2, 22);
bytes.writeUInt32LE(SR, 24);
bytes.writeUInt32LE(SR * 4, 28);
bytes.writeUInt16LE(4, 32);
bytes.writeUInt16LE(16, 34);
bytes.write("data", 36);
bytes.writeUInt32LE(N * 4, 40);

const fadeIn = Math.floor(0.05 * SR);
const fadeOut = Math.floor(1.4 * SR);
for (let i = 0; i < N; i++) {
  let g = norm;
  if (i < fadeIn) g *= i / fadeIn;
  if (i > N - fadeOut) g *= (N - i) / fadeOut;
  const l = Math.max(-1, Math.min(1, L[i] * g));
  const r = Math.max(-1, Math.min(1, R[i] * g));
  bytes.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
  bytes.writeInt16LE(Math.round(r * 32767), 44 + i * 4 + 2);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(join(root, "assets"), { recursive: true });
const wav = join(root, "assets", "music.wav");
writeFileSync(wav, bytes);

const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
const m4a = join(root, "assets", "music.m4a");
const enc = spawnSync(
  ffmpeg,
  ["-y", "-i", wav, "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", m4a],
  { stdio: "inherit" }
);

if (enc.status !== 0 || !existsSync(m4a)) {
  console.log(`Wrote ${wav}. ffmpeg encode skipped — install ffmpeg or set FFMPEG_PATH, then:`);
  console.log(`${ffmpeg} -y -i assets/music.wav -c:a aac -b:a 160k -movflags +faststart assets/music.m4a`);
} else {
  console.log(`Wrote ${wav} and ${m4a}`);
}