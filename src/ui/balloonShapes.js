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

export const KINDS = Object.freeze(['speech', 'player', 'whisper', 'phone', 'shout', 'distress', 'thought', 'sarcasm', 'caption', 'sfx', 'offpanel', 'flirt', 'hesitant', 'worried']);
/** Simple deterministic hash of the copy → shape-family seed (no randomness). */
export function seedFor(text) { let h = 7; for (const ch of String(text ?? '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 1000; }

export function unit(panelW, panelH) { return Math.min(panelW, panelH) / 100; }

/** Padding inside the body — OWNER CORRECTION 2026-09-11 "balloons must hug
 *  the lettering": measure the wrapped text first, then add only the
 *  required breathing room — 0.70–0.95 em horizontally, 0.42–0.65 rendered
 *  line-heights vertically.  Organic ovals may bulge past this only where
 *  their curvature requires it (see `bulgeFor`).  Never a preset rectangle,
 *  never the master viewBox, never shrunk text. */
export const PAD_EM_X = [0.70, 0.95];
export const PAD_LH_Y = [0.42, 0.65];
export function paddingFor(kind, fontPx, lineH = fontPx * 1.2) {
  if (kind === 'sfx') return { x: 0, y: 0 };
  if (kind === 'caption') return { x: 0.70 * fontPx, y: 0.42 * lineH };
  return { x: 0.80 * fontPx, y: 0.50 * lineH };
}
/** Extra silhouette allowance for organic contours so the curve clears the
 *  text's corners; zero for boxy families.  Part of the collision rect. */
export function bulgeFor(kind, lineH) {
  if (kind === 'caption' || kind === 'sfx' || kind === 'player' || kind === 'sarcasm' || kind === 'phone') return 0;
  if (kind === 'shout') return 0.20 * lineH;
  return 0.30 * lineH;
}
/** QA: is this body materially larger than the lettering needs?  Compares the
 *  body area against the minimum allowed (text + minimum padding + bulge). */
export function excessBalloonArea(kind, textW, textH, bodyW, bodyH, fontPx, lineH = fontPx * 1.2) {
  const b = bulgeFor(kind, lineH);
  const minW = textW + 2 * PAD_EM_X[0] * fontPx + 2 * b, minH = textH + 2 * PAD_LH_Y[0] * lineH + 2 * b;
  const excess = 1 - (minW * minH) / Math.max(1, bodyW * bodyH);
  return { excess: +excess.toFixed(3), flagged: excess > 0.18 };
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
      return captionShape(rect, U, 'ticket');
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
    case 'flirt': {
      // Buoyant asymmetric curve with an offset lobe: bigger radius one side, a subtle tilt.
      const base = roundedOutline(rect, Math.min(w, h) / 2.0, 44, 0.3 * U, seed);
      const cx = x + w / 2, cy = y + h / 2, tilt = 0.035;
      return { outline: base.map(p => { const lobe = p.x > cx && p.y < cy ? 1.2 * U : 0; const nx = p.x - cx, ny = p.y - cy, L = Math.hypot(nx, ny) || 1; return { x: p.x + (nx / L) * lobe + (p.y - cy) * tilt, y: p.y + (ny / L) * lobe }; }) };
    }
    case 'hesitant': {
      // Uneven, pinched contour: a stronger deterministic wobble and a pinch on one long edge.
      const base = roundedOutline(rect, Math.min(w, h) / 2.4, 48, 0.7 * U, seed);
      const cx = x + w / 2, cy = y + h / 2;
      return { outline: base.map((p, i) => { const pinch = Math.abs(p.x - cx) < w * 0.12 && p.y > cy ? -1.4 * U : 0; return { x: p.x, y: p.y + pinch }; }) };
    }
    case 'worried': {
      const base = roundedOutline(rect, Math.min(w, h) / 2.4, 64, 0, seed);
      const amp = 0.6 * U, wl = 4.5 * U; const cx = x + w / 2, cy = y + h / 2; let acc = 0;
      return { outline: base.map((p, i) => { if (i) acc += Math.hypot(p.x - base[i - 1].x, p.y - base[i - 1].y); const d = Math.sin((acc / wl) * Math.PI * 2) * amp; const nx = p.x - cx, ny = p.y - cy, L = Math.hypot(nx, ny) || 1; return { x: p.x + (nx / L) * d, y: p.y + (ny / L) * d }; }) };
    }
    case 'offpanel':
    case 'speech':
    default: {
      // Ordinary speech is an organic FAMILY, never a rounded rectangle: the
      // seed (from the copy) picks oval / egg / bean / capsule with restrained
      // asymmetry, so consecutive balloons aren't clones but stay one grammar.
      const fam = Math.abs(seed | 0) % 4;
      const r = fam === 3 ? Math.min(w, h) / 2 : Math.min(w, h) / 2.4;
      const base = roundedOutline(rect, r, 44, 0.25 * U, seed);
      const cx = x + w / 2, cy = y + h / 2;
      if (fam === 1) return { outline: base.map(p => ({ x: p.x + (p.y < cy ? (p.x - cx) * 0.06 : 0), y: p.y })) };          // egg: wider on top
      if (fam === 2) return { outline: base.map(p => { const dent = p.y > cy + h * 0.3 && Math.abs(p.x - cx) < w * 0.2 ? -0.9 * U : 0; return { x: p.x, y: p.y + dent }; }) };  // bean: soft dent below
      return { outline: base };                                                                                          // oval / capsule
    }
  }
}

/** Caption FAMILY (narration / place / time): ticket (cut corners), notched
 *  tab, or plain card — chosen by `variant`; never a speaker tail. */
export function captionShape(rect, U, variant = 'ticket') {
  const { x, y, w, h } = rect, c = Math.min(2.2 * U, h / 3);
  if (variant === 'ticket') return { outline: [{ x: x + c, y }, { x: x + w - c, y }, { x: x + w, y: y + c }, { x: x + w, y: y + h - c }, { x: x + w - c, y: y + h }, { x: x + c, y: y + h }, { x, y: y + h - c }, { x, y: y + c }] };
  if (variant === 'tab') return { outline: [{ x, y }, { x: x + w - 3 * U, y }, { x: x + w, y: y + h / 2 }, { x: x + w - 3 * U, y: y + h }, { x, y: y + h }] };
  return { outline: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] };
}

/** Tail geometry from the balloon edge to the tip.  `tail` comes from
 *  balloonLayout.buildTail: { ax, ay, bx, by, tx, ty, via?, baseW }.
 *  OWNER RULE: length is unrestricted, WIDTH is not — the base is already
 *  ≤ 1.25 × line-height; the ribbon tapers to a narrow point and a routed
 *  tail bends at `via` instead of broadening.  Returns { polygon } for filled
 *  tails, { bubbles } for thought, null when the kind carries no tail. */
export function tailShape(kind, tail, U) {
  if (!tail) return null;
  if (kind === 'caption' || kind === 'sfx' || kind === 'offpanel') return null;
  const mid = { x: (tail.ax + tail.bx) / 2, y: (tail.ay + tail.by) / 2 };
  const pts = tail.via ? [mid, tail.via, { x: tail.tx, y: tail.ty }] : [mid, { x: tail.tx, y: tail.ty }];
  const total = pts.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0) || 1;
  if (kind === 'thought') {
    const n = total > 40 ? 3 : 2;
    const bubbles = [];
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1);
      const q = pointAt(pts, t * total);
      bubbles.push({ x: q.x, y: q.y, r: Math.max(1.5 * U, 3.0 * U * (1 - t)) });
    }
    return { bubbles };
  }
  const baseHalf = tail.baseW / 2;
  const tipHalf = Math.max(0.6, 0.15 * U);
  // Ribbon: left/right rails at a width that tapers linearly along the path.
  const left = [], right = [];
  const samples = kind === 'phone' ? 5 : (tail.via ? 3 : 2);
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const d = t * total;
    const q = pointAt(pts, d);
    const dir = dirAt(pts, d);
    const nx = -dir.y, ny = dir.x;
    const half = baseHalf + (tipHalf - baseHalf) * t;
    const zig = kind === 'phone' && i > 0 && i < samples ? (i % 2 ? 1 : -1) * 1.8 * U : 0;
    left.push({ x: q.x + nx * (half + zig), y: q.y + ny * (half + zig) });
    right.push({ x: q.x - nx * (half - zig), y: q.y - ny * (half - zig) });
  }
  // Base corners sit exactly on the balloon edge.
  left[0] = { x: tail.ax, y: tail.ay }; right[0] = { x: tail.bx, y: tail.by };
  return { polygon: [...left, ...right.reverse()] };
}

/** Bridge between two balloons of the same speaker (linked balloons): a
 *  narrow band, no taper. */
export function connectorShape(conn) {
  if (!conn) return null;
  const dx = conn.to.x - conn.from.x, dy = conn.to.y - conn.from.y, L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L * conn.width / 2, ny = dx / L * conn.width / 2;
  return { polygon: [{ x: conn.from.x + nx, y: conn.from.y + ny }, { x: conn.to.x + nx, y: conn.to.y + ny }, { x: conn.to.x - nx, y: conn.to.y - ny }, { x: conn.from.x - nx, y: conn.from.y - ny }] };
}

function pointAt(pts, d) {
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (acc + seg >= d || i === pts.length - 1) { const t = seg ? Math.min(1, (d - acc) / seg) : 0; return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t }; }
    acc += seg;
  }
  return pts[pts.length - 1];
}
function dirAt(pts, d) {
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (acc + seg >= d || i === pts.length - 1) { return { x: (pts[i].x - pts[i - 1].x) / (seg || 1), y: (pts[i].y - pts[i - 1].y) / (seg || 1) }; }
    acc += seg;
  }
  return { x: 1, y: 0 };
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
