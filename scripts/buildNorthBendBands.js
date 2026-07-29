/**
 * buildNorthBendBands.js — convert the hand-made North Bend plates into
 * the biome-band convention used by the parallax backdrop.
 *
 * Source plates live in public/assets/scenery/north_bend/final/ and are
 * kept untouched; this writes derived bands into public/assets/biomes/
 * alongside the generated placeholder set.
 *
 * TWO KINDS OF LAYER, and the distinction matters:
 *
 *   far_horizon is a CONTINUOUS ridge designed to repeat.  It becomes a
 *   normal tiling parallax band.
 *
 *   The Mount Si and Rattlesnake plates are ONE-SHOT framing wedges.  They
 *   cannot tile — repeating them would put three Mount Sis across the
 *   horizon.  They are emitted at exactly the band width so a single tile
 *   fills the screen, and the biome table gives them a near-zero parallax
 *   rate so they never scroll far enough to reveal the seam.  That is also
 *   physically right: a peak several miles away barely moves.
 *
 * Per the owner's call, both wedges are CROPPED to their horizon portion.
 * Their lower thirds carry full-resolution near-field detail — ferns,
 * rocks, individual trunks — which would sit frozen while the road scrolls.
 * The existing tree spawner supplies scrolling near-field detail instead.
 */

import sharp from 'sharp';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC  = resolve(HERE, '../public/assets/scenery/north_bend/final');
const OUT  = resolve(HERE, '../public/assets/scenery/biomes');

const BAND_W = 2048;
// North Bend gets a taller band than the placeholder set: Mount Si is meant
// to read as a landmark, and 256 px of horizon strip cannot carry that.
// Matches Biomes.js BIOME_OVERRIDES.north_bend.h — taller than the generated
// set so Mount Si reads as a landmark once scaled down to the 800px screen.
const BAND_H = 1280;

// SUPERSEDED by the base plate (north_bend_transition_east.png) plus the
// distance-projected landmarks in Landmarks.js.  That plate already carries
// the ground, the side hills AND the distant range, so emitting these bands
// as well would paint a second copy of the same terrain over it.  They are
// now written out fully transparent, which keeps the biome/manifest wiring
// intact without drawing anything.  Restore JOBS_ART below if the layered
// approach is ever revisited.
const JOBS = [];

const JOBS_ART = [
  {
    src: 'north_bend_far_horizon.png',
    out: 'bio_north_bend_far.png',
    // Trim the empty sky above the ridge so the band's own bottom-anchoring
    // does the vertical placement rather than baked-in padding.
    crop: { top: 250, height: 518 },
    note: 'tiling ridge',
  },
  {
    src: 'north_bend_left_mount_si.png',
    out: 'bio_north_bend_ridge.png',
    // Keep the peak and the treeline; drop the meadow and near ferns below.
    crop: { top: 0, height: 560 },
    note: 'LEFT wedge, non-tiling',
  },
  {
    src: 'north_bend_right_rattlesnake.png',
    out: 'bio_north_bend_near.png',
    // Keep the ridge and rock face; drop the near-field fern bank.
    crop: { top: 0, height: 600 },
    note: 'RIGHT wedge, non-tiling',
  },
];

// Emit transparent placeholders for the superseded band slots.
for (const out of ['bio_north_bend_far.png', 'bio_north_bend_ridge.png', 'bio_north_bend_near.png']) {
  await sharp({ create: { width: BAND_W, height: BAND_H, channels: 4,
                          background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .png().toFile(resolve(OUT, out));
  console.log(`  ${out.padEnd(28)} transparent (superseded by base plate)`);
}

for (const job of JOBS) {
  const inPath = resolve(SRC, job.src);
  const meta   = await sharp(inPath).metadata();
  const height = Math.min(job.crop.height, meta.height - job.crop.top);

  await sharp(inPath)
    .extract({ left: 0, top: job.crop.top, width: meta.width, height })
    .resize(BAND_W, BAND_H, { fit: 'fill' })
    .png()
    .toFile(resolve(OUT, job.out));

  console.log(`  ${job.out.padEnd(28)} ${meta.width}x${meta.height} `
            + `-> crop ${height}px -> ${BAND_W}x${BAND_H}   (${job.note})`);
}

console.log(`\n${JOBS.length} North Bend bands -> ${OUT}`);
