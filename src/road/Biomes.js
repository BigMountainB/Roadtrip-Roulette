/**
 * Biomes.js — biome-specific parallax backdrop definitions.
 *
 * Replaces the single procedural Cascade range that used to serve the whole
 * route.  That range scaled by mile and then vanished entirely past mile 70,
 * which meant 223 of 293 miles — everything from Cle Elum to Pullman —
 * rendered against bare sky.  It also put snow peaks anywhere the height
 * multiplier happened to be non-zero.
 *
 * The route is now seven distinct places, west to east:
 *
 *   enclosed wet forest -> alpine pass -> drying transition -> dry foothills
 *   -> Columbia basalt gorge -> irrigated agriculture -> Palouse wheat hills
 *
 * SNOW APPEARS IN EXACTLY ONE BIOME (pass_alpine).  If a future band set
 * puts snow east of Snoqualmie it is a bug, not a style choice.
 *
 * Each biome has three textured depth layers that scroll at different
 * rates.  Layers 1 (sky) and 5 (roadside objects) from the original design
 * are NOT here: the sky is already handled by the time-of-day system, and
 * roadside objects are the existing per-region scenery spawner.
 */

/** Band geometry — must match scripts/buildBiomeBands.js and bands.json. */
export const BAND = {
  w: 2048,
  h: 640,
  /** Layers, painted in this order (far first). */
  layers: ['far', 'ridge', 'near'],
  /** How many px of each band are cropped off the BOTTOM before its base is
   *  seated on the horizon.  This is what keeps a tall near-layer from
   *  burying the range behind it — only its crowns clear the horizon.
   *  Cropping rather than seating below the horizon also guarantees the
   *  band never paints over the road, which shares roadGfx's depth. */
  yCrop: { far: 0, ridge: 30, near: 65 },
  /** Horizontal parallax, as a multiple of accumulated road heading.  Far
   *  terrain barely moves; the near treeline sweeps past. */
  rate: { far: 0.06, ridge: 0.14, near: 0.30 },

  /** Screen px each layer's BASE is seated BELOW the horizon (owner 2026-08-10).
   *
   *  Two jobs, one number.
   *
   *  1. DEPTH STAGGER.  Every band PNG is bottom-anchored to row 640, and the
   *     renderer used to seat all three of those edges on the same horizon
   *     line — three silhouettes rooted at one baseline, which is why the
   *     backdrop read as a flat painted wall rather than receding terrain.
   *     Each layer now sits progressively lower than the one behind it.
   *
   *  2. COVERING THE "WATER".  The sky gradient runs to `H() + 14` (Road.js,
   *     `skyH`) and ends in `skyFogMix`, so a ~14 px flat fog-toned strip is
   *     painted across the full width just under the horizon.  With every band
   *     stopping exactly at the horizon, that strip was left exposed beneath
   *     the whole range and read as a lake (owner, at Easton in snow).  EVERY
   *     value here is >14 so the farthest layer already covers it.
   *
   *  Seating a band below the horizon is safe now in a way it wasn't when
   *  yCrop was written: bands are at depth 0.5, under terrain (1) and road
   *  (1.5), so anything hanging below the ground line is painted over by real
   *  ground.  That also hides each band's hard cropped bottom edge. */
  //  SPREAD WIDENED 2026-08-11 (owner: "closer to 20px or maybe 30, as long as
  //  there's no uncovered pixels").  Was 16/22/30 — a 14 px spread — now a
  //  26 px spread across the three bases.
  //
  //  The "no uncovered pixels" constraint is the FAR value specifically: it is
  //  the highest-seated of the three, so it alone decides whether the ~14 px
  //  skyFogMix strip under the horizon stays hidden.  far stays at 16 for that
  //  reason and must never drop to 14 or below.  ridge and near are free to go
  //  lower — bands sit at depth 1.15, under GroundPlane (1.3) and the road
  //  (1.5), so anything hanging below the ground line is painted over by real
  //  perspective-correct ground rather than left showing.
  yOff: { far: 16, ridge: 28, near: 42 },

  /** Per-layer texture zoom, on top of the fit-to-screen scale.
   *
   *  FAR-DOMINANT (owner 2026-08-11: "they need to be spaced out ... through
   *  most of the sky", far highest).  The painted silhouette inside each band
   *  is bottom-anchored and occupies only the lower part of the 640 px canvas
   *  — at Easton the far layer's content is rows 440-640, just 200 of 640.  At
   *  zoom 1 that rendered ~78 px tall, so all three layers topped out between
   *  y 138 and y 163 on a 450 px screen and the entire upper third was empty
   *  sky.  Zooming FAR hardest is what pushes real mass up there.
   *
   *  far is capped at 1.35 by the WORST case, not the best: each biome's art
   *  fills a different amount of its 640 px canvas (Easton's far layer is 200
   *  rows, Seattle's ~397), so one global multiplier cannot suit both.  At 2.2
   *  the tall-art biomes (seattle_hills, kittitas, palouse) pushed their peaks
   *  to y -102/-108/-123 — clipped off the top of the screen.  1.35 is the
   *  most that keeps every biome's crown on screen.
   *
   *  CONSEQUENCE: biomes with short far art (Easton, columbia) still sit lower
   *  than ideal.  Genuinely fixing that needs per-layer scale derived from each
   *  band's MEASURED content height rather than one shared number — see the
   *  2026-08-11 (pt 7) changelog entry.
   *
   *  Size now carries the depth cue as well as position: the big mass is
   *  distant, the near layer stays a low treeline on the horizon, which is how
   *  a real range reads.  near keeps the 1.18 from 2026-08-10 (owner asked for
   *  it to cover more area) — far and ridge simply overtake it.
   *
   *  Exact on-screen height varies by biome, because each band's art fills a
   *  different amount of its canvas.  These are art-tuning knobs; nothing
   *  depends on them being any particular value.
   *
   *  This does NOT change parallax speed: on-screen scroll is
   *  tilePositionX * tileScale, and tilePositionX is divided by the same
   *  scale when it's computed, so the two cancel. */
  zoom: { far: 1.35, ridge: 1.2, near: 1.18 },
};

