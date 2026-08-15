/**
 * ExitPath — the ONE shared world-space representation of a rest-stop
 * freeway exit (owner spec, 2026-08-15).
 *
 * Everything that touches an exit reads THIS module:
 *   • RouteData      — buildExitPlan() positions the sequence on dry road and
 *                      tags each segment with `seg.exitInfo` (the plan).
 *   • Road.js        — samples the plan per segment boundary to paint the
 *                      lane-5 asphalt, marking topology, gore, arrows, and to
 *                      shift the sidewalk / shoulder bands outboard.
 *   • GameScene      — samples the SAME plan for the lateral clamp, the
 *                      lane-5 guidance target, the commitment test, and the
 *                      fully automated post-commitment vehicle motion/heading.
 *
 * The path is parameterized by ABSOLUTE world Z (route position in world
 * units), because that is the one coordinate every consumer already has.
 * Lateral positions are in "x-units": the same normalized lane coordinate as
 * player.x / NPC laneOffset, where ±1.0 is the mainline fog line and one lane
 * is 2/laneCount units wide.  Screen projection happens downstream through
 * Road.sampleSurface(), which is what makes the painted path and the driven
 * path pixel-identical.
 *
 * Phase layout along Z (owner-confirmed distances, world-unit converted):
 *
 *   zTaper ─150ft→ zParallel ─500ft→ zDiverge ─100ft→ zCurve ─~64ft→ zCurveEnd → departure
 *   (lane 5 grows) (full 5th lane)   (gore opens)     (arc turns 82°)  (straight 82° run)
 *
 * The 100 ft "strong right curve" is measured along the PATH ARC, not along
 * the freeway axis — as the heading approaches 90° the Z-advance per path
 * foot collapses, so the curve's Z-extent (~64 ft) comes from numerically
 * integrating the arc at build time into a small lookup table.  The
 * departure continues at the final heading until the car sprite clears the
 * viewport (that completion test lives in GameScene — it depends on the
 * live canvas width and sprite bounds, not on any fixed coordinate).
 */

import { ROUTE_SEGS, SEG_LENGTH, TOTAL_ROUTE_MILES, ROAD_WIDTH } from '../constants.js';

// World units per real-world foot.  Derived, not guessed: the route is
// TOTAL_ROUTE_MILES long over ROUTE_SEGS segments of SEG_LENGTH units
// (≈ 60.76 u/ft — matches the 60 u/ft used by the rumble-groove and
// sidewalk-slab pitch constants in Road.js).
export const UNITS_PER_FOOT =
  (ROUTE_SEGS * SEG_LENGTH) / (TOTAL_ROUTE_MILES * 5280);

// Owner-confirmed phase lengths, in feet.
export const EXIT_FEET = Object.freeze({
  TAPER:    150,   // lane 5 grows from zero width
  PARALLEL: 500,   // full-width exit-only lane beside the freeway
  DIVERGE:  100,   // gore opens; commitment point is the START of this phase
  CURVE:    100,   // strong right turn, measured along the path arc
});

// How far the gore has opened by the END of the divergence, in x-units —
// the lateral gap between the mainline fog line (1.0) and the ramp's inner
// edge.  1.1 ≈ two full lane-widths of grass wedge, a clear physical split.
const GORE_GAP_X = 1.10;

// Final departure heading relative to the freeway.  "Almost 90°" — 82° keeps
// dx/dz finite so the ramp is still expressible as x(z) for painting, while
// reading as a full perpendicular turn on screen.
const HEADING_MAX_DEG = 82;

// Departure paint cap: the painted ramp stops once its centre is this far
// right in x-units (far outside any viewport at any depth).  The CAR's
// motion is not capped — GameScene runs it until the sprite bounds clear
// the screen.
const DEPART_PAINT_MAX_X = 16;

const smooth01 = (t) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

