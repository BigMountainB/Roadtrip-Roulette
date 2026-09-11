/**
 * Balloon placement with FACE PROTECTION (comic dialogue workshop, 2026-09-10).
 *
 * Pure geometry, no Phaser: the live tile (StoryTile) and — once the pilot
 * passes — the book (ComicReader) share it.  All coordinates are pixels in
 * the caller's space.
 *
 *   layoutBalloon({ size, box, anchor, protect, art, bounds, avoid })
 *     size     { w, h }  the balloon's measured size (text + padding)
 *     box      { x, y, w, h }  the AUTHORED slot (preferred position)
 *     anchor   { x, y } | null  the speaker's mouth point (null = no tail)
 *     protect  [{ x, y, w, h, kind? }]  faces / hands / objects never covered
 *     art      { x, y, w, h }  the art rect (alternate slots hug its corners)
 *     bounds   { x, y, w, h }  the whole tile (gutter slots live between art and bounds)
 *     avoid    [{ x, y, w, h }]  balloons already placed on this panel
 *
 *   → { rect, tail, slot, clean }
 *     rect   final balloon rect
 *     tail   null | { ax, ay, bx, by, tx, ty, clipped }  base A/B on the balloon
 *            edge, tip T — STOPS SHORT of the protected face it points at
 *     slot   'authored' | 'tl' | 'tr' | 'bl' | 'br' | 'gutter-l' | 'gutter-r' | 'forced'
 *     clean  false only when every slot collided and the authored one was
 *            used anyway (the caller should split the copy / the tile)
 *
 * Order of attempts (workshop §D): authored slot → the four art corners →
 * the gutter beside the art → give up (clean:false).  A candidate is rejected
 * when its body overlaps a protect rect or an existing balloon, or when its
 * tail path would cross a protect rect OTHER than the one that holds the
 * anchor (the tail is clipped at that one's edge, never drawn across it).
 */

export const TAIL_STANDOFF = 3;   // px the tail tip stops outside a protected face

export function rectsIntersect(a, b) {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}
const inRect = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
const clampRect = (r, b) => ({
  x: Math.max(b.x, Math.min(b.x + b.w - r.w, r.x)),
  y: Math.max(b.y, Math.min(b.y + b.h - r.h, r.y)),
  w: r.w, h: r.h,
});

/** Segment P→Q vs rect: does the segment pass through the rect's interior? */
export function segmentCrossesRect(p, q, r) {
  if (inRect(p, r) || inRect(q, r)) return true;
  // Liang–Barsky clip.
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

/** Tail base on the balloon edge facing the anchor (same rule the tile and
 *  the book already used: right edge / left edge / bottom edge). */
export function tailBase(rect, anchor, scale = 1) {
  const { x: bx, y: by, w, h } = rect, tx = anchor.x, ty = anchor.y;
  const s = scale;
  // Anchor ABOVE the balloon (a speaker whose balloon had to move beneath
  // them): the tail leaves from the TOP edge, never from the bottom.
  if (ty < by && tx > bx - 8 * s && tx < bx + w + 8 * s) {
    const cx = Math.max(bx + 24 * s, Math.min(bx + w - 24 * s, tx));
    return { ax: cx - 10 * s, ay: by + 1, bx: cx + 10 * s, by: by + 1, edge: 'top' };
  }
  if (tx > bx + w && ty < by + h + 8 * s) {
    const ay = Math.max(by + 12 * s, Math.min(by + h - 26 * s, ty - 8 * s));
    return { ax: bx + w - 1, ay, bx: bx + w - 1, by: ay + 18 * s, edge: 'right' };
  }
  if (tx < bx && ty < by + h + 8 * s) {
    const ay = Math.max(by + 12 * s, Math.min(by + h - 26 * s, ty - 8 * s));
    return { ax: bx + 1, ay, bx: bx + 1, by: ay + 18 * s, edge: 'left' };
  }
  const cx = Math.max(bx + 24 * s, Math.min(bx + w - 24 * s, tx));
  return { ax: cx - 10 * s, ay: by + h - 1, bx: cx + 10 * s, by: by + h - 1, edge: 'bottom' };
}

/** First point along P→Q that enters rect r (null if it never does). */
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
  if (t0 >= t1) return null;
  return { x: p.x + dx * t0, y: p.y + dy * t0, t: t0 };
}

/** Build the tail from `rect` toward `anchor`, clipped so its tip stops
 *  TAIL_STANDOFF px outside the first protected rect it would enter along
 *  the way (normally the speaker's own face).  Returns null when the tail
 *  would have to cross a protected rect that does NOT contain the anchor
 *  (that is a collision → try another slot). */
/** Protected kinds a thin tail may NOT cross on its way to the speaker.  A
 *  tail over a torso, a guitar case or a car is fine; over a face, hands or
 *  the phone it is not (workshop §D: "it may not cross a face"). */