/** Miles over which adjacent biomes cross-fade.
 *
 *  0.06 mi ≈ 320 ft — about two seconds at highway speed (owner 2026-08-10).
 *  It was 4 MILES, which meant a quarter of the westside-forest stretch was
 *  spent with TWO mountain ranges drawn on top of each other, the incoming one
 *  at partial alpha.  That is what "no layer should be transparent" was about:
 *  at mile 25.18 the North Bend range was painting at 79% over the forest and
 *  the two ghosted through each other.
 *
 *  The old width was chosen so a boundary wouldn't read as a hard cut (the
 *  Easton transition especially was meant to feel like a gradual drying-out).
 *  That trade is now the other way round: the blend is short enough that
 *  nothing is visibly see-through, and long enough that the swap isn't a
 *  single-frame pop.  Do NOT widen this back without re-checking the overlap —
 *  the transparency is proportional to how long two biomes co-exist. */
export const BLEND_MILES = 0.06;

/** Mile at which the first biome starts fading up.
 *
 *  Was 16: below that, `biomeAt` returned null and NOTHING painted the
 *  horizon, because "a forest ridge behind downtown would look absurd."  That
 *  reasoning was about the WRONG ART, not about the urban miles wanting a bare
 *  horizon — it left the below-horizon patch fully exposed through all of
 *  Seattle (owner's mile-1.61 screenshot).  With purpose-made `seattle_hills`
 *  bands the objection is gone, so the route is now covered end to end and
 *  there is no urban gap and no fade-up to perform. */
const URBAN_UNTIL = 0;

/** Per-biome overrides for band height and parallax rate.
 *
 *  north_bend uses hand-made art rather than generated bands, and needs
 *  both: a taller band because Mount Si has to read as a landmark rather
 *  than a horizon strip, and near-zero parallax on the two wedge layers
 *  because those plates are ONE-SHOT framing art that cannot tile.  Scroll
 *  them and you get three Mount Sis across the horizon.  Near-zero is also
 *  physically honest — a peak several miles off barely moves. */
export const BIOME_OVERRIDES = {
  north_bend: {
    h: 1280,
    rate: { far: 0.05, ridge: 0.004, near: 0.006 },
  },
};

/** Band height for a biome (px). */
export function bandHeight(biomeKey) {
  return BIOME_OVERRIDES[biomeKey]?.h ?? BAND.h;
}

