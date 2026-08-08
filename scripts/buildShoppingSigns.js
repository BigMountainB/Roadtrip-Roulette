/**
 * Build the per-stop "Freeway Shopping" signs — the blue placards that announce
 * which businesses are at the next rest stop.
 *
 *   npm run build:signs          # rebuild every stop
 *   node scripts/buildShoppingSigns.js H     # rebuild only stop H
 *
 * Output: public/assets/businesses/sign_<id>.png, one per REST_STOP, loaded by
 * RouteData's `sign_${rs.id}` key.
 *
 * ── Rewritten 2026-08-04 ────────────────────────────────────────────────────
 * The previous version was broken in three ways and its output had been deleted
 * from the tree:
 *   1. It carried an INLINE COPY of the rest-stop list that had gone stale —
 *      it thought Mercer Island sold camping, when the live game has it selling
 *      Gas-N-Sip / Lord Motors / Park & Ride. Signs advertised the wrong shops.
 *      This version imports REST_STOPS from constants.js, so it cannot drift.
 *   2. It always drew a 2x3 grid of six white plaques and filled only as many
 *      as the stop had businesses, leaving empty white boxes on most signs.
 *      Blanks are now simply not drawn — an unused slot is plain blue.
 *   3. Its inputs (blank template + logo art) lived in `Archive/Images/`, which
 *      is GITIGNORED and no longer exists, so it couldn't run at all. Its two
 *      inputs are now committed under scripts/assets/, and the logos come from
 *      the same shipped PNGs the game itself uses.
 *
 * scripts/assets/sign_blank.png  — the placard: border, header, flat blue, no slots
 * scripts/assets/sign_plaque.png — one empty white slot incl. its bevel margin
 * Both were extracted from the original authored sign art, so the rebuilt signs
 * keep its exact blue (rgb 27,47,180), typography and bevel.
 */
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REST_STOPS } from '../src/constants.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IN_DIR   = path.join(ROOT, 'scripts', 'assets');
const LOGO_DIR = path.join(ROOT, 'public', 'assets', 'businesses');
const OUT_DIR  = LOGO_DIR;

// Slot grid, measured off the authored art. Six slots, 3 across x 2 down.
const COLS = [55, 295, 535];
const ROWS = [136, 317];
const SLOT_W = 179, SLOT_H = 131;
const PLAQUE_MARGIN = 14;          // bevel bleed baked into sign_plaque.png
const LOGO_PAD = 0.12;             // keep logos off the plaque's rounded corners

/**
 * Amenity → brand logo, mirroring brandsForStop() in RestStopScene.js.
 * Keep these two in step: the sign is a promise about what's at the stop.
 * `dealer` is the vestigial regional fallback — Lord west, Sam's east.
 */
const LOGO_FOR = {
  gas:       'huffs.png',
  hunting:   'cowbellas.png',
  camp:      'aok.png',
  lord:      'lord.png',
  suck:      'suck.png',
  vices:     'gasnsip.png',
  ambm:      'am_bm.png',
  parkride:  'park-and-ride.png',
  schwasted: 'les_schwasted.png',
  fap:       'fap.png',
};
const logoFor = (amenity, mileage) =>
  amenity === 'dealer' ? (mileage < 100 ? 'lord.png' : 'suck.png') : (LOGO_FOR[amenity] ?? null);

const ONLY_ID = (process.argv[2] || '').trim() || null;

async function buildSign(stop, plaque) {
  const amenities = (stop.amenities ?? []).filter(a => logoFor(a, stop.mileage));
  const skipped   = (stop.amenities ?? []).filter(a => !logoFor(a, stop.mileage));
  if (skipped.length) {
    console.warn(`  ! ${stop.id}: no logo for ${skipped.join(', ')} — slot left empty`);
  }
  // Six slots is the ceiling; anything past that would need a second placard.
  const shown = amenities.slice(0, COLS.length * ROWS.length);
  if (amenities.length > shown.length) {
    console.warn(`  ! ${stop.id}: ${amenities.length} businesses, only ${shown.length} fit`);
  }

  const layers = [];
  for (let i = 0; i < shown.length; i++) {
    const x = COLS[i % COLS.length];
    const y = ROWS[Math.floor(i / COLS.length)];
    // Plaque first (it carries its own bevel margin), then the logo on top.
    layers.push({ input: plaque, left: x - PLAQUE_MARGIN, top: y - PLAQUE_MARGIN });

    const inner = { w: Math.round(SLOT_W * (1 - LOGO_PAD * 2)), h: Math.round(SLOT_H * (1 - LOGO_PAD * 2)) };
    const logo = await sharp(path.join(LOGO_DIR, logoFor(shown[i], stop.mileage)))
      .resize(inner.w, inner.h, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .toBuffer({ resolveWithObject: true });
    layers.push({
      input: logo.data,
      left: x + Math.round((SLOT_W - logo.info.width) / 2),
      top:  y + Math.round((SLOT_H - logo.info.height) / 2),
    });
  }

  const out = path.join(OUT_DIR, `sign_${stop.id}.png`);
  await sharp(path.join(IN_DIR, 'sign_blank.png')).composite(layers).png().toFile(out);
  console.log(`  ✓ sign_${stop.id}.png — ${shown.length} slot${shown.length === 1 ? '' : 's'}: ${shown.join(', ')}`);
}

const plaque = await fs.readFile(path.join(IN_DIR, 'sign_plaque.png'));
const stops  = ONLY_ID ? REST_STOPS.filter(s => s.id === ONLY_ID) : REST_STOPS;
if (!stops.length) {
  console.error(`✘ No rest stop with id "${ONLY_ID}".`);
  process.exit(1);
}
console.log(`Building ${stops.length} shopping sign${stops.length === 1 ? '' : 's'}…`);
for (const stop of stops) await buildSign(stop, plaque);
console.log('Done.');
