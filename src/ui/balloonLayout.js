/**
 * Balloon placement — RANKED ZONES, reading order, narrow routed tails and
 * linked balloons (owner directive, working notes §"OWNER DIRECTIVE — RANKED
 * PLACEMENT ZONES, LINKED BALLOONS, AND VISUAL VARIETY", 2026-09-10).
 *
 * Pure geometry, no Phaser: the live tile (StoryTile) and the book
 * (ComicReader) share it.  Coordinates are pixels in the caller's space.
 *
 * ZONES — a panel is not "protected vs available"; it is ranked:
 *   Level 1  faces / heads      absolute exclusion (body, text, tail, caption,
 *                               tray, sfx — nothing covers a face; a tail stops
 *                               outside it).  Infinite cost → reject.
 *   Level 2  essential bodies + story objects (hands, phone, instrument, name
 *                               tag, cooler, damage, weapon…)  very high cost;
 *                               only after negative space and Level 3 failed,
 *                               and only a small overlap.
 *   Level 3  ordinary scene detail (architecture, sky, shelves, pavement,
 *                               nonessential car surfaces)  modest cost — the
 *                               first material the engine may sacrifice.
 *   Level 0  unmarked negative space  zero cost — always tried first.
 *
 * A zone: { level, kind, x, y, w, h, speaker? }.  `migrateZones()` classifies
 * legacy `protect` rects by kind so old metadata keeps working.
 *
 * READING ORDER — the balloon nearest the upper-left reads first; a later
 * balloon may sit to the RIGHT in the same band, or ANYWHERE in a lower band.
 * Never above, never meaningfully farther left within the band.
 *
 * TAILS — length is unrestricted; WIDTH is constrained: base ≤ 1.25 × the
 * rendered line-height (hard ceiling 1.75 ×), connectors ≤ 0.75 ×.  A straight
 * tail that would cross a face is ROUTED with one bend through negative space
 * or Level 3, never broadened.  Collision uses the narrow polygon's own lines.
 *
 * API
 *   layoutBalloon({ size, box, anchor, zones, art, bounds, avoid, after,
 *                   lineH, connectorFrom })
 *   → { rect, tail, connector, slot, clean, exception, cost, l2, l3, order }
 *     rect        final balloon rect
 *     tail        null | { ax, ay, bx, by, tx, ty, via?, baseW, clipped }
 *     connector   null | { from, to, width }  (bridge to the previous balloon)
 *     slot        'authored' | 'grid' | 'exception'
 *     clean       zero Level-1 AND zero Level-2 overlap (body + tail + bridge)
 *     exception   no face-free placement existed at all (caller must split)
 *     l2 / l3     overlap fractions of the balloon body with those levels
 *     order       true when reading order vs `after` holds
 */

export const FACE_MARGIN     = 3;      // px safety margin around a face
export const CLEARANCE       = 4;      // px of daylight between balloons
export const TAIL_STANDOFF   = 3;      // px the tail tip stops outside a face
export const TAIL_BASE_TARGET  = 1.0;  // × line-height (owner: ≤ ~1.25; kept slender)
export const TAIL_BASE_CEILING = 1.75; // × line-height (QA fails above this)
export const CONNECTOR_WIDTH   = 0.75; // × line-height
export const COST_L2 = 600, COST_L3 = 6, COST_TAIL_L2 = 40, COST_TAIL_L3 = 8;   // Level 2 is a LAST resort

const LEVEL_BY_KIND = { face: 1, head: 1, hands: 2, phone: 2, body: 2, object: 2, car: 2, instrument: 2, cargo: 2, damage: 2, weapon: 2, clue: 2, sceneDetail: 3, scene: 3, sky: 3, pavement: 3, shelves: 3, architecture: 3 };

/** Legacy `protect` rects → ranked zones (kind decides the level; an
 *  explicit `level` wins; an unkinded rect is treated as Level 2). */
export function migrateZones(protect = [], zones = []) {
  const out = [];
  for (const r of protect ?? []) out.push({ ...r, level: r.level ?? LEVEL_BY_KIND[r.kind] ?? 2 });
  for (const z of zones ?? []) out.push({ ...z, level: z.level ?? LEVEL_BY_KIND[z.kind] ?? 2 });
  return out;
}

export function rectsIntersect(a, b) {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}
export function overlapArea(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}
const inRect = (p, r) => !!r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
const grow = (r, m) => ({ ...r, x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m });
const clampRect = (r, b) => ({ ...r, x: Math.max(b.x, Math.min(b.x + b.w - r.w, r.x)), y: Math.max(b.y, Math.min(b.y + b.h - r.h, r.y)) });