/** Parallax rate for a biome's layer. */
export function bandRate(biomeKey, layer) {
  return BIOME_OVERRIDES[biomeKey]?.rate?.[layer] ?? BAND.rate[layer];
}

export const BIOMES = [
  // `tex` is the texture-set name and defaults to `key`.  It exists so a
  // biome can appear twice on the route without duplicating its art — the
  // forest resumes after North Bend using the same bands.
  //
  // Seattle covers mile 0 so the horizon is never unpainted.  These are HILLS
  // behind the city, not a treeline: the downtown/Bellevue silhouettes draw at
  // depth 1.18, IN FRONT of the bands at 1.15, so the skyline still reads as
  // the near thing and the hills sit behind it where they belong.
  { key: 'seattle_hills',      s:   0, e:  20, label: 'Seattle hills' },
  { key: 'westside_forest',    s:  20, e:  26, label: 'West Side forest' },
  // Deliberately exaggerated to 14 miles (real North Bend is a point on the
  // map at mile 32).  Owner's call: a long stretch means the route doesn't
  // need bespoke art every few miles.
  { key: 'north_bend',         s:  26, e:  40, label: 'North Bend / Mount Si' },
  { key: 'westside_forest_2',  s:  40, e:  45, label: 'West Side forest (tail)',
    tex: 'westside_forest' },
  { key: 'pass_alpine',        s:  45, e:  58, label: 'Pass alpine' },
  { key: 'easton_transition',  s:  58, e:  78, label: 'Easton transition' },
  { key: 'kittitas_foothills', s:  78, e: 122, label: 'Kittitas dry foothills' },
  { key: 'vantage_basalt',     s: 122, e: 142, label: 'Vantage basalt / Columbia' },
  { key: 'columbia_irrigated', s: 142, e: 210, label: 'Columbia irrigated ag' },
  { key: 'palouse_hills',      s: 210, e: 293, label: 'Palouse wheat hills' },
];

/** Texture-set name for a biome entry (defaults to its key). */
function texOf(b) { return b.tex ?? b.key; }

/** Texture key for a biome layer.  Matches the generator's output names. */
export function bandKey(biomeKey, layer) {
  return `bio_${biomeKey}_${layer}`;
}

/**
 * Resolve the backdrop for a route mile.
 *
 * Returns `{ a, b, t, alpha }`:
 *   a      biome key to draw underneath
 *   b      biome key to cross-fade in on top (null when not in a blend)
 *   t      0..1 blend weight for `b`
 *   alpha  global fade, <1 only while the first biome rises out of the
 *          urban stretch
 *
 * Returns null when no biome should paint at all (the urban miles).
 */
export function biomeAt(mile) {
  if (mile < URBAN_UNTIL) return null;

  // Global fade-up out of the urban stretch.  The first biome now starts AT
  // mile 0, so this span is empty and the fade is a no-op — guarded because a
  // zero-width span would divide by zero and NaN every band's alpha.
  const _fadeSpan = BIOMES[0].s - URBAN_UNTIL;
  const alpha = _fadeSpan > 0
    ? Math.max(0, Math.min(1, (mile - URBAN_UNTIL) / _fadeSpan))
    : 1;

  // Past the last biome's end (shouldn't happen — it ends at the finish
  // line — but a clamped read beats a null deref if the route ever grows).
  const last = BIOMES[BIOMES.length - 1];
  if (mile >= last.e) return { a: texOf(last), b: null, t: 0, alpha };

  for (let i = 0; i < BIOMES.length; i++) {
    const cur = BIOMES[i];
    if (mile >= cur.e) continue;

    const next = BIOMES[i + 1];
    // Inside the blend window leading into the next biome?
    if (next && mile > cur.e - BLEND_MILES) {
      const t = (mile - (cur.e - BLEND_MILES)) / BLEND_MILES;
      return { a: texOf(cur), b: texOf(next), t: Math.max(0, Math.min(1, t)), alpha };
    }
    return { a: texOf(cur), b: null, t: 0, alpha };
  }
  return { a: texOf(BIOMES[0]), b: null, t: 0, alpha };
}

/** Every texture key the backdrop can ask for — used by the asset manifest
 *  so the preloader doesn't have to know the naming scheme. */
export function allBandKeys() {
  const keys = new Set();
  for (const b of BIOMES) for (const l of BAND.layers) keys.add(bandKey(texOf(b), l));
  return [...keys];
}
