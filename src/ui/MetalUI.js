// ── Gritty neon automotive-shop button styling ────────────────────────────
//
// Chapter 15 of the Overview asks for a charcoal metal look: brushed texture,
// inset shadow, faint magenta-and-cyan edge glow, chamfered corners, dark
// metallic buttons with restrained accents, hover lift and click depress.
//
// PHASER, NOT DOM (owner's call, 2026-08-13)
// The brief was written as CSS. These are Phaser GameObjects on the scene's
// display list, so gradients, pseudo-elements and inset box-shadows have no
// direct equivalent. Everything here is built from layered Graphics instead:
//   • gradient  → a stack of horizontal bands lerping between two colours
//   • inset     → a dark band inside the top edge, a light one inside the base
//   • chamfer   → an explicit 8-point polygon, not a rounded rect
//   • noise     → one generated 64×64 tile, reused by every surface
// A DOM port would have meant solving z-order against the canvas, the widened
// canvas's HUD_OFFSET_X margins, the _eatTap drift gate, and iOS WKWebView —
// see the Chapter 15 notes.
//
// THE HIT AREA IS NOT THIS
// paint() only draws. Call sites keep their existing interactive Rectangle as
// the hit target (made transparent), so every setInteractive / _eatTap /
// _tapBlocked / _gateTaps path in RestStopScene keeps working untouched. That
// discipline matters: the shop's tap handling has drift gates and fall-through
// guards that took real bug reports to get right, and a restyle has no business
// re-opening them.

const NOISE_KEY = '__metal_noise';

/** One 64×64 monochrome noise tile, generated once per scene texture manager.
 *  Deterministic — a fixed LCG, not Math.random — so the grain is identical
 *  across reloads and can never shimmer between frames. */