/**
 * Build one exit plan for a rest stop and tag its segments.
 *
 * Dry-road rule: the ENTIRE sequence (taper start → curve end + a departure
 * margin) must sit on segments with no bridge / tunnel / water.  If the
 * default placement (divergence point at the stop's mileage) is blocked, the
 * whole sequence slides EARLIER in small steps (then later, up to +0.3 mi)
 * until a fully dry span is found — the four phase lengths are never
 * compressed unless no dry span exists in the search range, in which case
 * the parallel section shrinks stepwise to a 150 ft floor as a last resort
 * (recorded on the plan as `parallelFeet`).
 *
 * Segments in [taperStart .. curveEnd + departure paint extent] get:
 *   seg.exitInfo          — the shared plan (one object per stop, by reference)
 *   seg.rampStrength      — 0→1 across the taper, held ≈1 through the curve
 *                           (kept for the existing scenery-clearance and
 *                           lateral-clamp consumers)
 *   seg.rampStopId        — stop association (hitchhikers, prompts)
 *   seg._exitFenceRightOff — right-side pasture fence suppressed
 */
export function buildExitPlan(segments, rs) {
  const count = segments.length;
  const segAt = (mi) => {
    const idx = Math.floor((mi / TOTAL_ROUTE_MILES) * count) % count;
    return ((idx % count) + count) % count;
  };
  const isWet = (s) => !!(s?.bridge || s?.tunnel || s?.water);

  const T = EXIT_FEET.TAPER * UNITS_PER_FOOT;
  const D = EXIT_FEET.DIVERGE * UNITS_PER_FOOT;

  // Curve arc → Z-extent (constants-only; integrate once per plan build).
  const { table: curveTable, zExtent: curveZ, endX: curveEndXGain } =
    integrateCurveArc(divergeEndHeadingDeg(D));

  // Departure clearance behind the curve end that must also stay dry (the
  // car is still on-world there while it slides off screen).
  const DEPART_CLEAR = 300 * UNITS_PER_FOOT;

  const tryPlace = (divergeSegIdx, parallelFeet) => {
    const P = parallelFeet * UNITS_PER_FOOT;
    const zDiverge = divergeSegIdx * SEG_LENGTH;
    const zTaper = zDiverge - (T + P);
    const zEnd = zDiverge + D + curveZ + DEPART_CLEAR;
    if (zTaper < 0) return null;
    const s0 = Math.floor(zTaper / SEG_LENGTH);
    const s1 = Math.ceil(zEnd / SEG_LENGTH);
    for (let i = s0; i <= s1; i++) {
      if (isWet(segments[((i % count) + count) % count])) return null;
    }
    return { zTaper, zDiverge, parallelFeet };
  };

  // Search: default spot, then slide earlier in 0.02-mi steps to 1.2 mi,
  // then later to +0.3 mi.  Then (last resort) shrink the parallel lane.
  const homeSeg = segAt(rs.mileage);
  const STEP = Math.max(1, Math.round(0.02 / TOTAL_ROUTE_MILES * count));
  const BACK_MAX = Math.round(1.2 / TOTAL_ROUTE_MILES * count);
  const FWD_MAX  = Math.round(0.3 / TOTAL_ROUTE_MILES * count);
  let placed = null;
  const PARALLEL_TRIES = [EXIT_FEET.PARALLEL, 350, 250, 150];
  outer:
  for (const parallelFeet of PARALLEL_TRIES) {
    placed = tryPlace(homeSeg, parallelFeet);
    if (placed) break;
    for (let k = 1; k * STEP <= BACK_MAX; k++) {
      placed = tryPlace(homeSeg - k * STEP, parallelFeet);
      if (placed) break outer;
    }
    for (let k = 1; k * STEP <= FWD_MAX; k++) {
      placed = tryPlace(homeSeg + k * STEP, parallelFeet);
      if (placed) break outer;
    }
  }
  if (!placed) return null;   // no dry approach exists — no exit painted here

  const P = placed.parallelFeet * UNITS_PER_FOOT;
  const zTaper = placed.zTaper;
  const zParallel = zTaper + T;
  const zDiverge = zParallel + P;
  const zCurve = zDiverge + D;
  const zCurveEnd = zCurve + curveZ;

  const divergeSegIdx = Math.floor(zDiverge / SEG_LENGTH) % count;
  const exitSeg = segments[divergeSegIdx];
  const lanes = exitSeg?.lanes ?? 4;      // mainlineLaneCount — extensible
  const laneX = 2 / lanes;                // one lane in x-units
  const roadScale = exitSeg?.roadScale ?? 1;
  const halfRoadW = (ROAD_WIDTH / 2) * roadScale;   // x-unit → world units

  // Right-turn arrows: world-anchored inside lane 5 — two through the
  // parallel section plus one final arrow just before the gore nose.
  const arrowZs = [
    zParallel + P * 0.18,
    zParallel + P * 0.55,
    zParallel + P * 0.88,
  ];

  const plan = {
    stopId: rs.id,
    stopName: rs.name,
    zTaper, zParallel, zDiverge, zCurve, zCurveEnd,
    lanes, laneX, halfRoadW,
    goreGapX: GORE_GAP_X,
    headingMaxDeg: HEADING_MAX_DEG,
    curveTable,
    curveEndXGain,
    // dx/dz in x-units per world unit during straight-line departure.
    departSlope: Math.tan(HEADING_MAX_DEG * Math.PI / 180) / halfRoadW,
    departPaintMaxX: DEPART_PAINT_MAX_X,
    arrowZs,
    parallelFeet: placed.parallelFeet,
    repositionedSegs: divergeSegIdx - homeSeg,
  };

  // Tag segments.  Departure paint extent: until the ramp centre passes
  // DEPART_PAINT_MAX_X x-units.
  const departPaintZ =
    (DEPART_PAINT_MAX_X - (1 + laneX / 2 + GORE_GAP_X + curveEndXGain / halfRoadW))
    / plan.departSlope;
  const tagEnd = Math.ceil((zCurveEnd + Math.max(0, departPaintZ)) / SEG_LENGTH);
  const tagStart = Math.floor(zTaper / SEG_LENGTH);
  for (let i = tagStart; i <= tagEnd; i++) {
    const seg = segments[((i % count) + count) % count];
    if (!seg) continue;
    seg.exitInfo = plan;
    seg.rampStopId = rs.id;
    const zMid = i * SEG_LENGTH + SEG_LENGTH / 2;
    // Legacy scenery/clamp consumers: 0→1 across the taper, held to curve end.
    const t = Math.max(0, Math.min(1, (zMid - zTaper) / T));
    seg.rampStrength = Math.max(seg.rampStrength ?? 0, zMid > zCurveEnd ? 0.5 : t);
    seg._exitFenceRightOff = true;
  }

  return plan;
}

