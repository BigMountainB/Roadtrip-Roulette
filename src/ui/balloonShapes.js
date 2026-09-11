/**
 * Balloon VOCABULARY — scalable construction geometry (owner-approved comic
 * direction, working notes §"Balloon vocabulary and scalable construction
 * geometry", 2026-09-09).  Pure geometry shared by the live tile (Phaser
 * Graphics) and the book (canvas 2D) so both presentations draw the same
 * shapes from the same numbers.
 *
 *   U = min(panelWidth, panelHeight) / 100        (design unit)
 *
 * Kinds (authored per line as `kind`; default 'speech'):
 *   speech     white organic rounded balloon, outline 0.75U (≥2px), tail 14–22U, base 6–9U
 *   player     warm cream, subtly boxier silhouette (never colour alone)
 *   whisper    dashed outline 0.65U, dash 2.5U / gap 1.75U (≈1.4:1)
 *   phone      squared body, filled zig-zag tail 16–24U, 3 bends, legs 4–7U
 *   shout      jagged burst, 18–28 spikes, depth 2–4U, outline ≈1U
 *   distress   wavy outline, amplitude 0.7–1.2U, wavelength 5–7U
 *   thought    cloud body + 2–3 diminishing bubbles toward the thinker
 *   sarcasm    boxy double-line (RTR house convention)
 *   caption    square box, no tail (narration / place / time)
 *   sfx        free-floating lettering, rotated 6–10°, 10–16% of panel width
 *   offpanel   a speaker who is not in frame: plain balloon, NO tail
 *
 * Everything returns plain point arrays; renderers fill/stroke them.
 */

export const KINDS = Object.freeze(['speech', 'player', 'whisper', 'phone', 'shout', 'distress', 'thought', 'sarcasm', 'caption', 'sfx', 'offpanel']);

export function unit(panelW, panelH) { return Math.min(panelW, panelH) / 100; }

/** Padding inside the body (3.5U × 2.5U for speech; captions tighter). */
export function padding(kind, U) {
  if (kind === 'caption') return { x: 2.2 * U, y: 1.6 * U };
  if (kind === 'sfx') return { x: 0, y: 0 };
  return { x: 3.5 * U, y: 2.5 * U };
}

/** Stroke width in px for a kind (design value, floored to ≈2 CSS px). */
export function strokeFor(kind, U, minPx = 2) {
  const v = kind === 'shout' ? 1.0 * U : kind === 'whisper' ? 0.65 * U : kind === 'caption' ? 0.5 * U : 0.75 * U;
  return Math.max(minPx, v);
}

/** Deterministic tiny wobble so ovals aren't computer-perfect (seeded by rect). */
function wobble(i, seed, amp) {
  const s = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return ((s - Math.floor(s)) - 0.5) * 2 * amp;
}

/** Rounded-rect / oval outline as points.  `boxiness` 0 = oval, 1 = rounded rect. */
function roundedOutline(rect, r, n = 40, asym = 0, seed = 1) {
  const { x, y, w, h } = rect;
  const pts = [];
  const rr = Math.max(2, Math.min(r, w / 2, h / 2));
  // Walk four corner arcs; straight edges between them.
  const corners = [
    [x + w - rr, y + rr, -Math.PI / 2, 0],           // top-right
    [x + w - rr, y + h - rr, 0, Math.PI / 2],        // bottom-right
    [x + rr, y + h - rr, Math.PI / 2, Math.PI],      // bottom-left
    [x + rr, y + rr, Math.PI, 1.5 * Math.PI],        // top-left
  ];
  const per = Math.max(3, Math.floor(n / 4));
  let i = 0;
  for (const [cx, cy, a0, a1] of corners) {
    for (let k = 0; k <= per; k++) {
      const a = a0 + (a1 - a0) * (k / per);
      const wob = asym ? wobble(i, seed, asym) : 0;
      pts.push({ x: cx + Math.cos(a) * (rr + wob), y: cy + Math.sin(a) * (rr + wob) });
      i++;
    }
  }
  return pts;
}

