import { ROUTE_SEGS, TOTAL_ROUTE_MILES } from '../constants.js';
import { lerpColor } from '../utils/Colors.js';
import { Weather } from '../world/Weather.js';
import { TimeOfDay } from '../world/TimeOfDay.js';

/**
 * Road surface material — the single place that decides what the pavement
 * under the player is MADE of at any point on the route, and what stable
 * wear it carries.
 *
 * Split out of Road._drawSegment for two reasons:
 *
 *   1. _drawSegment runs per visible segment per frame (~DRAW_DIST calls),
 *      and everything here is a pure function of world position.  Computing
 *      it once and caching on the segment is what keeps the new detail from
 *      costing anything per frame.
 *   2. All of it must be DETERMINISTIC in world position.  The old code
 *      derived the asphalt tone from `seg.index % 2` and a per-segment ±5%
 *      jitter, which is exactly why the road read as alternating horizontal
 *      bands: adjacent segments were independent samples, so every segment
 *      boundary was a visible tone step.  Nothing here is allowed to vary
 *      independently between neighbours — variation is either smoothly
 *      interpolated across many segments or anchored to a feature that spans
 *      many segments.
 */

// ── Materials ─────────────────────────────────────────────────────────────
//
// `mean` is the tile's average RGB, measured at build time by
// scripts/buildRoadTextures.js.  RoadPlane tints each tile by
// (regional asphalt colour / mean), so the AVERAGE rendered pixel lands
// exactly on the region's base colour and the texture contributes only its
// deviation from that average.  Without this the tiles would just multiply
// the palette down toward black (a 0.29-mean tile at tint 1.0 renders at 29%
// of the intended asphalt value).
//
// Re-run the build script and paste the numbers back here if the art changes.
export const ROAD_MATERIALS = {
  westside: {
    key:  'road_asphalt_westside',
    mean: { r: 0.2924, g: 0.2938, b: 0.2950 },
    // Cool, dark, damp-looking.  Patch repairs are a Seattle constant.
    tone:      0x000000, toneAmt: 0.04,   // pull the regional base slightly cooler/darker
    patchRate: 0.030,                     // repair patches per candidate cell
    patchDark: 0.10,
    wearAmt:   0.055,                     // wheel-path polish strength
    shoulderDark: 0.20,
    gritCol:   0x4A4A46,                  // shoulder gravel / dirt fringe
  },
  mountain: {
    key:  'road_asphalt_mountain',
    mean: { r: 0.4133, g: 0.4131, b: 0.4049 },
    // Coarser, lighter aggregate; winter abrasion leaves it chalky and
    // heavily crack-sealed.
    tone:      0xFFFFFF, toneAmt: 0.05,
    patchRate: 0.055,                     // crack-seal repairs everywhere
    patchDark: 0.085,
    wearAmt:   0.042,                     // studded tyres scour the polish off
    shoulderDark: 0.14,
    gritCol:   0x565049,
  },
  eastern: {
    key:  'road_asphalt_eastern',
    mean: { r: 0.3732, g: 0.3511, b: 0.3227 },
    // Warm sun-bleached chipseal, dusty edges, tar-snake repairs.
    tone:      0xC9B48A, toneAmt: 0.10,   // bleach it warm
    patchRate: 0.040,
    patchDark: 0.125,                     // fresh tar reads darker than chipseal
    wearAmt:   0.050,
    shoulderDark: 0.10,
    gritCol:   0x8A7A55,                  // dust, not gravel
  },
};

/**
 * Where each material owns the road, and how far the handoff is smeared.
 *
 * Transitions are blended over MILES, never switched on a segment — a hard
 * swap would reintroduce exactly the visible cross-road line this whole
 * change exists to remove.  RoadPlane draws both tiles during a crossfade,
 * so the pavement genuinely dissolves from one surface into the other along
 * the length of the climb / descent.
 *
 *   westside  mile   0 –  36   Seattle, downtown, Lake WA, Mercer, Eastside,
 *                              North Bend
 *   (blend)   mile  36 –  46   the climb out of North Bend
 *   mountain  mile  46 –  86   Snoqualmie Pass, Easton, Cle Elum
 *   (blend)   mile  86 – 102   dropping into the Kittitas valley
 *   eastern   mile 102 – 293   Kittitas, Vantage, Columbia Basin, Palouse
 */
const TRANSITIONS = [
  { from: 'westside', to: 'mountain', start: 36, end:  46 },
  { from: 'mountain', to: 'eastern',  start: 86, end: 102 },
];

const MILES_PER_SEG = TOTAL_ROUTE_MILES / ROUTE_SEGS;