// Heading at the end of the ease-in-quad divergence: gap = GORE_GAP_X·u²
// over D world units → end slope 2·GAP/D x-units per unit, times the
// canonical half-road width for the world-space angle.  (Per-stop roadScale
// differences are ±5%; one shared constant keeps the table simple.)
function divergeEndHeadingDeg(D) {
  const slope = (2 * GORE_GAP_X) / D * (ROAD_WIDTH / 2);
  return Math.atan(slope) * 180 / Math.PI;
}

/**
 * Numerically integrate the 100 ft curve arc: heading ramps from the
 * divergence-end heading to HEADING_MAX_DEG over the arc length; X and Z
 * advance by sin/cos of the heading.  Returns a lookup table of
 * { z, x, headingDeg } rows (z/x in world units relative to curve start)
 * plus the total Z extent and X gain.
 */
function integrateCurveArc(theta0Deg) {
  const A = EXIT_FEET.CURVE * UNITS_PER_FOOT;
  const N = 48;
  const da = A / N;
  const t0 = theta0Deg * Math.PI / 180;
  const t1 = HEADING_MAX_DEG * Math.PI / 180;
  const table = [{ z: 0, x: 0, headingDeg: theta0Deg }];
  let z = 0, x = 0;
  for (let i = 1; i <= N; i++) {
    const aMid = (i - 0.5) * da;
    // Progressive ramp — turns harder as it goes, like a real ramp radius
    // tightening off the gore.
    const th = t0 + (t1 - t0) * Math.pow(aMid / A, 1.25);
    z += Math.cos(th) * da;
    x += Math.sin(th) * da;
    const thEnd = t0 + (t1 - t0) * Math.pow((i * da) / A, 1.25);
    table.push({ z, x, headingDeg: thEnd * 180 / Math.PI });
  }
  return { table, zExtent: z, endX: x };
}

