import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'public/assets/ui/garage_buttons');
const output = path.join(root, 'public/assets/ui/garage_upgrade_toolbar.png');

const WIDTH = 1672;
const HEIGHT = 220;
const MARGIN_X = 24;
const GAP = 10;
const CELL_W = 223;
const CELL_H = 200;
const CELL_Y = 10;
const LABEL_TOP = 154;

const buttons = [
  ['tires.png', 'TIRES'],
  ['brakes.png', 'BRAKES'],
  ['suspension.png', 'SUSPENSION'],
  ['engine.png', 'ENGINE'],
  ['fuel.png', 'FUEL'],
  ['coolant.png', 'COOLANT'],
  ['wipers_headlights.png', 'WIPERS / HEADLIGHTS'],
];

const composites = [];

for (let index = 0; index < buttons.length; index += 1) {
  const [filename] = buttons[index];
  const x = MARGIN_X + index * (CELL_W + GAP);
  const mask = Buffer.from(`<svg width="${CELL_W}" height="${CELL_H}">
    <rect width="${CELL_W}" height="${CELL_H}" rx="18" fill="white"/>
  </svg>`);
  const tile = await sharp(path.join(sourceDir, filename))
    .resize(CELL_W, CELL_H, { fit: 'cover', position: 'centre' })
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
  composites.push({ input: tile, left: x, top: CELL_Y });
}

const frames = buttons.map(([, label], index) => {
  const x = MARGIN_X + index * (CELL_W + GAP);
  const selected = index === 0;
  const stroke = selected ? '#dd67ff' : '#70dcff';
  const strokeWidth = selected ? 4 : 2.5;
  const glowOpacity = selected ? 0.7 : 0.32;
  const labelMarkup = label === 'WIPERS / HEADLIGHTS'
    ? `<text x="${x + CELL_W / 2}" y="180" class="small">WIPERS /</text>
       <text x="${x + CELL_W / 2}" y="201" class="small">HEADLIGHTS</text>`
    : `<text x="${x + CELL_W / 2}" y="191" class="label">${label}</text>`;
  return `
    <rect x="${x}" y="${CELL_Y}" width="${CELL_W}" height="${CELL_H}" rx="18"
      fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" filter="url(#glow)"/>
    <rect x="${x + 6}" y="${CELL_Y + 6}" width="${CELL_W - 12}" height="${CELL_H - 12}" rx="13"
      fill="none" stroke="#eefaff" stroke-opacity=".22"/>
    <path d="M${x + 18} ${LABEL_TOP}H${x + CELL_W - 18}" stroke="${stroke}" stroke-opacity="${glowOpacity}"/>
    ${labelMarkup}`;
}).join('');

const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  <defs>
    <linearGradient id="labelFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#040712" stop-opacity=".18"/>
      <stop offset=".28" stop-color="#040712" stop-opacity=".83"/>
      <stop offset="1" stop-color="#02040a" stop-opacity=".98"/>
    </linearGradient>
    <filter id="glow" x="-15%" y="-15%" width="130%" height="130%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <style>
      .label,.small{fill:#f7f9ff;font-family:'Arial Narrow','Helvetica Neue',Arial,sans-serif;font-weight:900;text-anchor:middle;paint-order:stroke;stroke:#03050b;stroke-width:4px;stroke-linejoin:round}
      .label{font-size:22px;letter-spacing:1.2px}.small{font-size:17px;letter-spacing:.7px}
    </style>
  </defs>
  ${buttons.map((_, index) => {
    const x = MARGIN_X + index * (CELL_W + GAP);
    return `<path d="M${x} ${LABEL_TOP - 16}Q${x + CELL_W / 2} ${LABEL_TOP - 4} ${x + CELL_W} ${LABEL_TOP - 16}V${CELL_Y + CELL_H}H${x}Z" fill="url(#labelFade)"/>`;
  }).join('')}
  ${frames}
</svg>`);

await sharp({ create: { width: WIDTH, height: HEIGHT, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([...composites, { input: overlay, left: 0, top: 0 }])
  .png()
  .toFile(output);

console.log(output);