/** Smoothstep — used everywhere a value must ease rather than step. */
const ss = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/**
 * Material mix at a route mile.
 * Returns { a, b, t } — draw `a` at full, then `b` over it at `t`.
 * Outside a transition band `t` is 0 and `b` is null.
 */
export function materialAt(mile) {
  // Walk the transitions in order, carrying the material forward.  Tracking
  // `cur` is the whole point: a mile that sits BETWEEN two transitions (the
  // pass itself, mile 46-86) is past the first handoff and before the second,
  // so its material is the first transition's DESTINATION.  Deriving it from
  // the transition list alone instead put Snoqualmie and Easton back on the
  // westside tile — wet Seattle asphalt at 3000 ft.
  let cur = TRANSITIONS[0].from;
  for (const tr of TRANSITIONS) {
    if (mile < tr.start) break;          // still fully inside `cur`
    if (mile < tr.end) {
      return {
        a: ROAD_MATERIALS[tr.from],
        b: ROAD_MATERIALS[tr.to],
        t: ss((mile - tr.start) / (tr.end - tr.start)),
      };
    }
    cur = tr.to;                         // past this handoff entirely
  }
  return { a: ROAD_MATERIALS[cur], b: null, t: 0 };
}

// ── Deterministic noise ───────────────────────────────────────────────────
const fract = (x) => x - Math.floor(x);
/** Stable hash on an integer cell + salt.  Same value every frame, forever. */
export function hash1(i, salt = 0) {
  return fract(Math.sin(i * 127.1 + salt * 311.7) * 43758.5453);
}
/**
 * Smooth 1-D value noise in [0,1) with a period of `cells` segments.
 * Interpolated, so consecutive segments can never step against each other —
 * this is what replaces the old independent per-segment jitter.
 */
export function noise1(x) {
  const i  = Math.floor(x);
  const fr = x - i;
  const a  = hash1(i, 3), b = hash1(i + 1, 3);
  return a + (b - a) * ss(fr);
}

// Low-frequency tone variation wavelength, in SEGMENTS.  The spec's 8-15
// window: two octaves at 11 and 27 segments give a wandering surface with no
// single obvious repeat, and because both are interpolated the tone gradient
// across any one segment boundary is a fraction of a percent.
const TONE_SEGS_A = 11;
const TONE_SEGS_B = 27;
const TONE_RANGE  = 0.028;   // ±2.8% — reads as pavement, not as banding

// Repair patches.  Anchored to a coarse cell so ONE patch spans many
// segments; a per-segment roll would put a transverse band on every segment,
// which is the failure mode being removed.
const PATCH_CELL_SEGS = 34;


/**
 * Per-segment road detail, computed once and cached on the segment.
 *
 * Everything returned is a pure function of seg.index, so it is identical on
 * every frame, in the rear-view mirror, and across reloads — nothing here can
 * flicker or crawl.
 */
export function roadDetail(seg) {
  if (seg._rd) return seg._rd;

  const i    = seg.index;
  const mile = i * MILES_PER_SEG;
  const mix  = materialAt(mile);
  // Wear belongs to the material the road mostly IS here — blending wear
  // parameters as well as textures would double-count the transition.
  const mat  = mix.t > 0.5 ? mix.b : mix.a;

  // ── Low-frequency tone.  Two interpolated octaves, centred on 0. ──
  const tone = ((noise1(i / TONE_SEGS_A) - 0.5) * 0.65
             +  (noise1(i / TONE_SEGS_B + 57.3) - 0.5) * 0.35) * 2 * TONE_RANGE;

  // ── Repair patch.  A patch occupies a run of segments inside its cell and
  // a lateral band inside the road, so it reads as a longitudinal rectangle
  // of newer asphalt — not as a stripe across the carriageway. ──
  const pCell = Math.floor(i / PATCH_CELL_SEGS);
  let patch = null;
  if (hash1(pCell, 11) < mat.patchRate * 3.2) {
    const rStart = hash1(pCell, 12);
    const rLen   = hash1(pCell, 13);
    const lo = Math.floor(pCell * PATCH_CELL_SEGS + rStart * PATCH_CELL_SEGS * 0.45);
    const hi = lo + Math.round(4 + rLen * 22);        // 4-26 segments long
    if (i >= lo && i < hi) {
      // Lateral extent in road-relative coords (-1 = left edge, +1 = right).
      const cx = (hash1(pCell, 14) - 0.5) * 1.5;
      // Narrower than before: the old 0.16-0.58 half-width put a band across
      // up to 58% of the carriageway, which at a hard edge reads as a painted
      // rectangle rather than as a patch of newer asphalt.
      const hw = 0.10 + hash1(pCell, 15) * 0.20;
      // Ends taper so the patch doesn't start and stop on a hard line.
      const span = hi - lo;
      const edge = Math.min(i - lo, hi - 1 - i) / Math.max(1, span * 0.18);
      // Each SIDE wanders independently and at a different rate, so the patch
      // has a ragged outline instead of two parallel straight rails — a single
      // shared offset just slid a rigid rectangle side to side.
      const wobL = (noise1(i / 7.0 + pCell * 3.7) - 0.5) * 0.20;
      const wobR = (noise1(i / 5.5 + pCell * 8.1) - 0.5) * 0.20;
      patch = {
        x0: Math.max(-1, cx - hw + wobL),
        x1: Math.min(1,  cx + hw + wobR),
        amt: mat.patchDark * ss(Math.min(1, edge)),
      };
    }
  }


  return (seg._rd = { mat, mix, tone, patch, mile });
}

