/**
 * One-off: crop the wordmark out of the 2000x2000 source canvases.
 *
 * The app crops these with CSS (components/ui/brand-logo.tsx), which email cannot
 * do — overflow/absolute positioning is unreliable in Outlook and unsupported in
 * parts of Gmail. Baking the crop produces a real 1103x303 asset that can be
 * referenced with plain width/height, which is what email wants.
 *
 * The box is the artwork's real bounding box, same numbers as ART.wordmark in
 * brand-logo.tsx. If the sources are re-exported with different padding these
 * need re-measuring.
 *
 * Usage: npx tsx scripts/crop-wordmarks.ts
 */
import fs from 'node:fs';
import zlib from 'node:zlib';

type Box = { x: number; y: number; width: number; height: number };

const WORDMARK: Box = { x: 359, y: 819, width: 1103, height: 303 };

function crc32(buf: Buffer): number {
  let c: number;
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** Decode an 8-bit RGBA, non-interlaced PNG to raw pixel rows. */
function decodeRgba(png: Buffer): { w: number; h: number; pixels: Buffer } {
  const w = png.readUInt32BE(16);
  const h = png.readUInt32BE(20);
  if (png[24] !== 8 || png[25] !== 6 || png[28] !== 0) {
    throw new Error('expected an 8-bit RGBA non-interlaced PNG');
  }

  const idat: Buffer[] = [];
  let off = 8;
  while (off < png.length) {
    const len = png.readUInt32BE(off);
    const type = png.toString('ascii', off + 4, off + 8);
    if (type === 'IDAT') idat.push(png.subarray(off + 8, off + 8 + len));
    off += 12 + len;
  }

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * 4;
  const out = Buffer.alloc(stride * h);

  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    const cur = out.subarray(y * stride, (y + 1) * stride);

    for (let i = 0; i < stride; i++) {
      const a = i >= 4 ? cur[i - 4] : 0;
      const b = prev[i];
      const c = i >= 4 ? prev[i - 4] : 0;
      const x = line[i];
      let v: number;
      switch (filter) {
        case 0: v = x; break;
        case 1: v = x + a; break;
        case 2: v = x + b; break;
        case 3: v = x + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: throw new Error(`unknown filter ${filter}`);
      }
      cur[i] = v & 0xff;
    }
  }
  return { w, h, pixels: out };
}

/** Encode raw RGBA rows as a PNG, using filter 0 throughout. */
function encodeRgba(w: number, h: number, pixels: Buffer): Buffer {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function crop(src: Buffer, box: Box): Buffer {
  const { w, pixels } = decodeRgba(src);
  const stride = w * 4;
  const out = Buffer.alloc(box.width * box.height * 4);
  for (let y = 0; y < box.height; y++) {
    pixels.copy(
      out,
      y * box.width * 4,
      (box.y + y) * stride + box.x * 4,
      (box.y + y) * stride + (box.x + box.width) * 4
    );
  }
  return encodeRgba(box.width, box.height, out);
}

for (const [src, dest] of [
  ['logo_black_bg.png', 'logo_wordmark_dark_email.png'],
  ['logo_white_bg.png', 'logo_wordmark_light_email.png'],
] as const) {
  const bytes = crop(fs.readFileSync(`public/${src}`), WORDMARK);
  fs.writeFileSync(`public/${dest}`, bytes);
  console.log(`${dest}: ${WORDMARK.width}x${WORDMARK.height}, ${Math.round(bytes.length / 1024)}KB`);
}