/**
 * buildBiomeBands.js — placeholder parallax bands for the biome backdrop.
 *
 * Generates 21 seamlessly-tiling silhouette strips (7 biomes x 3 depth
 * layers).  Crude, but each biome is deliberately given a DISTINCT
 * silhouette grammar — jagged alpine vs flat-topped mesa vs rolling wheat —
 * so you can judge the geographic progression across Washington without any
 * real art existing yet.  Real bands drop in at the same filenames.
 *
 * SEAMLESS TILING is not optional here: these scroll horizontally forever.
 * Every profile is a sum of sines with an INTEGER number of periods across
 * the band width, so f(0) === f(W) by construction and the wrap is
 * invisible.  Do not add a term with a non-integer period.
 *
 * Anchoring convention: every band is the same size and its silhouette is
 * drawn UP from the bottom edge, with transparency above.  The renderer
 * seats all layers on the horizon line, so a uniform height means the
 * renderer needs no per-layer offset table.
 *
 * Usage:  node scripts/buildBiomeBands.js
 */

import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE    = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, '../public/assets/scenery/biomes');

const BAND_W = 2048;
// 640, not 256: bands are authored at BAND_W (2048) and then scaled DOWN to
// the 800px screen, so the source has to be ~2.5x taller than the intended
// on-screen height or the whole set renders as a thin strip.
const BAND_H = 640;
const STEP   = 4;      // px between profile samples

// ── Silhouette grammar ─────────────────────────────────────────────────
// Each layer picks a `shape`, which is what actually makes the biomes read
// as different places rather than the same hill in different colours:
//
//   smooth   rolling, rounded        — Palouse, distant foothills
//   jagged   sharp high-frequency    — alpine peaks
//   sawtooth conifer crowns          — fir / pine treelines
//   cascade  broad timbered ridges  — Washington Cascades (rock only high)
//   mesa     quantised flat tops     — Columbia plateau rim, basalt
//   flat     near-level with nicks   — irrigated fields, wheat
//
// `freqs` are period COUNTS across the band, so they must stay integers.

// `yOff` is how many px BELOW the horizon each layer's bottom edge sits.
// Without it, a tall near-layer bottom-anchored to the same line simply
// buries everything behind it — which is exactly what the first pass did.
// Seating closer layers lower means only their crowns clear the horizon,
// which is both how real parallax backdrops are built and what lets the
// distant range stay visible.
const LAYER_Y_OFF = { far: 0, ridge: 12, near: 26 };

