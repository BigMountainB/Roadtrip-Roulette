#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
// policeLightbarSheet — visual validation for the police sprite metadata.
// Renders one contact sheet PER AGENCY (9 angle frames side by side) with
// the EFFECTIVE metadata drawn over each frame:
//   yellow box  = whole light-bar anchor (lb)     [dashed if dark:1]
//   red box     = red lens cluster (lbR)
//   blue box    = blue lens cluster (lbB)
//   green box   = content bounds (cx/cy)
//   green line  = tire baseline (cy1)
// "Effective" = generated base meta MERGED with the hand-reviewed overrides
// (src/data/policeSpriteOverrides.js), i.e. exactly what the game renders.
// Also prints per-agency consistency stats (baseline / content-height
// variance) for the art-consistency audit.
//
//   node scripts/policeLightbarSheet.mjs
// Sheets land in tmp/police_lightbar_sheets/.
// ─────────────────────────────────────────────────────────────────────────
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { POLICE_SPRITE_META, POLICE_AGENCIES, POLICE_ANGLES, jurFrameKey }
  from '../src/data/policeAgencies.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT  = path.join(ROOT, 'tmp/police_lightbar_sheets');
fs.mkdirSync(OUT, { recursive: true });

const CELL_W = 340, CELL_H = 227;   // 768x512 ÷ ~2.26

const svgBox = (b, W, H, color, dash = false) => b
  ? `<rect x="${(b.x - b.w / 2) * W}" y="${(b.y - b.h / 2) * H}" width="${b.w * W}" height="${b.h * H}"
      fill="none" stroke="${color}" stroke-width="2" ${dash ? 'stroke-dasharray="6,4"' : ''}/>`
  : '';

for (const [id, a] of Object.entries(POLICE_AGENCIES)) {
  const cells = [];
  const stats = [];
  for (let i = 0; i < POLICE_ANGLES.length; i++) {
    const deg  = POLICE_ANGLES[i];
    const key  = jurFrameKey(a.prefix, deg);
    const m    = POLICE_SPRITE_META[key];
    const file = path.join(ROOT, `public/assets/cars/jurisdictions/${a.prefix}_spin_${String(deg).padStart(3, '0')}.png`);
    if (!m || !fs.existsSync(file)) continue;
    stats.push({ deg, base: m.cy1, ch: m.cy1 - m.cy0, cw: m.cx1 - m.cx0 });
    const overlays = `
      <svg width="${CELL_W}" height="${CELL_H}" xmlns="http://www.w3.org/2000/svg">
        <rect x="${m.cx0 * CELL_W}" y="${m.cy0 * CELL_H}" width="${(m.cx1 - m.cx0) * CELL_W}"
              height="${(m.cy1 - m.cy0) * CELL_H}" fill="none" stroke="#00FF66" stroke-width="1" opacity="0.7"/>
        <line x1="0" y1="${m.cy1 * CELL_H}" x2="${CELL_W}" y2="${m.cy1 * CELL_H}"
              stroke="#00FF66" stroke-width="1" opacity="0.9"/>
        ${svgBox(m.lb,  CELL_W, CELL_H, '#FFE000', !!m.lb?.dark)}
        ${svgBox(m.lbR, CELL_W, CELL_H, '#FF3030')}
        ${svgBox(m.lbB, CELL_W, CELL_H, '#3080FF')}
        <text x="6" y="18" font-size="15" font-family="monospace" fill="#FFFFFF"
              stroke="#000" stroke-width="0.6">${deg}°${m.lb?.dark ? ' dark' : ''}${m.lb?.override ? ' OVR' : ''}</text>
      </svg>`;
    const frame = await sharp(file).resize(CELL_W, CELL_H, { fit: 'fill' })
      .composite([{ input: Buffer.from(overlays), top: 0, left: 0 }])
      .png().toBuffer();
    cells.push({ input: frame, top: 0, left: i * CELL_W });
  }
  await sharp({ create: { width: CELL_W * POLICE_ANGLES.length, height: CELL_H,
    channels: 4, background: { r: 24, g: 28, b: 36, alpha: 1 } } })
    .composite(cells).png().toFile(path.join(OUT, `${a.prefix}.png`));

  // Consistency numbers for the audit (item 9): tire baseline + content height.
  const bases = stats.map(s => s.base), chs = stats.map(s => s.ch);
  const spread = (v) => (Math.max(...v) - Math.min(...v)).toFixed(4);
  console.log(`${a.prefix.padEnd(20)} baseline spread ${spread(bases)}  contentH spread ${spread(chs)}  `
    + stats.map(s => `${s.deg}:${s.ch.toFixed(2)}`).join(' '));
}
console.log('sheets →', OUT);