/** Body outline for a kind.  Returns { outline, inner?, dash?, spikes? }. */
export function bodyShape(kind, rect, U, seed = 1) {
  const { x, y, w, h } = rect;
  switch (kind) {
    case 'player':
      return { outline: roundedOutline(rect, 2.2 * U, 32, 0, seed) };           // boxier
    case 'caption':
    case 'sarcasm': {
      const outer = [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
      if (kind === 'sarcasm') {
        const g = 0.9 * U;
        return { outline: outer, inner: [{ x: x + g, y: y + g }, { x: x + w - g, y: y + g }, { x: x + w - g, y: y + h - g }, { x: x + g, y: y + h - g }] };
      }
      return { outline: outer };
    }
    case 'phone':
      return { outline: roundedOutline(rect, 1.2 * U, 24, 0, seed) };            // squared-ish
    case 'shout': {
      // Jagged burst: 18–28 spikes around an ellipse, depth 2–4U.
      const n = Math.max(18, Math.min(28, Math.round((w + h) / (6 * U))));
      const depth = Math.max(2 * U, Math.min(4 * U, 3 * U));
      const cx = x + w / 2, cy = y + h / 2, rx = w / 2 + depth / 2, ry = h / 2 + depth / 2;
      const pts = [];
      for (let i = 0; i < n * 2; i++) {
        const a = (i / (n * 2)) * Math.PI * 2;
        const d = i % 2 === 0 ? depth : -depth * 0.2;
        pts.push({ x: cx + Math.cos(a) * (rx + d), y: cy + Math.sin(a) * (ry + d) });
      }
      return { outline: pts, spikes: n };
    }
    case 'distress': {
      // Wavy outline along a rounded oval: amplitude 0.7–1.2U, wavelength 5–7U.
      const base = roundedOutline(rect, Math.min(w, h) / 2.2, 64, 0, seed);
      const amp = 1.0 * U, wl = 6 * U;
      const cx = x + w / 2, cy = y + h / 2;
      let acc = 0;
      return { outline: base.map((p, i) => {
        if (i) acc += Math.hypot(p.x - base[i - 1].x, p.y - base[i - 1].y);
        const d = Math.sin((acc / wl) * Math.PI * 2) * amp;
        const nx = p.x - cx, ny = p.y - cy, L = Math.hypot(nx, ny) || 1;
        return { x: p.x + (nx / L) * d, y: p.y + (ny / L) * d };
      }) };
    }
    case 'thought': {
      // Cloud: scallops around a rounded oval.
      const base = roundedOutline(rect, Math.min(w, h) / 2.2, 48, 0, seed);
      const cx = x + w / 2, cy = y + h / 2;
      return { outline: base.map((p, i) => {
        const d = (i % 4 < 2 ? 1 : -0.4) * 1.3 * U;
        const nx = p.x - cx, ny = p.y - cy, L = Math.hypot(nx, ny) || 1;
        return { x: p.x + (nx / L) * d, y: p.y + (ny / L) * d };
      }) };
    }
    case 'whisper':
      return { outline: roundedOutline(rect, Math.min(w, h) / 2.4, 40, 0.15 * U, seed), dash: { dash: 2.5 * U, gap: 1.75 * U } };
    case 'sfx':
      return { outline: [] };
    case 'offpanel':
    case 'speech':
    default:
      // Organic oval with restrained asymmetry (≈0.25U wobble).
      return { outline: roundedOutline(rect, Math.min(w, h) / 2.4, 40, 0.25 * U, seed) };
  }
}

/** Tail geometry from a base on the balloon edge to a tip.  `tail` is the
 *  layout result { ax, ay, bx, by, tx, ty } (balloonLayout.clipTail).
 *  Returns { polygon } for filled tails, { bubbles } for thought, null when
 *  the kind carries no tail (caption, sfx, offpanel). */
export function tailShape(kind, tail, U) {
  if (!tail) return null;
  if (kind === 'caption' || kind === 'sfx' || kind === 'offpanel') return null;
  const mid = { x: (tail.ax + tail.bx) / 2, y: (tail.ay + tail.by) / 2 };
  const dx = tail.tx - mid.x, dy = tail.ty - mid.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;            // toward the tip
  const px = -uy, py = ux;                        // perpendicular
  // Tail base width 6–9U (phone 7–9U), length capped at 22U (phone 24U) —
  // the tip never goes past the clipped endpoint the layout gave us.
  const baseW = Math.max(6 * U, Math.min(9 * U, len * 0.35));
  const maxLen = (kind === 'phone' ? 24 : 22) * U;
  const L = Math.min(len, maxLen);
  const tip = { x: mid.x + ux * L, y: mid.y + uy * L };
  const b1 = { x: mid.x + px * baseW / 2, y: mid.y + py * baseW / 2 };
  const b2 = { x: mid.x - px * baseW / 2, y: mid.y - py * baseW / 2 };
  if (kind === 'thought') {
    // Two or three diminishing bubbles toward the thinker.
    const n = L > 12 * U ? 3 : 2;
    const bubbles = [];
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1);
      bubbles.push({ x: mid.x + ux * L * t, y: mid.y + uy * L * t, r: Math.max(1.5 * U, 3.2 * U * (1 - t)) });
    }
    return { bubbles };
  }
  if (kind === 'phone') {
    // Filled zig-zag: 3 bends, legs 4–7U, amplitude ≈ 2.2U, kept wide enough to read.
    const bends = 3;
    const legs = bends + 1;
    const amp = 2.2 * U;
    const left = [], right = [];
    for (let i = 0; i <= legs; i++) {
      const t = i / legs;
      const s = i === 0 || i === legs ? 0 : (i % 2 ? 1 : -1);
      const wHere = baseW * (1 - t) * 0.5;
      const cx = mid.x + ux * L * t + px * amp * s, cy = mid.y + uy * L * t + py * amp * s;
      left.push({ x: cx + px * wHere, y: cy + py * wHere });
      right.push({ x: cx - px * wHere, y: cy - py * wHere });
    }
    return { polygon: [...left, ...right.reverse()] };
  }
  return { polygon: [b1, tip, b2] };
}

/** Sound-effect lettering spec: size 10–16% of panel width, rotated 6–10°. */
export function sfxSpec(text, panelW, seed = 1) {
  const words = String(text ?? '').trim();
  const frac = words.length <= 6 ? 0.13 : 0.10;
  return { fontPx: Math.round(panelW * frac), angleDeg: 6 + (Math.abs(Math.sin(seed)) * 4), text: words };
}

/** Dash the outline for whisper balloons: returns an array of point pairs. */
export function dashOutline(outline, dash, gap) {
  const out = [];
  let carry = 0, on = true;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    let pos = 0;
    while (pos < seg) {
      const need = (on ? dash : gap) - carry;
      const step = Math.min(need, seg - pos);
      const t0 = pos / seg, t1 = (pos + step) / seg;
      if (on) out.push([{ x: a.x + (b.x - a.x) * t0, y: a.y + (b.y - a.y) * t0 }, { x: a.x + (b.x - a.x) * t1, y: a.y + (b.y - a.y) * t1 }]);
      pos += step; carry += step;
      if (carry >= (on ? dash : gap) - 1e-6) { carry = 0; on = !on; }
    }
  }
  return out;
}