const BIOMES = {
  westside_forest: {
    // Enclosed and wet: you can barely see a distant range at all here, and
    // that is the point — the far layer is deliberately almost nothing.
    label: 'West Side forest (mile 20-45)',
    // far is EMPTY on purpose.  It used to be base 0.10 / amp 0.08, meaning
    // "barely any distant range" — but a low flat profile does not render as
    // nothing, it renders as a slab whose top edge is a dead-straight line
    // across the whole screen.  Real terrain has no such edge, and it read as
    // a light blue-grey rule through the horizon.  An enclosed wet forest has
    // no visible distant range at all, so draw none.
    far:   { shape: 'empty',    base: 0,    amp: 0,    freqs: [2],         color: '#8FA4AE' },
    ridge: { shape: 'sawtooth', base: 0.30, amp: 0.16, freqs: [3, 7],      color: '#4A6355', tooth: 18 },
    near:  { shape: 'sawtooth', base: 0.44, amp: 0.18, freqs: [5, 11],     color: '#23372A', tooth: 15 },
  },
  pass_alpine: {
    // The only place snow is permitted, and the only place the far layer
    // is meant to dominate the frame.
    label: 'Pass alpine (mile 45-58) — ONLY biome with snow',
    // freqs LEAD with 1 and 2 so one or two summits dominate the tile and
    // everything else reads as their shoulders — real ranges have hero peaks,
    // whereas the old [3,7,13] gave every peak identical spacing and height.
    // baseProfile weights by 1/(k+1), so the first frequency carries the form.
    // snow 0.38, not 0.50: at mile 55 the ROAD is a total whiteout, so a
    // range with only a dusting on the very tips contradicted the ground.
    far:   { shape: 'cascade',  base: 0.48, amp: 0.50, freqs: [1, 2, 5, 11], color: '#8496A3', snow: 0.38, rockLine: 0.36 },
    ridge: { shape: 'cascade',  base: 0.34, amp: 0.28, freqs: [2, 3, 7],     color: '#55645E', rockLine: 0.44 },
    near:  { shape: 'sawtooth', base: 0.30, amp: 0.14, freqs: [7, 13],     color: '#2E3B33', tooth: 13 },
  },
  easton_transition: {
    label: 'Easton transition (mile 58-78)',
    far:   { shape: 'smooth',   base: 0.30, amp: 0.26, freqs: [2, 5],      color: '#9DA79C' },
    ridge: { shape: 'smooth',   base: 0.26, amp: 0.18, freqs: [3, 7],      color: '#6E7355' },
    near:  { shape: 'sawtooth', base: 0.26, amp: 0.12, freqs: [5, 11],     color: '#46503A', tooth: 22 },
  },
  kittitas_foothills: {
    label: 'Kittitas dry foothills (mile 78-122)',
    far:   { shape: 'smooth',   base: 0.30, amp: 0.24, freqs: [2, 3],      color: '#A9A48E' },
    ridge: { shape: 'mesa',     base: 0.24, amp: 0.18, freqs: [3, 5],      color: '#8A8062', steps: 5 },
    near:  { shape: 'flat',     base: 0.15, amp: 0.07, freqs: [7, 17],     color: '#6B6242' },
  },
  vantage_basalt: {
    // Route landmark. Flat-topped benches + columnar striation are what
    // make this read as the Columbia gorge rather than generic brown hills.
    label: 'Vantage basalt / Columbia (mile 122-142) — landmark',
    far:   { shape: 'mesa',     base: 0.42, amp: 0.30, freqs: [2, 3],      color: '#A79A8A', steps: 4 },
    ridge: { shape: 'mesa',     base: 0.44, amp: 0.36, freqs: [3, 5],      color: '#6E6155', steps: 3, columns: 26 },
    near:  { shape: 'mesa',     base: 0.30, amp: 0.22, freqs: [5, 7],      color: '#4A403A', steps: 3, columns: 18 },
  },
  columbia_irrigated: {
    label: 'Columbia irrigated ag (mile 142-210)',
    far:   { shape: 'flat',     base: 0.16, amp: 0.07, freqs: [2, 3],      color: '#B0AE96' },
    ridge: { shape: 'smooth',   base: 0.20, amp: 0.11, freqs: [3, 5],      color: '#8E9A6A' },
    near:  { shape: 'flat',     base: 0.14, amp: 0.05, freqs: [11, 23],    color: '#6E8447' },
  },
  palouse_hills: {
    label: 'Palouse wheat hills (mile 210-293)',
    far:   { shape: 'smooth',   base: 0.28, amp: 0.22, freqs: [2, 3],      color: '#B5AC8C' },
    ridge: { shape: 'smooth',   base: 0.32, amp: 0.26, freqs: [3, 5],      color: '#9C9160' },
    near:  { shape: 'smooth',   base: 0.22, amp: 0.16, freqs: [5, 7],      color: '#7E7440' },
  },
};

const LAYERS = ['far', 'ridge', 'near'];

// ── Profile generation ─────────────────────────────────────────────────

/** Height (px, from the bottom edge) at x, before shape modifiers. */
function baseProfile(spec, x) {
  const { base, amp, freqs } = spec;
  let n = 0, wsum = 0;
  for (let k = 0; k < freqs.length; k++) {
    // Weight falls off for higher frequencies so the big shape dominates.
    const w = 1 / (k + 1);
    // Phase offsets are multiples of the same period, so still seamless.
    n += w * Math.sin((2 * Math.PI * freqs[k] * x) / BAND_W + k * 1.7);
    wsum += w;
  }
  return (base + (n / wsum) * amp * 0.5) * BAND_H;
}

