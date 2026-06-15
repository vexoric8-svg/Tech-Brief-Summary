// Generates the PWA / apple-touch PNG icons from a small vector design.
// Pure Node — uses only built-in modules (no npm packages). Run: npm run build:icons
import { writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const iconsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');

// ---- palette (matches icon.svg) ----
const C0 = [0xc4, 0x7a, 0x4a]; // gradient start (top-left)
const C1 = [0xa8, 0x57, 0x33]; // gradient end   (bottom-right)
const INK = [0xf7, 0xf0, 0xe4]; // cream marks on terracotta
const INK_A = 0.96;
const S = 512; // design coordinate space

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;

// inside a rounded rectangle (clamp-to-inner-rect SDF)
function inRR(x, y, x0, y0, w, h, r) {
  const cx = clamp(x, x0 + r, x0 + w - r);
  const cy = clamp(y, y0 + r, y0 + h - r);
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

// the dark "ink" marks: sunrise arc + baseline + three article lines
function isInk(x, y) {
  if (inRR(x, y, 150, 250, 212, 22, 11)) return true;
  if (inRR(x, y, 150, 298, 212, 22, 11)) return true;
  if (inRR(x, y, 150, 346, 140, 22, 11)) return true;
  if (inRR(x, y, 120, 185, 272, 22, 11)) return true; // baseline
  if (y <= 196) {                                      // top-half arc
    const d = Math.hypot(x - 256, y - 196);
    if (Math.abs(d - 106) <= 11) return true;
  }
  return false;
}

function drawIcon(N, ss, fullBleed) {
  const rgba = Buffer.alloc(N * N * 4);
  const scale = S / N;
  const nn = ss * ss;
  for (let py = 0; py < N; py++) {
    for (let px = 0; px < N; px++) {
      let sumA = 0, sumR = 0, sumG = 0, sumB = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const fx = (px + (sx + 0.5) / ss) * scale;
          const fy = (py + (sy + 0.5) / ss) * scale;
          if (!fullBleed && !inRR(fx, fy, 0, 0, S, S, 112)) continue; // transparent corner
          const t = clamp((fx + fy) / (2 * (S - 1)), 0, 1);
          let r = lerp(C0[0], C1[0], t);
          let g = lerp(C0[1], C1[1], t);
          let b = lerp(C0[2], C1[2], t);
          if (isInk(fx, fy)) {
            r = INK[0] * INK_A + r * (1 - INK_A);
            g = INK[1] * INK_A + g * (1 - INK_A);
            b = INK[2] * INK_A + b * (1 - INK_A);
          }
          sumA += 1; sumR += r; sumG += g; sumB += b;
        }
      }
      const i = (py * N + px) * 4;
      const a = sumA / nn;
      rgba[i + 3] = Math.round(a * 255);
      if (sumA > 0) {
        rgba[i] = Math.round(sumR / sumA);
        rgba[i + 1] = Math.round(sumG / sumA);
        rgba[i + 2] = Math.round(sumB / sumA);
      }
    }
  }
  return rgba;
}

// ---- minimal PNG encoder ----
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(N, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA
  const stride = N * 4;
  const raw = Buffer.alloc((stride + 1) * N);
  for (let y = 0; y < N; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const outputs = [
  { name: 'icon-192.png', size: 192, fullBleed: false },
  { name: 'icon-512.png', size: 512, fullBleed: false },
  { name: 'icon-maskable-512.png', size: 512, fullBleed: true },
  { name: 'icon-180.png', size: 180, fullBleed: true }, // apple-touch (no transparency)
];

for (const { name, size, fullBleed } of outputs) {
  const rgba = drawIcon(size, 4, fullBleed);
  await writeFile(join(iconsDir, name), encodePNG(size, rgba));
  console.log('wrote', name);
}
console.log('done');
