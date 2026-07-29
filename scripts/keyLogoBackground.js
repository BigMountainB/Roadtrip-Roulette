/**
 * keyLogoBackground.js — knock the flat backdrop out of a supplied logo PNG.
 *
 * Brand logos are delivered opaque on a near-white sweep.  That reads fine on
 * the white landing placard but breaks the moment a logo is composited over a
 * storefront photo, where it shows up as a white rectangle.  Every pre-existing
 * logo in assets/businesses/ carries alpha; this brings new art in line.
 *
 * FLOOD FILL FROM THE BORDER, not a global colour key.  These logos have cream
 * and silver letter faces (measured: 240,228,216 and 187,187,188) close enough
 * to the 252 backdrop that a global "remove near-white" pass eats the type.
 * Filling inward from the edges only removes backdrop actually connected to the
 * border; anything enclosed by the dark metal outlines survives regardless of
 * how bright it is.
 *
 * Usage:  node scripts/keyLogoBackground.js <in.png> <out.png> [threshold]
 */

import sharp from 'sharp';

const [, , IN, OUT, THRESH_ARG] = process.argv;
if (!IN || !OUT) {
  console.error('usage: node scripts/keyLogoBackground.js <in.png> <out.png> [threshold]');
  process.exit(1);
}
// Min channel value for "backdrop".  244 sits above the 240 cream letter face
// and below the 251-253 sweep.  Neutrality guard rejects saturated pixels.
const THRESH = Number(THRESH_ARG ?? 244);
const NEUTRAL = 8;   // max channel spread still considered grey

const { data, info } = await sharp(IN).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;

const isBackdrop = (i) => {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  const mn = Math.min(r, g, b), mx = Math.max(r, g, b);
  return mn >= THRESH && (mx - mn) <= NEUTRAL;
};

// Iterative flood so a 2M-pixel image can't blow the call stack.
const seen = new Uint8Array(W * H);
const stack = [];
for (let x = 0; x < W; x++) { stack.push(x, 0, x, H - 1); }
for (let y = 0; y < H; y++) { stack.push(0, y, W - 1, y); }

let removed = 0;
while (stack.length) {
  const y = stack.pop(), x = stack.pop();
  if (x < 0 || y < 0 || x >= W || y >= H) continue;
  const p = y * W + x;
  if (seen[p]) continue;
  const i = p * C;
  if (!isBackdrop(i)) continue;
  seen[p] = 1;
  data[i + 3] = 0;
  removed++;
  stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
}

// Feather: a pixel still opaque but touching a keyed neighbour gets partial
// alpha, so the cut edge isn't a hard 1px staircase against the storefront.
const alphaCopy = new Uint8Array(W * H);
for (let p = 0; p < W * H; p++) alphaCopy[p] = data[p * C + 3];
for (let y = 1; y < H - 1; y++) {
  for (let x = 1; x < W - 1; x++) {
    const p = y * W + x;
    if (alphaCopy[p] === 0) continue;
    let keyed = 0;
    for (const q of [p - 1, p + 1, p - W, p + W]) if (alphaCopy[q] === 0) keyed++;
    if (keyed) data[p * C + 3] = Math.round(255 * (1 - keyed / 6));
  }
}

await sharp(data, { raw: { width: W, height: H, channels: C } }).png().toFile(OUT);
const pct = ((removed / (W * H)) * 100).toFixed(1);
console.log(`${OUT}  ${W}x${H}  backdrop removed: ${pct}%`);