function profileAt(spec, x) {
  let h = baseProfile(spec, x);
  switch (spec.shape) {
    case 'jagged': {
      // High-frequency spikes riding the base — alpine ridgelines.
      const s = Math.sin((2 * Math.PI * 37 * x) / BAND_W)
              + Math.sin((2 * Math.PI * 61 * x) / BAND_W + 0.9) * 0.6;
      h += s * BAND_H * 0.05;
      break;
    }
    case 'cascade': {
      // Washington Cascades, NOT alpine spires.  Snoqualmie is the lowest
      // major I-90 crossing (3,015 ft): broad, rounded, heavily timbered
      // ridges with conifers almost to the summits and bare rock only on a
      // few high faces.  'jagged' rides uniform 37/61-period teeth over the
      // WHOLE profile, which is Tetons/Sawtooths grammar and was the main
      // reason the backdrop didn't read as Washington.
      //
      // Here the relief is scaled by ALTITUDE: the low forested shoulders
      // stay smooth and only ground above `rockLine` breaks up.  Frequencies
      // stay integers, so the band still tiles seamlessly.
      const rel  = h / BAND_H;                       // 0 at base, ~1 at summit
      const rock = Math.max(0, rel - (spec.rockLine ?? 0.42)) / 0.58;
      const s = Math.sin((2 * Math.PI * 17 * x) / BAND_W)
              + Math.sin((2 * Math.PI * 29 * x) / BAND_W + 1.3) * 0.5
              + Math.sin((2 * Math.PI * 43 * x) / BAND_W + 0.4) * 0.3;
      // 0.075, not 0.022: the first pass scaled the relief so gently that the
      // summits came out as soft domes and the range read as rolling hills
      // rather than mountains.  The altitude gate still keeps the timbered
      // shoulders smooth — this only sharpens the high ground.
      h += s * BAND_H * 0.075 * rock;
      break;
    }
    case 'mesa': {
      // Quantise into flat terraces — the Columbia plateau and basalt
      // benches read as stacked flat tops, not peaks.  This is the single
      // most recognisable silhouette on the eastern half of the route.
      const q = BAND_H * (spec.base + spec.amp) / (spec.steps ?? 4);
      h = Math.round(h / q) * q;
      break;
    }
    case 'flat': {
      // Near-level with occasional nicks (windbreaks, equipment).
      const nick = Math.sin((2 * Math.PI * 43 * x) / BAND_W);
      h += (nick > 0.86 ? 1 : 0) * BAND_H * 0.05;
      break;
    }
    default: break;   // 'smooth' and 'sawtooth' use the base profile
  }
  return Math.max(2, Math.min(BAND_H - 2, h));
}

/** Conifer crowns along the top edge — a run of narrow triangles. */
function sawtoothPath(spec) {
  const tooth = spec.tooth ?? 14;
  const pts = [];
  for (let x = 0; x <= BAND_W; x += tooth) {
    const h = profileAt(spec, x);
    // Alternate crown heights so the treeline isn't a uniform comb.
    const bump = ((x / tooth) % 3 === 0 ? 1.55 : (x / tooth) % 3 === 1 ? 1.0 : 1.28);
    pts.push([x, BAND_H - h]);
    pts.push([x + tooth / 2, BAND_H - h - tooth * bump]);
  }
  return pts;
}

