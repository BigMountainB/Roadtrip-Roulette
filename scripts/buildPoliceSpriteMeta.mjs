#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
// buildPoliceSpriteMeta — measures every police sprite frame (jurisdiction
// sets, generic police, SWAT) and emits src/data/policeSpriteMeta.json:
//
//   { "<textureKey>": {
//       w, h,                    // canvas px
//       cx0, cy0, cx1, cy1,      // content (alpha>8) bounding box, 0-1 of canvas
//       lb: { x, y, w, h, n } | null   // lightbar lens cluster, 0-1 of canvas
//   } }
//
// The renderer uses content bounds for stable vehicle sizing + bottom-center
// seating (canvas size is NOT vehicle size — the exports don't share one
// padding convention), and `lb` to anchor the red/blue flash on the actual
// lightbar lenses per frame.  Lightbar detection: saturated red/blue pixels
// in the TOP 45% of the car's content box (lenses are the only strongly
// red/blue pixels up there in every set — bodies are white/black/silver/tan).
// Re-run after any art re-export:  node scripts/buildPoliceSpriteMeta.mjs
// ─────────────────────────────────────────────────────────────────────────
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT  = path.join(ROOT, 'src/data/policeSpriteMeta.js');

const JUR_DIR = 'public/assets/cars/jurisdictions';
const PREFIXES = ['seattle_police','bellevue_police','snoqualmie_police','wsp',
  'kittitas_sheriff','ellensburg_police','adams_sheriff','othello_police','pullman_police'];
const ANGLES = ['000','007','012','030','060','090','120','150','180'];

const files = [];
for (const p of PREFIXES) for (const a of ANGLES) {
  files.push({ key: `jur_${p}_${a}`, file: `${JUR_DIR}/${p}_spin_${a}.png` });
}
// Generic police + SWAT (mixed canvas conventions — measured the same way).
const GENERIC = {
  car_back_police:          'public/assets/cars/car_back_police.png',
  car_front_police:         'public/assets/cars/car_front_police.png',
  car_back_police_turn_007: 'public/assets/cars/car_back_police_turn_007.png',
  car_back_police_turn_012: 'public/assets/cars/car_back_police_turn_012.png',
  car_back_police_spin_030: 'public/assets/cars/car_back_police_spin_030.png',
  car_back_police_spin_060: 'public/assets/cars/car_back_police_spin_060.png',
  car_back_swat_rendered:   'public/assets/cars/car_back_swat_rendered.png',
  car_front_swat_rendered:  'public/assets/cars/car_front_swat_rendered.png',
  car_back_swat_turn_007:   'public/assets/cars/car_back_swat_turn_007.png',
  car_back_swat_turn_012:   'public/assets/cars/car_back_swat_turn_012.png',
  car_back_swat_spin_030:   'public/assets/cars/car_back_swat_spin_030.png',
  car_back_swat_spin_060:   'public/assets/cars/car_back_swat_spin_060.png',
  car_back_swat_spin_090:   'public/assets/cars/car_back_swat_spin_090.png',
  // Legacy pair kept as fallbacks — measured so the resolver can seat them too.
  car_back_swat:            'public/assets/cars/car_back_swat.png',
  car_front_swat:           'public/assets/cars/car_front_swat.png',
};
for (const [key, file] of Object.entries(GENERIC)) files.push({ key, file });