/** Segment P→Q vs rect (Liang–Barsky). */
export function segmentCrossesRect(p, q, r) {
  if (inRect(p, r) || inRect(q, r)) return true;
  let t0 = 0, t1 = 1;
  const dx = q.x - p.x, dy = q.y - p.y;
  const checks = [[-dx, p.x - r.x], [dx, r.x + r.w - p.x], [-dy, p.y - r.y], [dy, r.y + r.h - p.y]];
  for (const [den, num] of checks) {
    if (den === 0) { if (num < 0) return false; continue; }
    const t = num / den;
    if (den < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
    else         { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return t0 < t1;
}
function entryPoint(p, q, r) {
  const dx = q.x - p.x, dy = q.y - p.y;
  let t0 = 0, t1 = 1;
  const checks = [[-dx, p.x - r.x], [dx, r.x + r.w - p.x], [-dy, p.y - r.y], [dy, r.y + r.h - p.y]];
  for (const [den, num] of checks) {
    if (den === 0) { if (num < 0) return null; continue; }
    const t = num / den;
    if (den < 0) { if (t > t1) return null; if (t > t0) t0 = t; }
    else         { if (t < t0) return null; if (t < t1) t1 = t; }
  }
  return t0 < t1 ? { x: p.x + dx * t0, y: p.y + dy * t0, t: t0 } : null;
}

/** Tail base on the balloon edge facing the anchor: top / right / left / bottom. */
export function tailBase(rect, anchor, lineH = 16) {
  const { x: bx, y: by, w, h } = rect, tx = anchor.x, ty = anchor.y;
  const half = Math.min(TAIL_BASE_TARGET * lineH, Math.max(w, h) * 0.3) / 2;
  if (ty < by && tx > bx - 8 && tx < bx + w + 8) {
    const cx = Math.max(bx + half + 6, Math.min(bx + w - half - 6, tx));
    return { ax: cx - half, ay: by + 1, bx: cx + half, by: by + 1, edge: 'top', baseW: half * 2 };
  }
  if (tx > bx + w && ty < by + h + 8) {
    const cy = Math.max(by + half + 6, Math.min(by + h - half - 6, ty));
    return { ax: bx + w - 1, ay: cy - half, bx: bx + w - 1, by: cy + half, edge: 'right', baseW: half * 2 };
  }
  if (tx < bx && ty < by + h + 8) {
    const cy = Math.max(by + half + 6, Math.min(by + h - half - 6, ty));
    return { ax: bx + 1, ay: cy - half, bx: bx + 1, by: cy + half, edge: 'left', baseW: half * 2 };
  }
  const cx = Math.max(bx + half + 6, Math.min(bx + w - half - 6, tx));
  return { ax: cx - half, ay: by + h - 1, bx: cx + half, by: by + h - 1, edge: 'bottom', baseW: half * 2 };
}

/** Clip the tip of the last leg so it stops TAIL_STANDOFF outside the first
 *  Level-1 zone it enters (the speaker's face). */
function clipTip(from, anchor, faces) {
  let best = null;
  for (const r of faces) { const e = entryPoint(from, anchor, r); if (e && (!best || e.t < best.t)) best = e; }
  if (!best) return { tip: { x: anchor.x, y: anchor.y }, clipped: false };
  const len = Math.hypot(anchor.x - from.x, anchor.y - from.y) || 1;
  const t = Math.max(0, best.t - TAIL_STANDOFF / len);
  return { tip: { x: from.x + (anchor.x - from.x) * t, y: from.y + (anchor.y - from.y) * t }, clipped: true };
}

/** Score a tail's legs against zones/avoid: returns { l1, l2, l3, crossesBalloon }. */
function legCost(legs, zones, avoid, ignore) {
  let l1 = 0, l2 = 0, l3 = 0, bal = 0;
  for (const [p, q] of legs) {
    for (const z of zones) {
      if (z === ignore) continue;
      if (!segmentCrossesRect(p, q, z.level === 1 ? grow(z, FACE_MARGIN) : z)) continue;
      if (z.level === 1) l1++; else if (z.level === 2) l2++; else l3++;
    }
    for (const a of avoid) if (segmentCrossesRect(p, q, grow(a, 1))) bal++;
  }
  return { l1, l2, l3, crossesBalloon: bal };
}

/** Build the narrowest legal tail from `rect` to `anchor`: straight first,
 *  then routed with one bend (perpendicular offsets) when the straight line
 *  would cross a face or another balloon.  Returns null when no route exists. */
export function buildTail(rect, anchor, zones, avoid, lineH = 16) {
  const base = tailBase(rect, anchor, lineH);
  const mid = { x: (base.ax + base.bx) / 2, y: (base.ay + base.by) / 2 };
  const faces = zones.filter(z => z.level === 1);
  const anchorFace = faces.find(f => inRect(anchor, f)) ?? null;
  const others = zones.filter(z => z !== anchorFace);
  const tryRoute = (via) => {
    const last = via ?? mid;
    const { tip, clipped } = clipTip(last, anchor, anchorFace ? [anchorFace] : faces);
    const legs = via ? [[mid, via], [via, tip]] : [[mid, tip]];
    const c = legCost(legs, others, avoid, null);
    if (c.l1 || c.crossesBalloon) return null;
    // The tip must not have crossed a face that isn't the speaker's.
    return { ax: base.ax, ay: base.ay, bx: base.bx, by: base.by, tx: tip.x, ty: tip.y, edge: base.edge, baseW: base.baseW, via: via ?? null, clipped, l2: c.l2, l3: c.l3 };
  };
  const straight = tryRoute(null);
  if (straight) return straight;
  // One bend: perpendicular offsets at the midpoint, nearest first.
  const dx = anchor.x - mid.x, dy = anchor.y - mid.y, L = Math.hypot(dx, dy) || 1;
  const px = -dy / L, py = dx / L;
  const m = { x: (mid.x + anchor.x) / 2, y: (mid.y + anchor.y) / 2 };
  for (const off of [30, -30, 60, -60, 90, -90, 130, -130]) {
    const via = { x: m.x + px * off, y: m.y + py * off };
    if (faces.some(f => inRect(via, grow(f, FACE_MARGIN)))) continue;
    const r = tryRoute(via);
    if (r) return r;
  }
  return null;
}

/** Reading order vs the previous balloon: a later balloon may sit to the
 *  right in the same band, or anywhere in a LOWER band — never above, never
 *  meaningfully farther left within the band. */
export function readsAfter(rect, after) {
  if (!after) return true;
  // Same band definition as readingOrder(): the balloon's centre inside the
  // previous balloon's vertical span → same band (must be to the right);
  // below that span → a new band (anywhere); above it → never.
  const cy = rect.y + rect.h / 2, acy = after.y + after.h / 2;
  const sameBand = (cy >= after.y && cy <= after.y + after.h) || (acy >= rect.y && acy <= rect.y + rect.h);
  if (sameBand) return rect.x >= after.x + after.w * 0.5;
  return cy > acy;
}

/** Geometric reading order of a set of rects (bands top→bottom, left→right). */
export function readingOrder(rects) {
  const items = rects.map((r, i) => ({ r, i, cy: r.y + r.h / 2 })).sort((a, b) => a.cy - b.cy);
  const bands = [];
  for (const it of items) {
    const band = bands.at(-1);
    // Joins the current band when its centre falls inside ANY band member's
    // vertical span, or a member's centre falls inside its own span (the same
    // symmetric test readsAfter() uses).
    const joins = band && band.some(m => (it.cy >= m.r.y && it.cy <= m.r.y + m.r.h) || (m.cy >= it.r.y && m.cy <= it.r.y + it.r.h));
    if (joins) band.push(it); else bands.push([it]);
  }
  return bands.flatMap(b => b.sort((a, c) => a.r.x - c.r.x).map(o => o.i));
}

export function layoutBalloon({ size, box, anchor = null, zones = [], protect = null, art = null, bounds = null, avoid = [], after = null, lineH = 16, connectorFrom = null, scale = 1 }) {
  const Z = protect ? migrateZones(protect, zones) : zones;
  const B = bounds ?? art ?? { x: -1e9, y: -1e9, w: 2e9, h: 2e9 };
  const faces = Z.filter(z => z.level === 1);
  const area = size.w * size.h || 1;
  const fit = (r) => clampRect({ x: r.x, y: r.y, w: size.w, h: size.h }, B);

  const why = [];
  const evaluate = (r, slot) => {
    const g = grow(r, CLEARANCE * scale);
    // Level 1: never.  Other balloons: never.
    if (faces.some(f => rectsIntersect(g, grow(f, FACE_MARGIN)))) { if (slot === 'authored') why.push('face'); return null; }
    if (avoid.some(a => rectsIntersect(g, a))) { if (slot === 'authored') why.push('balloon'); return null; }
    let l2 = 0, l3 = 0;
    for (const z of Z) { if (z.level === 2) l2 += overlapArea(r, z); else if (z.level === 3) l3 += overlapArea(r, z); }
    l2 = Math.min(1, l2 / area); l3 = Math.min(1, l3 / area);
    let tail = null, tailCost = 0;
    if (anchor) {
      tail = buildTail(r, anchor, Z, avoid, lineH);
      if (!tail) { if (slot === 'authored') why.push('tail'); return null; }
      tailCost = tail.l2 * COST_TAIL_L2 + tail.l3 * COST_TAIL_L3 + (tail.via ? 3 : 0);
    }
    let connector = null, connCost = 0;
    if (connectorFrom) {
      const c = buildConnector(connectorFrom, r, Z, avoid, lineH);
      if (!c) { if (slot === 'authored') why.push('connector'); return null; }
      connector = c; connCost = c.l2 * COST_TAIL_L2 + c.l3 * COST_TAIL_L3;
    }
    const order = readsAfter(r, after);
    const dist = Math.hypot(r.x - box.x, r.y - box.y);
    const cost = l2 * COST_L2 + l3 * COST_L3 + tailCost + connCost + (order ? 0 : 1e6) + dist * 0.02 + (tail ? Math.hypot(tail.tx - (tail.ax + tail.bx) / 2, tail.ty - (tail.ay + tail.by) / 2) * 0.004 : 0);
    return { rect: r, tail, connector, slot, l2, l3, order, cost, clean: l2 === 0 && (tail?.l2 ?? 0) === 0 && (connector?.l2 ?? 0) === 0 };
  };

  let best = null;
  const consider = (r, slot) => { const e = evaluate(fit(r), slot); if (e && (!best || e.cost < best.cost)) best = e; };
  // 1. the authored slot; 2. small NUDGES around it (an authored slot that
  //    misses a face margin by a few px keeps its intent); 3. a grid over
  //    the safe bounds (24 px), scored.
  consider(box, 'authored');
  if (!best || !best.clean || !best.order) {
    for (const dy of [8, -8, 16, -16, 24, 32, -24]) for (const dx of [0, 12, -12, 24, -24, 40, -40]) consider({ x: box.x + dx, y: box.y + dy }, 'nudged');
  }
  if (!best || !best.clean || !best.order) {
    const step = Math.max(16, Math.round(24 * scale));
    for (let y = B.y; y + size.h <= B.y + B.h + 0.5; y += step)
      for (let x = B.x; x + size.w <= B.x + B.w + 0.5; x += step) consider({ x, y }, 'grid');
    // the far edges too
    consider({ x: B.x + B.w - size.w, y: B.y }, 'grid'); consider({ x: B.x, y: B.y + B.h - size.h }, 'grid'); consider({ x: B.x + B.w - size.w, y: B.y + B.h - size.h }, 'grid');
  }
  if (best && best.order) return { ...best, exception: false, why };
  if (best) return { ...best, exception: false, order: false, why };
  // No face-free placement at all: report an exception.  The caller must
  // split the copy or the tile; we still return the authored rect (never
  // drawn over a face by the callers — they check `exception`).
  const r = fit(box);
  return { rect: r, tail: null, connector: null, slot: 'exception', l2: 0, l3: 0, order: readsAfter(r, after), cost: Infinity, clean: false, exception: true, why };
}

/** Bridge between a previous balloon and this one (same speaker): a narrow
 *  connector from the nearest edge midpoint to the nearest edge midpoint. */
export function buildConnector(from, to, zones, avoid, lineH = 16) {
  const width = CONNECTOR_WIDTH * lineH;
  const fc = { x: from.x + from.w / 2, y: from.y + from.h / 2 }, tc = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
  const edgePt = (r, toward) => {
    const dx = toward.x - (r.x + r.w / 2), dy = toward.y - (r.y + r.h / 2);
    if (Math.abs(dx) * r.h > Math.abs(dy) * r.w) return { x: dx > 0 ? r.x + r.w : r.x, y: Math.max(r.y + 6, Math.min(r.y + r.h - 6, r.y + r.h / 2 + dy * 0.3)) };
    return { x: Math.max(r.x + 6, Math.min(r.x + r.w - 6, r.x + r.w / 2 + dx * 0.3)), y: dy > 0 ? r.y + r.h : r.y };
  };
  const a = edgePt(from, tc), b = edgePt(to, fc);
  // Step 2 px off both edges so the bridge's own endpoints never count as
  // "inside" the balloons it joins; exclude those two rects by geometry.
  const same = (r1, r2) => r1 && r2 && Math.abs(r1.x - r2.x) < 0.5 && Math.abs(r1.y - r2.y) < 0.5 && Math.abs(r1.w - r2.w) < 0.5 && Math.abs(r1.h - r2.h) < 0.5;
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
  const a2 = { x: a.x + dx / L * 2, y: a.y + dy / L * 2 }, b2 = { x: b.x - dx / L * 2, y: b.y - dy / L * 2 };
  const c = legCost([[a2, b2]], zones, avoid.filter(x => !same(x, from) && !same(x, to)), null);
  if (c.l1 || c.crossesBalloon) return null;
  return { from: a, to: b, width, l2: c.l2, l3: c.l3 };
}