/**
 * Wheel-path centres in road-relative coords for a given lane count.
 * Broad and faint: real wheel paths are ~2 ft polished bands about 5.5 ft
 * apart, sitting either side of each lane's centreline.
 */
export function wheelPaths(lanes) {
  const n = Math.max(1, lanes);
  const out = [];
  // Road-relative coords run -1..+1 across a 36 ft carriageway, so 1.0 = 18 ft.
  // A passenger car tracks ~5.5 ft outside-to-outside → ±2.75 ft → ±0.153.
  // Clamped to stay inside its own lane when the road carries more lanes.
  const laneHalf = 1 / n;
  const off = Math.min(0.153, laneHalf * 0.45);
  for (let l = 0; l < n; l++) {
    const c = (l + 0.5) / n * 2 - 1;          // lane centre, -1..1
    out.push(c - off, c + off);
  }
  return out;
}

/** Half-width of one polished wheel band, in road-relative coords.
 *  ~2 ft of contact-plus-spread on an 18 ft half-road. */
export const WHEEL_HALF = 0.055;

/**
 * Surface colour of the pavement at a segment, before any texture is laid
 * over it — regional base, low-frequency tone, repair patch, weather and
 * night all folded in.  ONE stable colour per segment with no stripe term.
 */
export function surfaceColor(seg, palette, snowBlanket = 0) {
  const d    = roadDetail(seg);
  const mat  = d.mat;
  // Regional base.  palette.road is already cross-faded between regions by
  // getPaletteAtProgress, so this carries the smooth regional gradient.
  let c = palette.road ?? palette.road2 ?? 0x5A5A5A;
  // Material character on top of the regional colour (cool / chalky / bleached).
  c = lerpColor(c, mat.tone, mat.toneAmt);
  // Low-frequency wander.  Interpolated across 11-27 segments, so no boundary.
  c = lerpColor(c, d.tone > 0 ? 0xFFFFFF : 0x000000, Math.abs(d.tone));

  // Rain darkens asphalt — wet aggregate reflects specularly instead of
  // diffusely, so the diffuse term drops sharply.
  const rain = Weather.isRain(d.mile) ? Weather.intensity(d.mile) : 0;
  if (rain > 0) c = lerpColor(c, 0x0E1418, 0.30 * rain);

  // Snow: converge on the one snow white (unchanged target — the whiteout is
  // meant to be a whiteout).  Texture and tracks are layered on separately.
  if (snowBlanket > 0) c = lerpColor(c, SNOW_ROAD_WHITE, snowBlanket);

  return c;
}

/** Matches Road.SNOW_WHITE — duplicated here to avoid a circular import. */
export const SNOW_ROAD_WHITE = 0xF4F6F8;

/**
 * Night falloff for the pavement, 0..1 (1 = untouched, lower = darker).
 * Pavement outside the headlight throw goes nearly black at full night; the
 * lit cone in front of the car keeps its value.  Distance-based only — the
 * headlight graphics themselves are a separate additive layer at depth 5.
 */
export function nightFalloff(relZ, mile) {
  const dark = TimeOfDay.darkness(mile);
  if (dark <= 0.001) return 1;
  // Effective low-beam throw.  ~55 m of usable road, then a fast falloff.
  const LIT_Z  = 9000;
  const OFF_Z  = 30000;
  const lit    = 1 - ss((relZ - LIT_Z) / (OFF_Z - LIT_Z));
  // Even fully lit pavement is dimmer at night than under daylight.
  const floor  = 0.16;
  return 1 - dark * (1 - (floor + (1 - floor) * lit));
}

export { ss as smoothstep };
