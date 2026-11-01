export const clamp  = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp   = (a, b, t)   => a + (b - a) * t;
export const easeIn = (t)         => t * t;
export const increase = (base, increment, max) => (base + increment) % max;
export const toInt  = Math.round;

/** Project a world-space point to screen space.
 *  Returns sub-pixel float coords — segment-edge stair-stepping at the
 *  rumble strip came from rounding x/y/w to ints per segment, which made
 *  each trapezoid offset by an integer pixel from its neighbor.  fillPoints
 *  / Phaser Graphics accept floats and the GPU handles the AA.
 *
 *  horizonY (optional) — screen-Y of the horizon vanishing point.  The
 *  scaling factor stays at screenH/2 (focal-length pixel scale, NOT a
 *  position).  Cockpit mode passes a higher-up horizon so the road's
 *  vanishing point matches CAM.horizonY; sprites and skyline silhouette
 *  use the same value so all world layers converge to one Y.  Defaults
 *  to screenH/2 for back-compat with callers that don't care. */
export function project(worldX, worldY, worldZ, camX, camY, camZ, camDepth, screenW, screenH, roadW, horizonY) {
  const cz = worldZ - camZ;
  if (cz <= 0) return null;
  const scale = camDepth / cz;
  const hY = horizonY ?? screenH / 2;
  return {
    scale,
    x: (screenW / 2) + scale * (worldX - camX) * screenW / 2,
    y: hY - scale * (worldY - camY) * screenH / 2,
    w: scale * roadW * screenW / 2,
  };
}

/**
 * Draw filled trapezoid on a Phaser Graphics object.
 *
 * Two triangles, NOT fillPoints (owner 2026-11-01, jerky steering at 6-12
 * fps on iPhone).  fillPoints records a closed PATH, and Phaser's WebGL
 * renderer re-triangulates every path with earcut on EVERY frame — the road
 * draws ~5,400 of these per frame, which measured 98% of the iPhone's 134 ms
 * draw time (?perfscan: all Graphics hidden → 3.1 ms).  fillTriangle goes
 * straight to the batch with no triangulation and no per-call point objects.
 * A road trapezoid is a convex quad in order (far-L, far-R, near-R, near-L),
 * so the fan 1-2-3 + 1-3-4 covers exactly the same pixels.
 */
export function fillTrap(g, color, x1, y1, x2, y2, x3, y3, x4, y4, alpha = 1) {
  g.fillStyle(color, alpha);
  g.fillTriangle(x1, y1, x2, y2, x3, y3);
  g.fillTriangle(x1, y1, x3, y3, x4, y4);
}

/** Rumble strip width in pixels given half-road width */
export function rumbleW(w, lanes) { return w / Math.max(6, 2 * lanes); }

/** Lane marker width */
export function laneW(w, lanes) { return w / Math.max(32, 8 * lanes); }

/** Simple seeded pseudo-random (for deterministic segment placement) */
export class SeededRNG {
  constructor(seed = 42) { this.s = seed; }
  next() {
    this.s = (this.s * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (this.s >>> 0) / 0xFFFFFFFF;
  }
  range(lo, hi) { return lo + this.next() * (hi - lo); }
  bool(p = 0.5)  { return this.next() < p; }
  pick(arr)       { return arr[Math.floor(this.next() * arr.length)]; }
}
