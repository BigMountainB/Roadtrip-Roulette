/**
 * buildCarYawFrames.js — placeholder yaw-frame generator for the
 * billboard-angle spike.
 *
 * Renders a crude but GEOMETRICALLY CORRECT sedan at N yaw angles and
 * writes them as transparent PNGs.  The art is deliberately ugly — flat
 * shaded boxes — because the point is to prove the angle math and the
 * frame-selection code, not the look.  Real photoreal frames drop in by
 * filename with zero code change, PROVIDED they follow the same framing
 * convention (see FRAMING below).
 *
 * FRAMING CONVENTION (real art must match this):
 *   - Every frame shares ONE canvas size and ONE world-space scale.
 *   - The car is centred on its ground footprint centre, NOT fit-to-frame.
 *     A car at 45deg is genuinely wider on screen than a car at 0deg, so
 *     fit-to-frame would silently shrink it and the car would appear to
 *     pulse as it rotated.
 *   - Canvas spans CANVAS_WORLD_W metres at the reference depth.  The game
 *     scales the whole canvas by that constant, so all frames stay
 *     dimensionally consistent with each other.
 *   - Positive yaw = camera sees the car's LEFT flank (car sits to the
 *     RIGHT of the camera).  Negative yaw reuses the same frame flipped
 *     horizontally, so only one side is ever rendered.
 *
 * Usage:  node scripts/buildCarYawFrames.js
 */

import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE    = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, '../public/assets/cars/spike');

// ── Frame set ──────────────────────────────────────────────────────────
// Denser near 0 because that is where most traffic sits and where frame
// popping is most visible.  A car one lane over (3.5 m) reads ~10deg at
// 20 m, ~24deg at 8 m, ~41deg at 4 m — so 0..45 with this spacing covers
// the realistic range.
const YAW_ANGLES = [0, 8, 16, 24, 34, 45];

// ── Canvas + camera ────────────────────────────────────────────────────
const CANVAS_W       = 1024;
const CANVAS_H       = 700;
const CANVAS_WORLD_W = 5.6;    // metres the canvas spans at reference depth
const CAM_DIST       = 14.0;   // metres from car centre
const CAM_HEIGHT     = 1.35;   // eye height, matches a following driver

// The camera axis is HORIZONTAL (no pitch) and the horizon is pinned to the
// exact vertical centre of the frame.  That is not cosmetic: it means the
// Blender equivalent needs shift_x = shift_y = 0, so the two pipelines can't
// silently disagree about where the ground is.  GROUND_Y falls out of the
// projection rather than being dialled in by hand.
const PX_PER_M = CANVAS_W / CANVAS_WORLD_W;
const FOCAL    = PX_PER_M * CAM_DIST;
const HORIZON  = CANVAS_H / 2;
const GROUND_Y = HORIZON + (FOCAL * CAM_HEIGHT) / CAM_DIST;

// ── Light ──────────────────────────────────────────────────────────────
// Upper-left, slightly toward camera.  Real art should match this or the
// frames will strobe between light and dark as the car rotates.
const LIGHT   = norm([-0.45, 0.82, -0.35]);
const AMBIENT = 0.36;

// ── Materials ──────────────────────────────────────────────────────────
const BODY  = [232, 232, 228];   // silver-white, matches codex_beater
const GLASS = [ 42,  48,  56];
const TIRE  = [ 26,  26,  28];
const LAMP  = [192,  24,  24];
const PLATE = [242, 242, 238];

// ── Geometry ───────────────────────────────────────────────────────────
// Car faces +Z, so at yaw 0 the camera (at -Z) sees the REAR.
// Sedan proportions: 4.5 m long, 1.8 m wide, 1.55 m tall.
function buildCar() {
  const parts = [];
  //          cx     cy     cz     w      h      l      colour
  parts.push(box(0, 0.72, 0.00, 1.80, 0.74, 4.50, BODY));   // body
  parts.push(box(0, 1.32, -0.10, 1.62, 0.46, 2.30, GLASS)); // cabin/greenhouse

  // Wheels — boxes, not cylinders.  At this fidelity nobody can tell.
  // Kept wide and tucked close to the body sides; narrow wheels at this
  // scale read as table legs and make the yaw hard to judge.
  for (const sz of [1.45, -1.45]) {
    for (const sx of [0.80, -0.80]) {
      parts.push(box(sx, 0.32, sz, 0.34, 0.64, 0.66, TIRE));
    }
  }

  // Rear detail, nudged just proud of the body's rear face (z = -2.25)
  // so the painter's sort puts them in front rather than z-fighting.
  parts.push(box(0.58, 0.86, -2.28, 0.46, 0.20, 0.04, LAMP));
  parts.push(box(-0.58, 0.86, -2.28, 0.46, 0.20, 0.04, LAMP));
  parts.push(box(0.00, 0.72, -2.28, 0.42, 0.22, 0.04, PLATE));

  return parts.flat();
}