export const TAIL_BLOCKING_KINDS = new Set(['face', 'hands', 'phone']);
const tailBlocks = (r) => r.kind == null || TAIL_BLOCKING_KINDS.has(r.kind);

export function clipTail(rect, anchor, protect = [], scale = 1) {
  const base = tailBase(rect, anchor, scale);
  const mid = { x: (base.ax + base.bx) / 2, y: (base.ay + base.by) / 2 };
  let tip = { x: anchor.x, y: anchor.y }, clipped = false;
  let best = null;
  for (const r of protect) {
    const e = entryPoint(mid, anchor, r);
    if (!e) continue;
    if (!inRect(anchor, r)) { if (tailBlocks(r)) return null; continue; }   // crosses a face on the way to the mouth
    if (!best || e.t < best.t) best = e;
  }
  if (best) {
    const len = Math.hypot(anchor.x - mid.x, anchor.y - mid.y) || 1;
    const back = TAIL_STANDOFF / len;
    tip = { x: mid.x + (anchor.x - mid.x) * Math.max(0, best.t - back), y: mid.y + (anchor.y - mid.y) * Math.max(0, best.t - back) };
    clipped = true;
  }
  return { ax: base.ax, ay: base.ay, bx: base.bx, by: base.by, tx: tip.x, ty: tip.y, edge: base.edge, clipped };
}

/** Candidate slots in the order the workshop asks for. */
export function candidateSlots(box, size, art, bounds, inset = 8, after = null) {
  const out = [{ slot: 'authored', x: box.x, y: box.y }];
  // READING ORDER (owner 2026-09-10): a reply must sit AFTER the balloon it
  // answers — below it, else to its right — never above/left of it.
  if (after) {
    out.push({ slot: 'below', x: after.x, y: after.y + after.h + 6 });
    out.push({ slot: 'right', x: after.x + after.w + 6, y: after.y });
  }
  if (art) {
    const corners = [
      { slot: 'tl', x: art.x + inset, y: art.y + inset },
      { slot: 'tr', x: art.x + art.w - size.w - inset, y: art.y + inset },
      { slot: 'bl', x: art.x + inset, y: art.y + art.h - size.h - inset },
      { slot: 'br', x: art.x + art.w - size.w - inset, y: art.y + art.h - size.h - inset },
    ];
    // A reply prefers the LOW corners so it never jumps back above what it answers.
    out.push(...(after ? [corners[3], corners[2], corners[1], corners[0]] : corners));
  }
  if (bounds && art) {
    // Gutter-hanging: the side bars between the art and the tile edge.
    if (art.x - bounds.x >= 24) out.push({ slot: 'gutter-l', x: bounds.x + 4, y: art.y + inset });
    if (bounds.x + bounds.w - (art.x + art.w) >= 24) out.push({ slot: 'gutter-r', x: art.x + art.w - Math.min(size.w, art.w) + 4 + (bounds.x + bounds.w - (art.x + art.w)) - 8, y: art.y + inset });
  }
  return out;
}

export const CLEARANCE = 4;       // px of daylight required around a balloon

const grow = (r, m) => ({ x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m });

export function layoutBalloon({ size, box, anchor = null, protect = [], art = null, bounds = null, avoid = [], scale = 1, after = null }) {
  const clampTo = bounds ?? art ?? { x: -Infinity, y: -Infinity, w: Infinity, h: Infinity };
  const tryRect = (r) => {
    // Bodies need real clearance: a balloon that touches a face or another
    // balloon by a fraction of a pixel reads as covering it.
    const g = grow(r, CLEARANCE * scale);
    if (protect.some(p => rectsIntersect(g, p))) return null;
    if (avoid.some(a => rectsIntersect(g, a))) return null;
    if (!anchor) return { rect: r, tail: null };
    const tail = clipTail(r, anchor, protect, scale);
    if (!tail) return null;
    return { rect: r, tail };
  };
  for (const c of candidateSlots(box, size, art, bounds, 8, after)) {
    const r = Number.isFinite(clampTo.w) ? clampRect({ x: c.x, y: c.y, w: size.w, h: size.h }, clampTo) : { x: c.x, y: c.y, w: size.w, h: size.h };
    const ok = tryRect(r);
    if (ok) return { ...ok, slot: c.slot, clean: true };
  }
  // Last resort: the authored slot, tail clipped, flagged for the caller.
  const r = Number.isFinite(clampTo.w) ? clampRect({ x: box.x, y: box.y, w: size.w, h: size.h }, clampTo) : { x: box.x, y: box.y, w: size.w, h: size.h };
  const tail = anchor ? (clipTail(r, anchor, protect.filter(p => inRect(anchor, p)), scale)) : null;
  return { rect: r, tail, slot: 'forced', clean: false };
}