/**
 * Sample the shared exit path at an absolute world Z.
 *
 * Returns null before the taper start, else:
 *   phase       'taper' | 'parallel' | 'diverge' | 'curve' | 'depart'
 *   grow        lane-5 width fraction, 0..1 (1 from parallel onward)
 *   gapX        gore gap between mainline fog line and ramp inner edge (x-units)
 *   innerX      ramp/lane-5 inner edge (x-units; 1.0 until the gore opens)
 *   outerX      ramp/lane-5 outer edge — where the outside fog line lives
 *   centerX     exit-lane / ramp centreline (the guidance + automation target)
 *   halfLaneX   half of the DRAWN lane width at this Z (perspective-corrected
 *               for heading so the near-perpendicular ramp keeps its width)
 *   headingDeg  path tangent angle vs the freeway axis (0 = parallel)
 *   dxdz        d(centerX)/dZ in x-units per world unit (tangent slope)
 */
export function sampleExitPlan(plan, absZ) {
  if (!plan) return null;
  const { zTaper, zParallel, zDiverge, zCurve, zCurveEnd, laneX } = plan;
  if (absZ < zTaper) return null;
  const halfLane = laneX / 2;

  if (absZ < zParallel) {
    const grow = smooth01((absZ - zTaper) / (zParallel - zTaper));
    const w = laneX * grow;
    return {
      phase: 'taper', grow, gapX: 0,
      innerX: 1, outerX: 1 + w, centerX: 1 + w / 2,
      halfLaneX: w / 2, headingDeg: 0, dxdz: 0,
    };
  }
  if (absZ < zDiverge) {
    return {
      phase: 'parallel', grow: 1, gapX: 0,
      innerX: 1, outerX: 1 + laneX, centerX: 1 + halfLane,
      halfLaneX: halfLane, headingDeg: 0, dxdz: 0,
    };
  }
  if (absZ < zCurve) {
    const D = zCurve - zDiverge;
    const u = (absZ - zDiverge) / D;
    const gap = plan.goreGapX * u * u;           // ease-in-quad: clean gore nose
    const dxdz = (2 * plan.goreGapX * u) / D;
    const heading = Math.atan(dxdz * plan.halfRoadW) * 180 / Math.PI;
    return {
      phase: 'diverge', grow: 1, gapX: gap,
      innerX: 1 + gap, outerX: 1 + laneX + gap, centerX: 1 + halfLane + gap,
      halfLaneX: halfLane / Math.max(0.5, Math.cos(heading * Math.PI / 180)),
      headingDeg: heading, dxdz,
    };
  }

  // Base centreline offset at the start of the curve.
  const baseCenter = 1 + halfLane + plan.goreGapX;

  if (absZ < zCurveEnd) {
    const zRel = absZ - zCurve;
    const t = plan.curveTable;
    // Rows are monotonic in z — linear scan is fine (≤ 49 rows).
    let row = t[t.length - 1], prev = t[0];
    for (let i = 1; i < t.length; i++) {
      if (t[i].z >= zRel) { row = t[i]; prev = t[i - 1]; break; }
    }
    const span = (row.z - prev.z) || 1;
    const f = Math.max(0, Math.min(1, (zRel - prev.z) / span));
    const xGain = (prev.x + (row.x - prev.x) * f) / plan.halfRoadW;
    const heading = prev.headingDeg + (row.headingDeg - prev.headingDeg) * f;
    const cos = Math.max(0.12, Math.cos(heading * Math.PI / 180));
    return {
      phase: 'curve', grow: 1, gapX: plan.goreGapX + xGain,
      innerX: 1 + plan.goreGapX + xGain,
      outerX: 1 + laneX + plan.goreGapX + xGain,
      centerX: baseCenter + xGain,
      halfLaneX: Math.min(halfLane * 3.2, halfLane / Math.max(0.32, cos)),
      headingDeg: heading,
      dxdz: Math.tan(heading * Math.PI / 180) / plan.halfRoadW,
    };
  }

  // Straight-line departure at the final heading.
  const xGain = plan.curveEndXGain / plan.halfRoadW
    + plan.departSlope * (absZ - zCurveEnd);
  return {
    phase: 'depart', grow: 1, gapX: plan.goreGapX + xGain,
    innerX: 1 + plan.goreGapX + xGain,
    outerX: 1 + laneX + plan.goreGapX + xGain,
    centerX: baseCenter + xGain,
    halfLaneX: Math.min(halfLane * 3.2, halfLane / 0.32),
    headingDeg: plan.headingMaxDeg,
    dxdz: plan.departSlope,
  };
}
