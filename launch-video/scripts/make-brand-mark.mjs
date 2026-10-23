// Generates the SubHalt concentric-arc mark as static SVG path data.
// The real mark (public/logo_icon.png) is a fingerprint-style ring of separated
// arc segments, each rotated slightly further round than the last, with an open
// gap at the lower right filled by a "minus" badge.
const CX = 95;
const CY = 95;
const RINGS = 14;
const R_MIN = 25;
const R_STEP = 4.4;
const SW = 2.6;
const START = 0;
const START_STEP = 6.5;
const SWEEP_BASE = 148;
const SWEEP_STEP = 13;

const pt = (r, deg) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [(CX + r * Math.cos(a)).toFixed(2), (CY + r * Math.sin(a)).toFixed(2)];
};

const paths = [];
for (let i = 0; i < RINGS; i++) {
  const r = +(R_MIN + i * R_STEP).toFixed(2);
  const start = START - i * START_STEP;
  const sweep = +(SWEEP_BASE + i * SWEEP_STEP).toFixed(1);
  const [x1, y1] = pt(r, start);
  const [x2, y2] = pt(r, start - sweep);
  const large = sweep > 180 ? 1 : 0;
  paths.push(`    <path d="M${x1} ${y1} A${r} ${r} 0 ${large} 0 ${x2} ${y2}" />`);
}

const [bx, by] = pt(56, 47).map(Number);
const BR = 18;
const BAR_W = 15;
const BAR_H = 4.6;

const SVG = `<svg viewBox="0 0 200 200" fill="none" aria-hidden="true">
  <g fill="none" stroke="currentColor" stroke-width="${SW}" stroke-linecap="round">
${paths.join('\n')}
  </g>
  <circle cx="${bx}" cy="${by}" r="${BR}" fill="currentColor" />
  <rect x="${(bx - BAR_W / 2).toFixed(2)}" y="${(by - BAR_H / 2).toFixed(2)}" width="${BAR_W}" height="${BAR_H}" rx="${(BAR_H / 2).toFixed(2)}" fill="var(--mark-badge)" />
</svg>`;

process.stdout.write(SVG + '\n');