const meta = {};
for (const { key, file } of files) {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) { console.warn('MISSING', file); continue; }
  const { data, info } = await sharp(abs).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * 4 + 3] > 8) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) { console.warn('EMPTY', file); continue; }
  // Lightbar lens scan — saturated red/blue pixels in the top 40% of the
  // content box, then reduced to the TOPMOST band: the roof bar is always
  // the highest red/blue on the vehicle, and without the banding step the
  // taillights (also red) merge into the cluster and drag it down the car.
  const lensTop = y0, lensBot = y0 + (y1 - y0) * 0.40;
  const px = [];
  for (let y = lensTop; y < lensBot; y++) for (let x = x0; x <= x1; x++) {
    const i = (y * W + x) * 4;
    if (data[i + 3] < 128) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const isRed  = r > 120 && r > g * 1.9 && r > b * 1.9;
    const isBlue = b > 110 && b > r * 1.7 && b > g * 1.5;
    if (isRed || isBlue) px.push([x, y, isRed ? 'r' : 'b']);
  }
  const rnd = v => Math.round(v * 10000) / 10000;
  const boxOf = (pts) => {
    if (!pts.length) return null;
    let bx0 = W, by0 = H, bx1 = -1, by1 = -1;
    for (const [x, y] of pts) {
      if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
      if (y < by0) by0 = y; if (y > by1) by1 = y;
    }
    return { x: rnd(((bx0 + bx1) / 2) / W), y: rnd(((by0 + by1) / 2) / H),
             w: rnd((bx1 - bx0 + 1) / W),   h: rnd((by1 - by0 + 1) / H), n: pts.length };
  };
  let lb = null, lbR = null, lbB = null;
  if (px.length) {
    const minY = Math.min(...px.map(p => p[1]));
    const band = minY + (y1 - y0) * 0.07;          // bar ≈ ≤7% of content height
    const inBand = px.filter(p => p[1] <= band);
    if (inBand.length >= 12) {
      lb  = boxOf(inBand);
      // Per-color lens boxes — which side is red vs blue VARIES BY AGENCY
      // (Seattle: blue-left/red-right; Pullman the reverse), so the flash
      // overlay reads each side's true color from here instead of assuming.
      lbR = boxOf(inBand.filter(p => p[2] === 'r'));
      lbB = boxOf(inBand.filter(p => p[2] === 'b'));
      if (lbR && lbR.n < 8) lbR = null;
      if (lbB && lbB.n < 8) lbB = null;
    }
  }
  meta[key] = {
    w: W, h: H,
    cx0: rnd(x0 / W), cy0: rnd(y0 / H), cx1: rnd((x1 + 1) / W), cy1: rnd((y1 + 1) / H),
    lb, lbR, lbB,
  };
}
// ── Sibling fallback for dark/unlit lightbars ───────────────────────────
// Snoqualmie + Adams (and Othello's front) run blacked-out low-profile bars
// with no colored lenses, so the scan finds nothing.  Every jurisdiction
// SUV is the same Explorer body in the same pose, so remap the bar box
// from a sibling set's matching angle through both frames' content boxes.
const SUV_REFS = ['wsp', 'kittitas_sheriff', 'bellevue_police', 'pullman_police', 'othello_police'];
const SEDAN_REFS = ['seattle_police', 'ellensburg_police'];
const CLASS = { seattle_police: 'sedan', ellensburg_police: 'sedan' };  // default: suv
for (const p of PREFIXES) for (const a of ANGLES) {
  const k = `jur_${p}_${a}`;
  const f = meta[k];
  if (!f || f.lb) continue;
  const refs = (CLASS[p] === 'sedan' ? SEDAN_REFS : SUV_REFS).filter(r => r !== p);
  for (const r of refs) {
    const rf = meta[`jur_${r}_${a}`];
    if (!rf?.lb) continue;
    const sx = (f.cx1 - f.cx0) / (rf.cx1 - rf.cx0);
    const sy = (f.cy1 - f.cy0) / (rf.cy1 - rf.cy0);
    const rnd = v => Math.round(v * 10000) / 10000;
    const remap = (box) => box && ({
      x: rnd(f.cx0 + (box.x - rf.cx0) * sx),
      y: rnd(f.cy0 + (box.y - rf.cy0) * sy),
      w: rnd(box.w * sx), h: rnd(box.h * sy),
      n: box.n, dark: 1,   // dark:1 → unlit bar; renderer keeps the off-state dim
    });
    f.lb = remap(rf.lb);
    // Per-color sides come from a DIFFERENT department's bar — don't carry
    // them over; the renderer's whole-bar alternation covers dark bars.
    f.lbR = null; f.lbB = null;
    break;
  }
  if (!f.lb) console.warn('still no lightbar for', k);
}
fs.writeFileSync(OUT,
  '// GENERATED by scripts/buildPoliceSpriteMeta.mjs — do not hand-edit.\n'
  + '// Per-frame content bounds + lightbar lens anchors for every police\n'
  + '// sprite (normalized 0-1 of canvas).  Re-run the script after any\n'
  + '// police art re-export.\n'
  + 'export default ' + JSON.stringify(meta, null, 1) + ';\n');
console.log('wrote', OUT, Object.keys(meta).length, 'frames');