function svgFor(spec) {
  // 'empty' emits a fully transparent band — a layer that should genuinely
  // show nothing, rather than a very short one.
  if (spec.shape === 'empty') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${BAND_W}" height="${BAND_H}"></svg>`;
  }
  const pts = spec.shape === 'sawtooth'
    ? sawtoothPath(spec)
    : (() => {
        const p = [];
        for (let x = 0; x <= BAND_W; x += STEP) p.push([x, BAND_H - profileAt(spec, x)]);
        return p;
      })();

  const poly = [`0,${BAND_H}`, ...pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`), `${BAND_W},${BAND_H}`].join(' ');
  let extra = '';

  // Basalt columns — vertical striations on the rock face.  Cheap, but it
  // is what makes the Vantage cliffs read as columnar basalt rather than
  // as a brown hill, and that landmark is doing a lot of work on this route.
  if (spec.columns) {
    const step = BAND_W / spec.columns;
    for (let i = 0; i < spec.columns; i++) {
      const x = i * step + step * 0.32;
      const h = profileAt(spec, x);
      extra += `<rect x="${x.toFixed(1)}" y="${(BAND_H - h).toFixed(1)}" `
             + `width="${(step * 0.16).toFixed(1)}" height="${h.toFixed(1)}" `
             + `fill="#000000" opacity="0.16"/>`;
    }
  }

  // Snowfields — only ever emitted for pass_alpine.  Painted as a clipped
  // band above the snowline so it follows the ridge instead of sitting on
  // top as a stripe.
  if (spec.snow) {
    // The snowline WANDERS.  It used to be a single flat Y, which cut a
    // dead-straight horizontal edge across every peak — the giveaway that
    // this was generated rather than observed.  Real snowlines rise on sunny
    // shoulders and drop into shaded gullies, so the boundary is modulated by
    // two low integer-period sines (still seamless) and the cap polygon is
    // closed by walking BACK along that curve instead of along a flat line.
    const snowYAt = (x) => BAND_H * (1 - spec.snow)
      + Math.sin((2 * Math.PI * 3 * x) / BAND_W + 0.7) * BAND_H * 0.050
      + Math.sin((2 * Math.PI * 7 * x) / BAND_W + 2.1) * BAND_H * 0.025;

    const top = [], bottom = [];
    for (let x = 0; x <= BAND_W; x += STEP) {
      const y  = BAND_H - profileAt(spec, x);
      const sy = snowYAt(x);
      top.push([x, Math.min(y, sy)]);
      bottom.push([x, sy]);
    }
    const capPoly = top.concat(bottom.reverse())
      .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    extra += `<polygon points="${capPoly}" fill="#FFFFFF" opacity="0.88"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BAND_W}" height="${BAND_H}">`
       + `<polygon points="${poly}" fill="${spec.color}"/>${extra}</svg>`;
}

// ── Main ───────────────────────────────────────────────────────────────
await mkdir(OUT_DIR, { recursive: true });

const manifest = [];
for (const [biome, def] of Object.entries(BIOMES)) {
  console.log(`\n${def.label}`);
  for (const layer of LAYERS) {
    const spec = def[layer];
    const name = `bio_${biome}_${layer}.png`;
    await sharp(Buffer.from(svgFor(spec))).png().toFile(resolve(OUT_DIR, name));
    manifest.push({ key: `bio_${biome}_${layer}`, path: `assets/biomes/${name}` });
    console.log(`  ${name.padEnd(38)} ${spec.shape}${spec.snow ? ' +snow' : ''}${spec.columns ? ' +columns' : ''}`);
  }
}

await writeFile(
  resolve(OUT_DIR, 'bands.json'),
  JSON.stringify({
    _comment: 'Generated by scripts/buildBiomeBands.js — placeholder art. '
            + 'Real bands must keep this size and the bottom-anchored convention.',
    bandW: BAND_W,
    bandH: BAND_H,
    layers: LAYERS,
    // px below the horizon each layer's BOTTOM edge is seated
    layerYOff: LAYER_Y_OFF,
    // horizontal parallax rate per layer, as a multiple of road heading
    layerRate: { far: 0.06, ridge: 0.14, near: 0.30 },
    biomes: Object.keys(BIOMES),
    manifest,
  }, null, 2),
);

console.log(`\n${manifest.length} bands + bands.json -> ${OUT_DIR}`);
