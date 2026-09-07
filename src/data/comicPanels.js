// ── Comic panel metadata + page layout templates (Ch. 18.3 / 18.9) ─────────
//
// PANEL METADATA is keyed by `panelKey` = `${storyId}.${nodeId}` (a choice may
// override with its own key later).  It tells the renderer where the art
// lives and where dialogue may go on it; art never carries baked dialogue.
//
//   {
//     art:      'assets/storylines/panels/hiphop/seattle_offer.png',  // null → placeholder
//     bubble:   { x, y, w, h },     // preferred NPC balloon rect, 0–1 of the panel
//     playerBubble: { x, y, w, h }, // preferred player balloon rect
//     tail:     { x, y },           // speaker mouth anchor, 0–1
//     playerTail: { x, y },
//     protect:  [ { x, y, w, h } ], // faces / hands — balloons must not cover
//     vehicle:  null | { x, y, w, h, view }, // reserved: genre-vehicle overlay slot (18.9)
//   }
//
// Phase 2 ships NO art keys: every panel resolves to DEFAULT_PANEL_META and
// the renderer paints a placeholder (speaker silhouette + scene label).  Phase
// 8 fills PANEL_META from the supplied panel art + metadata sheets.
//
// PAGE TEMPLATES are deterministic layouts (18.3): slots are 0–1 rects on a
// portrait page.  `kind` tells ComicSystem which events a template may hold.

export const PANEL_ASPECT = 16 / 9;   // every live tile + placeholder is landscape

export const DEFAULT_PANEL_META = Object.freeze({
  art: null,
  // NPC balloon top-left (a long reply links a second balloon beneath it,
  // staying above ~50% height); player balloon lower-right so the two never
  // collide.  Speaker anchor = the placeholder portrait's mouth.
  bubble:       { x: 0.04, y: 0.05, w: 0.56, h: 0.30 },
  playerBubble: { x: 0.40, y: 0.64, w: 0.56, h: 0.30 },
  tail:         { x: 0.70, y: 0.42 },
  playerTail:   { x: 0.30, y: 0.86 },
  protect:      [],
  vehicle:      null,
});

/** Per-panel overrides — filled in Phase 8.  Key: `${storyId}.${nodeId}`. */
export const PANEL_META = {};

export function panelKeyFor(storyId, nodeId) { return `${storyId}.${nodeId}`; }

export function panelMeta(panelKey) {
  const m = PANEL_META[panelKey];
  return m ? { ...DEFAULT_PANEL_META, ...m } : { ...DEFAULT_PANEL_META };
}

// ── Page templates ──────────────────────────────────────────────────────
// Page is 1 × 1.4142 (A-series portrait).  Gutter 0.03.
const G = 0.03, H = 1.4142;
const rect = (x, y, w, h) => ({ x, y, w, h });

export const PAGE_TEMPLATES = {
  // Wide establishing panel — one MAJOR beat fills the top; rest is left
  // empty so a later page doesn't have to.  (Locks immediately: 1 slot.)
  wide:  { kind: 'major',  slots: [rect(G, G, 1 - 2 * G, (1 - 2 * G) / PANEL_ASPECT)] },
  // Two-up.
  two_up: { kind: 'flow', slots: [
    rect(G, G,                 1 - 2 * G, (H - 3 * G) / 2),
    rect(G, G * 2 + (H - 3 * G) / 2, 1 - 2 * G, (H - 3 * G) / 2),
  ] },
  // One wide + two small.
  one_wide_two_small: { kind: 'flow', slots: [
    rect(G, G, 1 - 2 * G, (H - 3 * G) * 0.5),
    rect(G,             G * 2 + (H - 3 * G) * 0.5, (1 - 3 * G) / 2, (H - 3 * G) * 0.5),
    rect(G * 2 + (1 - 3 * G) / 2, G * 2 + (H - 3 * G) * 0.5, (1 - 3 * G) / 2, (H - 3 * G) * 0.5),
  ] },
  // Four grid.
  four_grid: { kind: 'flow', slots: [
    rect(G,                       G,                       (1 - 3 * G) / 2, (H - 3 * G) / 2),
    rect(G * 2 + (1 - 3 * G) / 2, G,                       (1 - 3 * G) / 2, (H - 3 * G) / 2),
    rect(G,                       G * 2 + (H - 3 * G) / 2, (1 - 3 * G) / 2, (H - 3 * G) / 2),
    rect(G * 2 + (1 - 3 * G) / 2, G * 2 + (H - 3 * G) / 2, (1 - 3 * G) / 2, (H - 3 * G) / 2),
  ] },
  // Large climax — one panel, most of the page.
  climax: { kind: 'climax', slots: [rect(G, G, 1 - 2 * G, H * 0.72)] },
  // MEANWHILE… three-panel strip (one event carrying three sub-panels).
  meanwhile: { kind: 'meanwhile', slots: [
    rect(G,                             H * 0.30, (1 - 4 * G) / 3, (1 - 4 * G) / 3 / PANEL_ASPECT * 1.6),
    rect(G * 2 + (1 - 4 * G) / 3,       H * 0.30, (1 - 4 * G) / 3, (1 - 4 * G) / 3 / PANEL_ASPECT * 1.6),
    rect(G * 3 + (1 - 4 * G) / 3 * 2,   H * 0.30, (1 - 4 * G) / 3, (1 - 4 * G) / 3 / PANEL_ASPECT * 1.6),
  ] },
  // Full-width ending.
  ending: { kind: 'ending', slots: [rect(G, G, 1 - 2 * G, H - 2 * G)] },
};

/** Flow templates cycle deterministically by page ordinal so the same event
 *  sequence always produces the same book. */
export const FLOW_CYCLE = ['two_up', 'one_wide_two_small', 'four_grid'];

export const PAGE_W = 1, PAGE_H = H;