/** Axis-aligned box -> 6 quad faces, each with an outward normal. */
function box(cx, cy, cz, w, h, l, colour) {
  const x0 = cx - w / 2, x1 = cx + w / 2;
  const y0 = cy - h / 2, y1 = cy + h / 2;
  const z0 = cz - l / 2, z1 = cz + l / 2;
  const v = [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
  ];
  const quad = (a, b, c, d, n) => ({ pts: [v[a], v[b], v[c], v[d]], n, colour });
  return [
    quad(0, 1, 2, 3, [0, 0, -1]),   // rear   (faces camera at yaw 0)
    quad(5, 4, 7, 6, [0, 0, 1]),    // front
    quad(4, 0, 3, 7, [-1, 0, 0]),   // left
    quad(1, 5, 6, 2, [1, 0, 0]),    // right
    quad(3, 2, 6, 7, [0, 1, 0]),    // top
    quad(4, 5, 1, 0, [0, -1, 0]),   // bottom
  ];
}

// ── Maths ──────────────────────────────────────────────────────────────
function norm(v) {
  const m = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / m, v[1] / m, v[2] / m];
}

/** Rotate about Y.  Positive theta swings the car's RIGHT flank away from
 *  the camera, so the LEFT flank becomes visible. */
function yawPoint([x, y, z], c, s) {
  return [x * c - z * s, y, x * s + z * c];
}

/** Perspective project.  Camera sits at (0, CAM_HEIGHT, -CAM_DIST) looking
 *  straight down +Z — no pitch, so screen offset stays a pure translation. */
function project([x, y, z]) {
  const vz = z + CAM_DIST;
  const vy = y - CAM_HEIGHT;
  return [CANVAS_W / 2 + (FOCAL * x) / vz, HORIZON - (FOCAL * vy) / vz];
}

function shade(colour, n) {
  const lambert = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
  const k = AMBIENT + (1 - AMBIENT) * lambert;
  const ch = (i) => Math.round(Math.min(255, colour[i] * k));
  return `rgb(${ch(0)},${ch(1)},${ch(2)})`;
}

// ── Render one frame ───────────────────────────────────────────────────
function renderSvg(faces, yawDeg) {
  const th = (yawDeg * Math.PI) / 180;
  const c = Math.cos(th), s = Math.sin(th);

  const drawn = faces.map((f) => {
    const world = f.pts.map((p) => yawPoint(p, c, s));
    const n = yawPoint(f.n, c, s);
    // Painter's algorithm: sort by centroid depth, far first.  Correct for
    // convex boxes, and good enough where boxes don't interpenetrate.
    const depth = world.reduce((a, p) => a + p[2], 0) / world.length;
    return { pts: world.map(project), fill: shade(f.colour, n), depth };
  });
  drawn.sort((a, b) => b.depth - a.depth);

  const polys = drawn
    .map((d) => {
      const pts = d.pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
      return `<polygon points="${pts}" fill="${d.fill}"/>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}">${polys}</svg>`;
}

// ── Main ───────────────────────────────────────────────────────────────
await mkdir(OUT_DIR, { recursive: true });
const faces = buildCar();

for (const yaw of YAW_ANGLES) {
  const tag  = String(yaw).padStart(2, '0');
  const name = `spike_sedan_back_y${tag}.png`;
  const svg  = renderSvg(faces, yaw);
  await sharp(Buffer.from(svg)).png().toFile(resolve(OUT_DIR, name));
  console.log(`  ${name}  yaw ${yaw}deg`);
}

// Emit the framing constants the game needs so the two never drift apart.
const meta = {
  _comment: 'Generated by scripts/buildCarYawFrames.js — do not hand-edit. '
          + 'scripts/render_turntable.py reproduces this exact camera in Blender; '
          + 'any real art must match these numbers or it will not drop in.',
  canvasW: CANVAS_W,
  canvasH: CANVAS_H,
  canvasWorldW: CANVAS_WORLD_W,
  carWorldW: 1.80,
  camDist: CAM_DIST,
  camHeight: CAM_HEIGHT,
  focalPx: FOCAL,
  // Blender equivalents: 36 mm sensor, horizontal fit, zero shift.
  lensMm: (FOCAL * 36) / CANVAS_W,
  groundY: GROUND_Y,
  groundFrac: GROUND_Y / CANVAS_H,
  angles: YAW_ANGLES,
  keyPrefix: 'spike_sedan_back_y',
};
await writeFile(resolve(OUT_DIR, 'frames.json'), JSON.stringify(meta, null, 2));
console.log(`\n${YAW_ANGLES.length} frames + frames.json -> ${OUT_DIR}`);
