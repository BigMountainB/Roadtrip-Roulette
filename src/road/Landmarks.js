/**
 * Landmarks.js — distance-projected scenery landmarks (Mount Si, etc).
 *
 * A landmark is a single image placed at a real position relative to the
 * route: how far ALONG it sits, how far OFF to the side, and how tall it is.
 * Everything else — apparent size, lateral drift, the way it accelerates and
 * sweeps past as you close on it — falls out of the geometry rather than
 * being hand-animated:
 *
 *     dz   = mile - playerMile          miles ahead
 *     dx   = lateral                    miles off the highway
 *     dist = hypot(dz, dx)
 *     x    = horizon + (dx / dz) * FOCAL_X
 *     size = FOCAL_Y * heightMi / dist
 *
 * Far off, `dist` is huge and `dx/dz` is tiny: small, parked near the
 * vanishing point, barely moving.  As dz shrinks, dx/dz climbs and the thing
 * swings toward the screen edge, faster and faster, while growing.  That
 * acceleration is not tuned; it is what the ratio does.
 *
 * WHY NOT THE EXISTING SPRITE SYSTEM: roadside sprites project through the
 * segment array, which culls at 76,000 units.  A mile is ~320,800 units, so
 * that pipeline sees about a QUARTER MILE.  A peak needs to be visible from
 * fifteen, so landmarks need their own projection. They are not scenery
 * sprites and cannot use the same path.
 *
 * LATERAL MOTION IS AN ANGLE, NOT A RATIO.  An earlier version used
 * x = (lateral / dz) * FOCAL, which explodes as dz approaches zero: a peak
 * would creep, then whip off the edge within a mile or two.  Real distant
 * terrain drifts at a few percent of the road's scroll rate and stays in
 * frame for ten miles or more.
 *
 * Using the BEARING to the landmark instead, angle = atan2(lateral, dz), the
 * term is bounded (-pi..pi), has no singularity, and keeps advancing
 * smoothly as dz passes through zero and goes negative.  That is what lets a
 * peak slide off behind you while SHRINKING — dist = hypot(dz, lateral)
 * grows symmetrically once you are past it — rather than looming and
 * vanishing at the frame edge.
 *
 * LATERAL_GAIN then scales the whole drift down to the 2-5%-of-road-speed
 * band that reads as "many miles away".
 */

import { SCREEN_W, SCREEN_H } from '../constants.js';

// Derived from the road's own pseudo-3D projection so landmarks and road
// share one perspective: px = CAM.depth * worldX * (W/2) / z.
const CAM_DEPTH = 0.84;
export const FOCAL_X = CAM_DEPTH * (SCREEN_W / 2);
export const FOCAL_Y = CAM_DEPTH * (SCREEN_H / 2);

/** Global damping on lateral drift.  Lower = more distant-feeling. */
export const LATERAL_GAIN = 0.62;

export const LANDMARKS = [
  // `mile` is the CLOSEST-APPROACH point; visibleFrom / fadeOutAt are miles
  // before and after it, so each window is roughly 8-12 miles with the
  // neighbours overlapping.  `lateral` is miles off the highway, negative =
  // LEFT.  Bigger lateral = slower drift and gentler growth.
  { key: 'landmark_mount_si',         name: 'Mount Si',
    mile: 33,   lateral: -3.0, heightMi: 0.70, visibleFrom: 5.0, fadeOutAt: -5.0, boost: 1.5 },
  { key: 'landmark_mount_washington', name: 'Mount Washington / Cedar Butte',
    mile: 36,   lateral:  3.4, heightMi: 0.55, visibleFrom: 4.0, fadeOutAt: -4.0, boost: 1.2 },
  { key: 'landmark_mcclellan_butte',  name: 'McClellan Butte',
    mile: 41.5, lateral: -1.8, heightMi: 0.82, visibleFrom: 5.5, fadeOutAt: -5.5, boost: 1.6 },
  { key: 'landmark_granite_mtn',      name: 'Granite Mountain / Bandera',
    mile: 48,   lateral:  3.8, heightMi: 0.78, visibleFrom: 4.5, fadeOutAt: -4.5, boost: 1.4 },
  // Snoqualmie Mountain and Guye Peak share one plate (they sit together at
  // the pass), so this is a single landmark rather than two.
  { key: 'landmark_snoqualmie_mtn',   name: 'Snoqualmie Mtn / Guye Peak',
    mile: 51.5, lateral: -2.2, heightMi: 0.88, visibleFrom: 5.0, fadeOutAt: -5.0, boost: 1.5 },
];

/**
 * Project a landmark for the current route mile.
 * Returns null when it should not be drawn at all.
 */
export function projectLandmark(lm, playerMile, horizonX, horizonY) {
  const dz = lm.mile - playerMile;
  if (dz > lm.visibleFrom) return null;
  if (dz < lm.fadeOutAt) return null;

  // Bearing, not ratio — bounded and continuous through dz === 0.
  const ang  = Math.atan2(lm.lateral, dz);
  const dist = Math.hypot(dz, lm.lateral);

  const x = horizonX + ang * FOCAL_X * LATERAL_GAIN;
  const h = (FOCAL_Y * lm.heightMi / dist) * (lm.boost ?? 1);

  // Symmetric fades at both ends of the window so neighbouring peaks
  // overlap rather than hand off at a hard line.
  const fadeIn  = lm.visibleFrom * 0.35;
  const fadeOut = Math.abs(lm.fadeOutAt) * 0.35;
  let alpha = 1;
  if (dz > lm.visibleFrom - fadeIn)  alpha = (lm.visibleFrom - dz) / fadeIn;
  if (dz < lm.fadeOutAt + fadeOut)   alpha = Math.min(alpha, (dz - lm.fadeOutAt) / fadeOut);

  // BEHIND EVERYTHING (0.40-0.46).  Peaks previously sat at 1.38, above the
  // parallax bands, which put them in front of the backdrop treelines — a
  // snowy summit painted over the near forest.  Distant terrain has to be
  // the furthest thing in the frame.
  //
  // NOTE this reverses the earlier "never occlude a hero peak behind the
  // hills" rule for the North Bend base plate (1.25), whose hills will now
  // cover a peak.  Nothing else changes: the plate only exists miles 26-40.
  // If a peak needs to beat the plate specifically, the fix is to punch the
  // plate's hill line rather than to lift every landmark back over the
  // treelines.
  const depth = 0.46 - Math.min(1, dist / 12) * 0.06;

  return { x, y: horizonY, h, alpha: Math.max(0, Math.min(1, alpha)), depth, dist };
}

/** Landmarks that could be on screen now, nearest last so they paint on top. */
export function activeLandmarks(playerMile) {
  return LANDMARKS
    .filter(lm => {
      const dz = lm.mile - playerMile;
      return dz <= lm.visibleFrom && dz >= lm.fadeOutAt;
    })
    .sort((a, b) => (b.mile - playerMile) - (a.mile - playerMile));
}