export function ensureNoise(scene) {
  if (scene.textures.exists(NOISE_KEY)) return NOISE_KEY;
  const S = 64;
  const tex = scene.textures.createCanvas(NOISE_KEY, S, S);
  const ctx = tex.getContext();
  const img = ctx.createImageData(S, S);
  let seed = 0x9E3779B9;
  for (let i = 0; i < S * S; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const v = 128 + ((seed >>> 24) - 128) * 0.45;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  tex.refresh();
  return NOISE_KEY;
}

/** Accent palettes. Deliberately muted — the brief asks for restrained colour
 *  on dark metal, not the solid green/red the buttons used to be. */
export const TONE = {
  neutral: { edge: 0x2FA8D8, glow: 0xB93DA0, top: 0x2A2F38, bot: 0x14171D, text: '#D8E4EE' },
  go:      { edge: 0x35C69A, glow: 0x1E7F66, top: 0x243A34, bot: 0x111C18, text: '#8FE8C8' },
  stop:    { edge: 0xC0505C, glow: 0x7A2B32, top: 0x3A2429, bot: 0x1C1114, text: '#F0A6AE' },
  gold:    { edge: 0xC9A24A, glow: 0xB93DA0, top: 0x33291A, bot: 0x18130C, text: '#F0DCA8' },
  off:     { edge: 0x3A3F47, glow: 0x000000, top: 0x1B1E23, bot: 0x0E1013, text: '#6B7280' },
};

const lerp = (a, b, t) => Math.round(a + (b - a) * t);
const mix = (c1, c2, t) => (lerp((c1 >> 16) & 255, (c2 >> 16) & 255, t) << 16)
                         | (lerp((c1 >> 8) & 255, (c2 >> 8) & 255, t) << 8)
                         |  lerp(c1 & 255, c2 & 255, t);

/** Chamfered outline as an explicit polygon — corners CUT, never rounded. */
function chamferPoints(x, y, w, h, c) {
  c = Math.max(2, Math.min(c, Math.min(w, h) / 2 - 1));
  return [
    x + c, y,          x + w - c, y,
    x + w, y + c,      x + w,     y + h - c,
    x + w - c, y + h,  x + c,     y + h,
    x,     y + h - c,  x,         y + c,
  ];
}

/**
 * Paint a metal surface into `g` (which is cleared first).
 *
 * @param {Phaser.GameObjects.Graphics} g
 * @param {number} x,y,w,h    top-left anchored rect
 * @param {object} o
 *   tone      key into TONE
 *   state     'idle' | 'hover' | 'down' | 'disabled' | 'focus'
 *   chamfer   corner cut in px (default 6)
 *   panel     true = big surface: stronger inset, wider glow
 */
export function paint(g, x, y, w, h, o = {}) {
  const t = TONE[o.state === 'disabled' ? 'off' : (o.tone ?? 'neutral')] ?? TONE.neutral;
  const state = o.state ?? 'idle';
  const cut = o.chamfer ?? 6;
  const pts = chamferPoints(x, y, w, h, cut);
  g.clear();

  // Brightness lift on hover; press sits slightly darker AND is offset by the
  // caller, so the two together read as a physical depress.
  const k = state === 'hover' ? 0.16 : state === 'down' ? -0.10 : 0;
  const top = k >= 0 ? mix(t.top, 0xFFFFFF, k) : mix(t.top, 0x000000, -k);
  const bot = k >= 0 ? mix(t.bot, 0xFFFFFF, k) : mix(t.bot, 0x000000, -k);

  // Outer glow — magenta/cyan bloom, faint, wider on panels.
  if (state !== 'disabled') {
    const rings = o.panel ? 3 : 2;
    for (let i = rings; i >= 1; i--) {
      g.lineStyle(1, i % 2 ? t.glow : t.edge, 0.10 + (rings - i) * 0.05);
      g.strokePoints(toPts(chamferPoints(x - i, y - i, w + i * 2, h + i * 2, cut + i)), true);
    }
  }

  // Body: banded vertical gradient, clipped by drawing bands inside the chamfer.
  g.fillStyle(bot, 1);
  g.fillPoints(toPts(pts), true);
  const BANDS = o.panel ? 18 : 10;
  for (let i = 0; i < BANDS; i++) {
    const f = i / BANDS;
    const by = y + h * f;
    const bh = h / BANDS + 1;
    // Inset horizontally by the chamfer so bands never spill past the cut.
    const inset = f < cut / h ? cut * (1 - f * h / cut)
                : f > 1 - cut / h ? cut * (1 - (1 - f) * h / cut) : 0;
    g.fillStyle(mix(top, bot, f), 1);
    g.fillRect(x + inset, by, w - inset * 2, bh);
  }

  // Inset shadow: dark inside the top edge, light inside the base — the cue
  // that reads as a recessed metal plate rather than a flat fill.
  const insetA = o.panel ? 0.55 : 0.40;
  g.fillStyle(0x000000, insetA);
  g.fillRect(x + cut, y + 1, w - cut * 2, o.panel ? 3 : 2);
  g.fillStyle(0xFFFFFF, state === 'disabled' ? 0.04 : 0.10);
  g.fillRect(x + cut, y + h - (o.panel ? 3 : 2) - 1, w - cut * 2, o.panel ? 3 : 2);

  // Edges: thin cyan outline, magenta highlight along the top chamfer.
  g.lineStyle(state === 'hover' ? 2 : 1, t.edge, state === 'disabled' ? 0.5 : 0.95);
  g.strokePoints(toPts(pts), true);
  if (state !== 'disabled') {
    g.lineStyle(1, t.glow, state === 'hover' ? 0.75 : 0.45);
    g.beginPath();
    g.moveTo(x + cut, y + 0.5); g.lineTo(x + w - cut, y + 0.5);
    g.strokePath();
  }

  // Keyboard focus — deliberately unmistakable, per the brief's contrast note.
  if (state === 'focus') {
    g.lineStyle(2, 0xFFE45C, 1);
    g.strokePoints(toPts(chamferPoints(x - 3, y - 3, w + 6, h + 6, cut + 3)), true);
  }
}

const toPts = (flat) => {
  const out = [];
  for (let i = 0; i < flat.length; i += 2) out.push({ x: flat[i], y: flat[i + 1] });
  return out;
};

/**
 * Dress an existing interactive Rectangle in metal.
 *
 * The rectangle stays as the hit area and keeps every handler the call site
 * already attached — it is only made invisible. A Graphics is drawn behind it
 * and repainted on hover/press, and any labels passed in ride the 2 px lift so
 * the whole control moves as one object.
 *
 * @returns {{gfx: Phaser.GameObjects.Graphics, set: (state:string)=>void}}
 */
export function dress(scene, rect, opts = {}) {
  const originLeft = rect.originX === 0;
  const x = originLeft ? rect.x : rect.x - rect.width / 2;
  const y = rect.originY === 0 ? rect.y : rect.y - rect.height / 2;
  const w = rect.width, h = rect.height;

  // DEPTH, EXPLICITLY ON ALL THREE.
  //
  // A -0.1 offset was not enough: the shop rows, their labels and the hit
  // rectangle all sit at depth 0, and the skin is created last, so it painted
  // over its own text. Fractional offsets also do not survive being reparented
  // into a section Container. Each layer is pinned relative to the button's own
  // depth instead, which keeps the button's stacking against the rest of the UI
  // exactly where the call site put it.
  // The plate sits AT the button's depth and the labels are raised above it —
  // rather than sinking the plate below. A negative depth would have dropped a
  // shop row's skin under the storefront background (itself depth 0) and made
  // the button disappear entirely. Raising only the text cannot do that.
  // gfx is created after rect, so at equal depth it draws over the (now
  // transparent) hit rectangle, and under the labels.
  const base = rect.depth ?? 0;
  const gfx = scene.add.graphics().setDepth(base);
  const labels = opts.labels ?? [];
  labels.forEach(l => l.setDepth?.(base + 1));
  const baseY = labels.map(l => l.y);
  let state = opts.state ?? 'idle';

  const set = (s) => {
    state = s;
    paint(gfx, x, y, w, h, { ...opts, state });
    // Hover lifts 2 px, press settles 1 px below rest.
    const dy = s === 'hover' ? -2 : s === 'down' ? 1 : 0;
    gfx.setY(dy);
    labels.forEach((l, i) => l.setY(baseY[i] + dy));
  };
  set(state);

  rect.setFillStyle(0x000000, 0.001);   // hit area only; the metal is the Graphics
  rect.setStrokeStyle();
  if (opts.state !== 'disabled') {
    rect.on('pointerover', () => set('hover'));
    rect.on('pointerout',  () => set('idle'));
    rect.on('pointerdown', () => set('down'));
    rect.on('pointerup',   () => set('hover'));
  }
  return { gfx, set };
}
