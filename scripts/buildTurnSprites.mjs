#!/usr/bin/env node
/**
 * Normalize the rear-three-quarter turn sprites to their straight twins.
 *
 * The delivered starter_back_turn.png files share canvas DIMENSIONS with
 * starter_back.png, but the visible car inside is 8-31% smaller and floats
 * higher — so the pose swap read as the car shrinking and hopping upward
 * (owner 2026-08-09).  For each genre this script:
 *
 *   1. Measures the non-transparent bbox of both images.
 *   2. Uniform-scales the turn art by straightVisH / turnVisH — HEIGHT is the
 *      yaw-invariant landmark: at 12-15° the rear face keeps its height while
 *      total width legitimately grows with the newly visible side, so width
 *      must NOT be force-matched.
 *   3. Re-composites onto a canvas with the SAME height and bottom padding as
 *      the straight art (tire baseline parity under the sprite's (0.5, 1)
 *      origin), bbox horizontally centred (both art sets are already centred
 *      to <1 px).  Canvas WIDTH grows where the scaled car no longer fits —
 *      cropping bodywork is not an option, and the runtime sizes the sprite
 *      by pixels-per-car-unit rather than canvas width, so a wider canvas is
 *      free.
 *
 * The contract this establishes, which GameScene._applyPlayerSpriteDisplaySize
 * RELIES on: straight and turn art have IDENTICAL pixels-per-car-unit and
 * identical bottom padding.  Rendering both at the same scale factor therefore
 * keeps the rear face, tire baseline and centre visually fixed.
 *
 *   node scripts/buildTurnSprites.mjs            # preview → scratch dir
 *   node scripts/buildTurnSprites.mjs --install  # back up *_raw.png + replace
 */
import sharp from 'sharp';
import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../public/assets/culture/', import.meta.url));
const GENRES = ['hiphop_phonk','country','reggaeton','k_pop','metal','classic_rock','edm_rave','reggae','pop_punk_emo','norteno'];
const INSTALL = process.argv.includes('--install');
const OUT = INSTALL ? null : (process.env.SP ?? '/tmp') + '/turn_preview';
if (OUT) mkdirSync(OUT, { recursive: true });

async function bbox(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  let minX = W, maxX = -1, minY = H, maxY = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * 4 + 3] > 16) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  return { W, H, minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

for (const g of GENRES) {
  const dir = `${ROOT}${g}/vehicles/`;
  const straightF = dir + 'starter_back.png';
  // --install runs against the preserved raw art so it is repeatable.
  const rawF = dir + 'starter_back_turn_raw.png';
  const srcF = existsSync(rawF) ? rawF : dir + 'starter_back_turn.png';
  const A = await bbox(straightF);
  const B = await bbox(srcF);

  const scale = A.h / B.h;
  const sw = Math.round(B.w * scale), sh = Math.round(B.h * scale);
  // Same side padding as the straight art, same height, same bottom pad.
  const sidePad = A.W - A.w;
  const canW = Math.max(A.W, sw + sidePad);
  const canH = A.H;
  const botPad = A.H - 1 - A.maxY;
  const left = Math.round((canW - sw) / 2);
  const top  = canH - botPad - sh;

  const scaled = await sharp(srcF)
    .extract({ left: B.minX, top: B.minY, width: B.w, height: B.h })
    .resize(sw, sh, { kernel: sharp.kernel.lanczos3, fit: 'fill' })
    .png().toBuffer();
  const outBuf = await sharp({ create: { width: canW, height: canH, channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: scaled, left, top }])
    .png().toBuffer();

  if (INSTALL) {
    const liveF = dir + 'starter_back_turn.png';
    if (!existsSync(rawF)) copyFileSync(liveF, rawF);   // preserve the original once
    await sharp(outBuf).toFile(liveF);
  } else {
    await sharp(outBuf).toFile(`${OUT}/${g}.png`);
  }
  console.log(`${g.padEnd(14)} scale ×${scale.toFixed(3)}  canvas ${B.W}x${B.H} → ${canW}x${canH}`
    + `  car ${B.w}×${B.h} → ${sw}×${sh}  botPad ${botPad}  ${INSTALL ? 'INSTALLED' : 'preview'}`);
}
