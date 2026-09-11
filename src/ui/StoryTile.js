/**
 * Live story conversation tile — Ch. 18.3 "Live comic presentation", rebuilt
 * to the owner-approved comic direction (working notes 2026-09-09) and the
 * comic dialogue workshop (2026-09-10).
 *
 * One FULL-SCREEN tile per story node (800×450 = the panel's 16:9): the panel
 * art, a CAPTION box if the node narrates, the node's opening LINES revealed
 * in authored order (leapfrogging down the panel), then the main NPC line,
 * then the translucent verbal-response tray.  The strip waits for the player
 * with no time pressure.  The chosen sentence becomes the player's balloon,
 * the NPC's reply (and any `after` lines) follow in the same tile, then the
 * tile HOLDS (3 s when the player spoke last, 6 s + 175 ms/word past 10 when
 * an NPC spoke last, cap 9 s; a tap skips) and slides to the next tile.  A
 * choice-less beat (`node.next`) advances the same way.  Completed tiles stay
 * to the left; a drag browses back and pauses the hold.
 *
 * Every balloon is placed through balloonLayout (faces / hands / phones /
 * other balloons / the tray band are never covered; tails stop short of the
 * face they point at and never cross another) and drawn with balloonShapes
 * (the same vocabulary the book uses).  A placement log
 * (`window.__comicLayoutLog`) carries the QA gates: words ≤ 25, attributed
 * tail, not clipped, not under the tray, slot used.
 *
 * This module never touches `_showEncounterCard` — single-step encounters
 * keep their card (18.11).
 */

import Phaser from 'phaser';
import { SCREEN_W, SCREEN_H } from '../constants.js';
import { getStoryNode } from '../data/featuredStories.js';
import { panelMeta, panelKeyFor, resolvePanelKey } from '../data/comicPanels.js';
import { layoutBalloon, migrateZones, readingOrder, TAIL_BASE_CEILING } from './balloonLayout.js';
import { unit, paddingFor, bulgeFor, excessBalloonArea, strokeFor, bodyShape, tailShape, connectorShape, sfxSpec, dashOutline, seedFor } from './balloonShapes.js';

const D = 600;
// Comic lettering with a readable fallback (iOS ships Chalkboard SE / Marker
// Felt, macOS Comic Sans MS, everything else falls to a humanist sans).
export const LETTERING = '"Chalkboard SE", "Comic Sans MS", "Marker Felt", "Trebuchet MS", Arial, sans-serif';
const CAPTION_FACE = '"Comic Neue", "Trebuchet MS", "Helvetica Neue", Arial, sans-serif';
const IMPACT = 'Impact, "Arial Black", Arial, sans-serif';
const INK = 0x141414;
const FILLS = { speech: 0xFFFFFF, offpanel: 0xFFFFFF, whisper: 0xFFFFFF, phone: 0xF2F6FF, shout: 0xFFFFFF, distress: 0xFFFFFF, thought: 0xFFFFFF, sarcasm: 0xFFFFFF, player: 0xFFF9D6, caption: 0xFFF1B8, flirt: 0xFFFFFF, hesitant: 0xFFFFFF, worried: 0xFFFFFF };
const LEVEL_COLORS = { 1: 0xFF3030, 2: 0xFF9A20, 3: 0x3A8CFF };

/** Debug overlays (`?comicdebug=1` / `window.__comicDebug = true`). */
const comicDebug = () => { try { return !!window.__comicDebug; } catch (_) { return false; } };

// ── Reading-time rule (owner-approved direction §"Live dialogue and advancement sequence") ──
export const HOLD_PLAYER_LAST_MS = 3000;   // the player's balloon is the last dialogue on the tile
export const HOLD_NPC_LAST_MS    = 6000;   // an NPC line follows the player's
export const HOLD_EXTRA_PER_WORD = 175;    // per word beyond 10 in the final revealed line
export const HOLD_CAP_MS         = 9000;
/** Gap between successive balloon reveals (owner 2026-09-10: "2 sec apart
 *  unless really long"): 2 s + 90 ms per word past eight. */
export const BALLOON_GAP_MS = 2000;
export const BALLOON_MS_PER_EXTRA_WORD = 90;
export const WORD_CAP = 25;                // absolute per-balloon maximum (target 5–10)
const wordsOf = (t) => String(t ?? '').trim().split(/\s+/).filter(Boolean).length;
export function readMs(text) { return BALLOON_GAP_MS + Math.max(0, wordsOf(text) - 8) * BALLOON_MS_PER_EXTRA_WORD; }
export function holdMs(lastText, npcLast) {
  const base = npcLast ? HOLD_NPC_LAST_MS : HOLD_PLAYER_LAST_MS;
  return Math.min(HOLD_CAP_MS, base + Math.max(0, wordsOf(lastText) - 10) * HOLD_EXTRA_PER_WORD);
}

/** Split copy into ≤ WORD_CAP-word parts at sentence ends (never mid-clause
 *  when a sentence end exists; wording untouched). */
export function splitByCap(text, cap = WORD_CAP) {
  const t = String(text ?? '').trim();
  if (wordsOf(t) <= cap) return t ? [t] : [];
  const sentences = t.match(/[^.!?…]+[.!?…]+["”']?|[^.!?…]+$/g)?.map(s => s.trim()).filter(Boolean) ?? [t];
  const parts = []; let cur = '';
  for (const s of sentences) {
    const cand = cur ? `${cur} ${s}` : s;
    if (wordsOf(cand) <= cap || !cur) { cur = cand; } else { parts.push(cur); cur = s; }
    // A single sentence over the cap: break at the word cap itself.
    while (wordsOf(cur) > cap) { const w = cur.split(/\s+/); parts.push(w.slice(0, cap).join(' ')); cur = w.slice(cap).join(' '); }
  }
  if (cur) parts.push(cur);
  return parts;
}

// FULL-SCREEN tile: 800×450 = 16:9 = PANEL_ASPECT, so the art fills the
// screen edge to edge with no bars and no crop.  The response tray is a
// translucent band over the lower part (≤ 35% of the height, shrinking with
// fewer choices); balloons keep above it.
const ART_W  = SCREEN_W;                            // 800
const ART_H  = SCREEN_H;                            // 450
const ART_X  = 0;
const ART_Y  = 0;
const PEEK   = 0;
const GAP    = 8;
const TILE_W = ART_W - PEEK;
const TRAY_MAX_H = Math.round(SCREEN_H * 0.35);     // 157
const TRAY_BOTTOM = SCREEN_H - 6;
const BTN_GAP = 6;
const MIN_FONT = 13;                                // ≥ 13 CSS px at gameplay size

/** Run every pending story node for this stop in order, then `onDone`. */
export function runStoryQueue(scene, pending, onDone) {
  const q = [...pending];
  const next = () => {
    const p = q.shift();
    if (!p) { onDone?.(); return; }
    showStoryConversation(scene, p, next);
  };
  next();
}

/**
 * @param scene   RestStopScene (needs add/tweens/time/input, _gateTaps,
 *                _tapBlocked, _eatTap, _swallowTaps, _score, _purchases,
 *                _stop, _odometer)
 * @param start   { storyId, nodeId }
 * @param onDone  called once when the conversation closes
 */
export function showStoryConversation(scene, start, onDone) {
  const story = scene.registry.get('story');
  if (!story) { onDone?.(); return; }
  const stopId = scene._stop?.id;
  let finished = false, leaveAfter = false;
  // Panel textures this conversation loaded on demand — released on teardown
  // (a 1672x941 panel is ~6 MB decoded; see the iPhone memory audit).
  const loadedArtKeys = new Set();
  const finish = () => {
    if (finished) return; finished = true;
    scene._storyTileOpen = false;
    teardown();
    for (const k of loadedArtKeys) { try { scene.textures.remove(k); } catch (_) {} }
    loadedArtKeys.clear();
    if (leaveAfter && typeof scene._continue === 'function') { scene._continue(); return; }
    onDone?.();
  };

  // ── Chrome ──────────────────────────────────────────────────────────────
  const objs = [];
  const add = (...n) => { objs.push(...n); return n[0]; };
  scene._gateTaps();
  const scrim = add(scene._swallowTaps(scene.add.rectangle(SCREEN_W / 2, SCREEN_H / 2, SCREEN_W, SCREEN_H, 0x02040B, 0.86).setDepth(D)));
  scene._storyTileOpen = true;      // the rest stop's SPACE = leave binding must not fire under us
  const frame = scene.add.graphics().setDepth(D + 1);
  frame.fillStyle(0x000000, 1); frame.fillRect(ART_X - 3, ART_Y - 3, ART_W + 6, ART_H + 6);
  add(frame);
  const strip = add(scene.add.container(ART_X, ART_Y).setDepth(D + 2));
  const maskG = scene.make.graphics(); maskG.fillStyle(0xffffff).fillRect(ART_X, ART_Y, ART_W, ART_H);
  strip.setMask(maskG.createGeometryMask());
  objs.push({ destroy: () => maskG.destroy() });
  const header = add(scene.add.text(ART_X + ART_W - 8, ART_Y + 6, '', {
    fontSize: '11px', fontFamily: IMPACT, color: '#8FB7E6', stroke: '#000', strokeThickness: 3,
  }).setOrigin(1, 0).setDepth(D + 5));
  if (comicDebug()) {
    add(scene.add.rectangle(SCREEN_W / 2, TRAY_BOTTOM - TRAY_MAX_H / 2, ART_W, TRAY_MAX_H, 0xFF9020, 0.14).setDepth(D + 6));
    add(scene.add.text(ART_X + 4, TRAY_BOTTOM - TRAY_MAX_H + 2, 'TRAY RISK', { fontSize: '9px', fontFamily: IMPACT, color: '#FF9020' }).setDepth(D + 6));
  }

  const tiles = [];
  let btnObjs = [];
  let dragging = null;
  let holdTimer = null;             // the completed-tile hold (auto-advance)
  const stripTargetX = () => ART_X + (tiles.length ? PEEK - (tiles.length - 1) * (TILE_W + GAP) : 0);
  const stripMinX = () => stripTargetX();
  const stripMaxX = () => ART_X + PEEK;

  // Drag back through earlier tiles.  A drag is not a tap, and browsing
  // pauses the hold until the active panel is restored.
  const dragZone = add(scene.add.rectangle(ART_X + ART_W / 2, ART_Y + ART_H / 2, ART_W, ART_H, 0xffffff, 0.001).setDepth(D + 4));
  dragZone.setInteractive();
  dragZone.on('pointerdown', (p, _x, _y, ev) => { scene._eatTap(p, ev); dragging = { px: p.x, sx: strip.x }; });
  const onMove = (p) => {
    if (!dragging || !p.isDown) return;
    strip.x = Math.max(stripMinX(), Math.min(stripMaxX(), dragging.sx + (p.x - dragging.px)));
  };
  const onUp = () => { dragging = null; };
  scene.input.on('pointermove', onMove);
  scene.input.on('pointerup', onUp);
  objs.push({ destroy: () => { scene.input.off('pointermove', onMove); scene.input.off('pointerup', onUp); } });
  const browsingBack = () => !!dragging || Math.abs(strip.x - stripTargetX()) > 6;

  function teardown() {
    holdTimer?.remove?.(); holdTimer = null;
    for (const b of btnObjs) b?.destroy?.();
    for (const o of objs) o?.destroy?.();
  }

  /** Completed-tile HOLD: auto-advance after `ms`, a deliberate tap skips the
   *  remaining pause, a review drag pauses it.  SPACE/ENTER count as taps. */
  function holdThen(ms, fn) {
    if (finished) return;
    const hint = scene.add.text(SCREEN_W / 2, SCREEN_H - 22, 'TAP TO CONTINUE', {
      fontSize: '14px', fontFamily: IMPACT, color: '#8FB7E6', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(D + 5).setAlpha(0);
    btnObjs.push(hint);
    scene.tweens.add({ targets: hint, alpha: 0.9, delay: Math.min(ms, 900), duration: 400 });
    let down = null, spent = false;
    const taps = [dragZone, scrim].filter(Boolean);
    const cleanup = () => {
      if (spent) return; spent = true;
      for (const o of taps) { try { o.off('pointerdown', onDown); o.off('pointerup', onUpTap); } catch (_) {} }
      try { scene.input.keyboard?.off('keydown-SPACE', onKey); } catch (_) {}
      try { scene.input.keyboard?.off('keydown-ENTER', onKey); } catch (_) {}
      holdTimer?.remove?.(); holdTimer = null;
      hint.destroy();
    };
    const holdLog = (why) => { try { (window.__comicHoldLog ??= []).push({ t: Date.now(), ms, why }); } catch (_) {} };
    const advance = (why = 'timer') => { holdLog(why); cleanup(); if (!finished) fn(); };
    const onDown = (p) => { down = { x: p.x, y: p.y }; };
    const onUpTap = (p) => {
      if (!down) return;
      const moved = Math.hypot(p.x - down.x, p.y - down.y);
      down = null;
      if (moved > 12) return;                  // that was a strip drag
      advance('tap');
    };
    const onKey = () => advance('key');
    for (const o of taps) { o.on('pointerdown', onDown); o.on('pointerup', onUpTap); }
    scene.input.keyboard?.on('keydown-SPACE', onKey);
    scene.input.keyboard?.on('keydown-ENTER', onKey);
    // The timer: re-armed while the player is browsing back.
    holdLog('arm');
    const arm = (t) => { holdTimer = scene.time.delayedCall(t, () => { if (spent) return; if (browsingBack()) { arm(500); return; } advance('timer'); }); };
    arm(ms);
    objs.push({ destroy: cleanup });
  }

  // ── Balloons (vocabulary + placement) ──────────────────────────────────
  const U = unit(ART_W, ART_H);   // 4.5 px

  /** Measure-then-place one balloon of `kind`.  Long copy is split at the
   *  word cap FIRST (never shrunk), each part placed after the previous. */
  function balloon(container, text, box, tail, opts = {}) {
    const out = [];
    if (!text) return out;
    const kind = opts.kind ?? 'speech';
    const parts = splitByCap(text);
    const zones = opts.zones ?? migrateZones(opts.protect ?? []);
    const avoid = [...(opts.avoid ?? [])];
    let prev = null;
    parts.forEach((part, i) => {
      const last = i === parts.length - 1;
      if (kind === 'sfx') { out.push(...sfx(container, part, box, opts)); return; }
      const maxW = Math.max(120, box.w);
      // Size from PANEL scale: 16 px is the gameplay body size; a very short
      // line may go larger, never smaller than the floor.
      let size = wordsOf(part) <= 4 ? 18 : 16;
      const lineH0 = size * 1.2;
      // HUG THE LETTERING (owner 2026-09-11): wrap first, measure the text
      // block, then add only 0.8 em / 0.5 line-height of breathing room;
      // organic contours get a small bulge so the curve clears the corners.
      const pad = paddingFor(kind, size, lineH0);
      const bulge = bulgeFor(kind, lineH0);
      const face = kind === 'caption' ? CAPTION_FACE : LETTERING;
      const style = kind === 'caption' ? 'bold' : (kind === 'whisper' ? 'italic' : 'normal');
      const shown = kind === 'caption' ? String(part).toUpperCase() : part;
      const t = scene.add.text(0, 0, shown, { fontSize: `${size}px`, fontFamily: face, fontStyle: style, color: '#141414', wordWrap: { width: maxW - pad.x * 2 }, align: kind === 'caption' ? 'left' : 'center' });
      const textW = t.width, textH = t.height;
      const w = Math.min(maxW, textW + pad.x * 2 + bulge * 2), h = textH + pad.y * 2 + bulge * 2;
      const lineH = lineH0;
      const want = prev ? { x: Math.min(TILE_W - w - 6, prev.x + 30), y: prev.y + prev.h + 4, w, h } : { x: box.x, y: box.y, w, h };
      // Linked balloons: a continuation of the same speaker bridges to the
      // previous part; only the last part carries the speaker tail.
      const link = i > 0 ? prev : (opts.connectorFrom ?? null);
      const wantTail = last && kind !== 'caption' && kind !== 'offpanel' && kind !== 'sfx' ? tail : null;
      let L = layoutBalloon({ size: { w, h }, box: want, anchor: wantTail, zones, art: opts.art ?? null, bounds: opts.bounds ?? null, avoid, after: i === 0 ? (opts.after ?? null) : prev, lineH, connectorFrom: link });
      if (L.exception && link) L = layoutBalloon({ size: { w, h }, box: want, anchor: wantTail, zones, art: opts.art ?? null, bounds: opts.bounds ?? null, avoid, after: i === 0 ? (opts.after ?? null) : prev, lineH, connectorFrom: null });
      const g = scene.add.graphics();
      const fill = opts.fill ?? FILLS[kind] ?? 0xFFFFFF;
      const stroke = strokeFor(kind, U);
      const body = bodyShape(kind, L.rect, U, seedFor(part));
      const tl = tailShape(kind, L.tail, U);
      const cn = connectorShape(L.connector);
      g.fillStyle(fill, 1); g.lineStyle(stroke, INK, 1);
      if (cn?.polygon) { g.fillPoints(cn.polygon, true); g.strokePoints(cn.polygon, true); }
      if (tl?.polygon) { g.fillPoints(tl.polygon, true); g.strokePoints(tl.polygon, true); }
      if (tl?.bubbles) for (const b of tl.bubbles) { g.fillCircle(b.x, b.y, b.r); g.strokeCircle(b.x, b.y, b.r); }
      if (kind === 'caption') { g.fillStyle(0x000000, 0.35); g.fillRect(L.rect.x + 3, L.rect.y + 3, w, h); g.fillStyle(fill, 1); }
      g.fillPoints(body.outline, true);
      if (body.dash) { for (const [a, b] of dashOutline(body.outline, body.dash.dash, body.dash.gap)) g.lineBetween(a.x, a.y, b.x, b.y); }
      else g.strokePoints(body.outline, true);
      if (body.inner) { g.lineStyle(Math.max(1, stroke * 0.6), INK, 1); g.strokePoints(body.inner, true); }
      // Re-cover the tail/bridge base so the outline reads as open into it.
      if (tl?.polygon || cn?.polygon) { g.fillStyle(fill, 1); g.fillPoints(body.outline, true); }
      t.setPosition(kind === 'caption' ? L.rect.x + pad.x + bulge : L.rect.x + w / 2, kind === 'caption' ? L.rect.y + pad.y + bulge : L.rect.y + h / 2).setOrigin(kind === 'caption' ? 0 : 0.5);
      container.add([g, t]); out.push(g, t);
      avoid.push(L.rect); opts.placed?.push(L.rect); prev = L.rect;
      qaLog(opts, { kind, part, L, tail: wantTail, zones, lineH, textW, textH, fontPx: size });
      if (opts.debug) debugMark(opts.debug, L, opts.order ?? 0, L.exception || !L.clean);
    });
    return out;
  }

  /** Sound effect: free-floating lettering, rotated 6–10°, no box. */
  function sfx(container, text, box, opts) {
    const spec = sfxSpec(text, ART_W, (box.x + box.y) | 0);
    const t = scene.add.text(0, 0, spec.text, { fontSize: `${Math.min(spec.fontPx, 64)}px`, fontFamily: IMPACT, color: '#FFE45C', stroke: '#141414', strokeThickness: Math.max(3, U) }).setOrigin(0.5);
    const w = t.width + 8, h = t.height + 8;
    const L = layoutBalloon({ size: { w, h }, box: { x: box.x, y: box.y, w, h }, anchor: null, zones: opts.zones ?? migrateZones(opts.protect ?? []), art: opts.art ?? null, bounds: opts.bounds ?? null, avoid: opts.avoid ?? [], after: opts.after ?? null });
    t.setPosition(L.rect.x + w / 2, L.rect.y + h / 2).setAngle(spec.angleDeg);
    container.add(t);
    opts.placed?.push(L.rect);
    qaLog(opts, { kind: 'sfx', part: text, L, tail: null, zones: opts.zones ?? [], lineH: 16 });
    if (opts.debug) debugMark(opts.debug, L, opts.order ?? 0, !L.clean);
    return [t];
  }

  /** QA gates per placement (workshop Phase 3), into window.__comicLayoutLog. */
  function qaLog(opts, { kind, part, L, tail, zones, lineH, textW = 0, textH = 0, fontPx = 16 }) {
    const inRect = (p, r) => !!r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
    const faces = (zones ?? []).filter(z => z.level === 1);
    const attributed = !L.tail ? (kind === 'caption' || kind === 'sfx' || kind === 'offpanel' || !tail)
                     : faces.some(r => inRect({ x: L.tail.tx, y: L.tail.ty }, r)) || (tail && faces.some(r => inRect(tail, r)));
    const tailBaseW = L.tail?.baseW ?? 0, tailCeiling = TAIL_BASE_CEILING * (lineH ?? 16);
    const b = opts.bounds ?? { x: 0, y: 0, w: TILE_W, h: ART_H };
    const clipped = L.rect.x < b.x || L.rect.y < b.y || L.rect.x + L.rect.w > b.x + b.w || L.rect.y + L.rect.h > b.y + b.h;
    const underTray = L.rect.y + L.rect.h > (opts.safeBottom ?? (TRAY_BOTTOM - TRAY_MAX_H)) + 0.5;
    const flush = !clipped && (L.rect.x - b.x < 4 || L.rect.y - b.y < 4 || b.x + b.w - (L.rect.x + L.rect.w) < 4);
    const rec = { stop: scene._stop?.id ?? null, node: opts.nodeId ?? null, kind, text: String(part).slice(0, 48), words: wordsOf(part),
      slot: L.slot, clean: L.clean, exception: !!L.exception, l2: +(L.l2 ?? 0).toFixed(3), l3: +(L.l3 ?? 0).toFixed(3), order: L.order !== false,
      tailClipped: !!L.tail?.clipped, tailRouted: !!L.tail?.via, tailBaseW: +tailBaseW.toFixed(1), tailWidthOK: tailBaseW <= tailCeiling + 0.01, linked: !!L.connector,
      attributed, clipped, flush, underTray, rect: L.rect,
      // PASS = no face (exception=false), attributed, in bounds, above the tray, ≤ cap, order holds, tail narrow.
      why: L.why ?? [],
      // Hug-the-lettering QA (owner 2026-09-11): text block, body, padding per side, excess flag.
      textBounds: { w: +textW.toFixed(1), h: +textH.toFixed(1) }, bodyBounds: { w: +L.rect.w.toFixed(1), h: +L.rect.h.toFixed(1) },
      padding: { left: +((L.rect.w - textW) / 2).toFixed(1), right: +((L.rect.w - textW) / 2).toFixed(1), top: +((L.rect.h - textH) / 2).toFixed(1), bottom: +((L.rect.h - textH) / 2).toFixed(1), em: +(((L.rect.w - textW) / 2) / fontPx).toFixed(2), lh: +(((L.rect.h - textH) / 2) / (lineH || fontPx * 1.2)).toFixed(2) },
      excessBalloonArea: kind === 'sfx' ? false : excessBalloonArea(kind, textW, textH, L.rect.w, L.rect.h, fontPx, lineH).flagged,
      pass: false };
    rec.pass = !L.exception && attributed && !clipped && !underTray && wordsOf(part) <= WORD_CAP && L.order !== false && tailBaseW <= tailCeiling + 0.01 && !rec.excessBalloonArea;
    try { (window.__comicLayoutLog ??= []).push(rec); } catch (_) {}
  }

  /** Green = zero face overlap AND best semantic score (no Level-2 overlap);
   *  amber = Level-2 overlap used; red = exception.  Label = L2/L3 overlap %. */
  function debugMark(gfx, L, order, bad) {
    const col = L.exception ? 0xFF3030 : (L.clean === false ? 0xFF9A20 : 0x30FF60);
    gfx.lineStyle(2, col, 1);
    gfx.strokeRect(L.rect.x, L.rect.y, L.rect.w, L.rect.h);
    if (L.tail) {
      gfx.lineStyle(2, 0xFFE030, 1);
      const m = { x: (L.tail.ax + L.tail.bx) / 2, y: (L.tail.ay + L.tail.by) / 2 };
      if (L.tail.via) { gfx.lineBetween(m.x, m.y, L.tail.via.x, L.tail.via.y); gfx.lineBetween(L.tail.via.x, L.tail.via.y, L.tail.tx, L.tail.ty); }
      else gfx.lineBetween(m.x, m.y, L.tail.tx, L.tail.ty);
      gfx.fillStyle(0xFFE030, 1); gfx.fillCircle(L.tail.tx, L.tail.ty, 3);
    }
    if (L.connector) { gfx.lineStyle(2, 0x80FFE0, 1); gfx.lineBetween(L.connector.from.x, L.connector.from.y, L.connector.to.x, L.connector.to.y); }
    const lbl = L.l2 != null ? `${order} · L2 ${Math.round((L.l2 ?? 0) * 100)}% L3 ${Math.round((L.l3 ?? 0) * 100)}%` : String(order);
    const n = scene.add.text(L.rect.x - 2, L.rect.y - 2, lbl, { fontSize: '11px', fontFamily: IMPACT, color: '#FFF', backgroundColor: '#000', padding: { x: 4, y: 1 } }).setOrigin(1, 1);
    gfx.parentContainer?.add(n);
    gfx._debugTexts = (gfx._debugTexts ?? []).concat(n);
  }

  // ── Tile ────────────────────────────────────────────────────────────────
  function buildTile(storyId, nodeId, node) {
    const c = scene.add.container(tiles.length * (TILE_W + GAP), 0);
    let panelKey = panelKeyFor(storyId, nodeId);
    let meta     = panelMeta(panelKey);
    const bg = scene.add.graphics();
    bg.fillGradientStyle(0x1B2A44, 0x1B2A44, 0x0A1020, 0x0A1020, 1); bg.fillRect(0, 0, TILE_W, ART_H);
    c.add(bg);
    // The art fills the tile (16:9 into 16:9); authored 0–1 coordinates map 1:1.
    const AW = Math.min(TILE_W, ART_H * (16 / 9)), AH = AW * (9 / 16), AX = (TILE_W - AW) / 2, AY = (ART_H - AH) / 2;
    const rectPx = (r) => ({ x: AX + r.x * AW, y: AY + r.y * AH, w: r.w * AW, h: r.h * AH, kind: r.kind });
    const ptPx   = (p) => ({ x: AX + p.x * AW, y: AY + p.y * AH });

    let artObjs = [];
    let artReq = 0;
    const drawArt = () => {
      const myReq = ++artReq;
      for (const o of artObjs) o.destroy();
      artObjs = [];
      const url = meta.art;
      if (url && scene.textures.exists(url)) {
        const img = scene.add.image(AX + AW / 2, AY + AH / 2, url).setDisplaySize(AW, AH).setOrigin(0.5);
        c.add(img); artObjs.push(img);
        c.sendToBack?.(img); c.sendToBack?.(bg);
        return;
      }
      const ph = scene.add.text(AX + AW / 2, AY + AH / 2, url ? 'STORY ART LOADING…' : 'STORY ART PENDING', { fontSize: '11px', fontFamily: IMPACT, color: '#3E5A80' }).setOrigin(0.5);
      c.add(ph); artObjs.push(ph);
      if (!url) return;
      if (scene.load.isLoading()) { scene.load.once('complete', () => { if (c.active !== false && myReq === artReq) drawArt(); }); return; }
      scene.load.image(url, url);
      loadedArtKeys.add(url);
      scene.load.once('complete', () => { if (c.active !== false && myReq === artReq) drawArt(); });
      scene.load.start();
    };
    drawArt();
    c.add(scene.add.text(10, ART_H - 8, `${scene._stop?.name ?? ''} · MILE ${Math.round(scene._odometer ?? 0)}`, { fontSize: '11px', fontFamily: IMPACT, color: '#8FB7E6' }).setOrigin(0, 1));
    try { story.noteNodeShown?.(storyId, nodeId, scene._odometer ?? 0); } catch (_) {}

    // Placement context: balloons live ABOVE the tray band — the REAL tray
    // for this node's choice count (none for an authored line or a beat),
    // and once a choice is made the tray retracts and the whole panel above
    // the TAP hint is usable again (the tray is a temporary obstruction, not
    // a permanent crop — owner-approved direction).
    const nChoices = story.choicesFor(storyId, nodeId).length;
    const trayHFor = (n) => n > 1 ? Math.min(TRAY_MAX_H, n * (38 + BTN_GAP) + 18) : 0;
    const HINT_BAND = 34;
    let safeBottom = Math.min(TRAY_BOTTOM - trayHFor(nChoices) - 4, SCREEN_H - HINT_BAND);
    const artRect  = () => ({ x: AX, y: AY, w: AW, h: Math.min(AH, safeBottom - AY) });
    const tileRect = () => ({ x: 0, y: 0, w: TILE_W, h: Math.min(ART_H, safeBottom) });
    let protectPx  = (meta.protect ?? []).map(rectPx);
    const zonesOf  = (m) => migrateZones((m.protect ?? []).map(rectPx), (m.zones ?? []).map(z => ({ ...rectPx(z), level: z.level, kind: z.kind, speaker: z.speaker })));
    let zonesPx    = zonesOf(meta);
    const placed   = [];
    let order      = 0;
    let dbg = null;
    const debugBase = (rebuild = false) => {
      if (!comicDebug()) return null;
      if (dbg && !rebuild) { c.bringToTop(dbg); return dbg; }
      if (dbg) { for (const t of dbg._debugTexts ?? []) t.destroy(); dbg.destroy(); }
      dbg = scene.add.graphics(); c.add(dbg); dbg.parentContainer = c;
      // Zones coloured by level: red = faces (L1), orange = essential bodies /
      // story objects (L2), blue = scene detail (L3).
      for (const z of zonesPx) { dbg.lineStyle(2, LEVEL_COLORS[z.level] ?? 0xFFFFFF, 0.95); dbg.strokeRect(z.x, z.y, z.w, z.h); }
      dbg.fillStyle(0xFF30E0, 1);
      const m1 = ptPx(meta.tail), m2 = ptPx(meta.playerTail);
      dbg.fillCircle(m1.x, m1.y, 4); dbg.fillCircle(m2.x, m2.y, 4);
      return dbg;
    };
    const ctx = () => ({ protect: protectPx, zones: zonesPx, art: artRect(), bounds: tileRect(), avoid: placed, placed, debug: debugBase(), order: ++order, nodeId, safeBottom });
    const redrawDebug = () => { if (!comicDebug()) return; const d = debugBase(true); let i = 0; for (const r of placed) debugMark(d, { rect: r, tail: null, clean: true }, ++i, false); };
    /** Tile-level reading-order gate: the geometric order of the visible
     *  balloons (bands top→bottom, left→right) must equal the authored order. */
    const logTileOrder = () => {
      const geo = readingOrder(placed);
      const ok = geo.every((v, i) => v === i);
      try { (window.__comicLayoutLog ??= []).push({ stop: scene._stop?.id ?? null, node: nodeId, kind: 'tile-order', text: `${placed.length} balloons`, words: 0, slot: '-', clean: ok, exception: false, order: ok, attributed: true, clipped: false, underTray: false, tailWidthOK: true, pass: ok, geo }); } catch (_) {}
      return ok;
    };

    // Mouth anchor for a named speaker: the node's speaker uses `tail`, the
    // player `playerTail`, others `mouths[name]` when authored, else no tail
    // (off-panel convention) — never a tail aimed at a random object.
    const anchorFor = (speaker, kind) => {
      if (kind === 'caption' || kind === 'sfx' || kind === 'offpanel') return null;
      if (speaker === 'The Crew' || speaker === 'Crowd') return null;   // never in frame: no tail
      if (speaker === node.speaker) return ptPx(meta.tail);
      const m = meta.mouths?.[speaker];
      return m ? ptPx(m) : null;
    };

    // CAPTION first.
    caption(story.resolveCaption?.(storyId, nodeId) ?? '');
    function caption(text) {
      if (!text) return;
      balloon(c, text, meta.caption ? rectPx(meta.caption) : { x: AX + 10, y: AY + 10, w: AW * 0.40, h: AH * 0.24 }, null, { kind: 'caption', ...ctx() });
    }

    let npcBox  = rectPx(meta.bubble);
    let npcTail = ptPx(meta.tail);
    let npcRects = [];
    let openingRects = [];         // every rect of the opening sequence (line reads after them)
    let swapped = false;
    let lastPlayerRect = null;
    let npcParts = [], replyParts = [], openingParts = [];
    const placeNpc = (text, box, extra = {}) => {
      const o = { ...ctx(), ...extra }; const before = placed.length;
      const parts = balloon(c, text, box, o.anchor === undefined ? npcTail : o.anchor, o);
      if (!extra.after) npcRects = placed.slice(before);
      return parts;
    };

    // OPENING SEQUENCE: node.lines in order (slots from meta.extra[i], else
    // leapfrog under the previous), then the main line.  Revealed 2 s apart.
    const opening = story.resolveLines?.(storyId, nodeId) ?? [];
    const mainLine = story.resolveLine(storyId, nodeId);
    const seq = [...opening.map((l, i) => ({ ...l, slot: meta.extra?.[i] ? rectPx(meta.extra[i]) : null })), ...(mainLine ? [{ speaker: node.speaker, kind: node.lineKind ?? 'speech', text: mainLine, slot: npcBox, main: true }] : [])];
    let seqTimer = null, seqDone = false, onSeqDone = null;
    const revealNext = (k) => {
      if (finished || c.active === false) return;
      if (k >= seq.length) { seqDone = true; logTileOrder(); onSeqDone?.(); return; }
      const item = seq[k];
      const anchor = item.offpanel ? null : (item.main ? npcTail : anchorFor(item.speaker, item.kind));
      const prevRect = openingRects.at(-1) ?? null;
      const prevItem = k > 0 ? seq[k - 1] : null;
      const box = item.slot ?? (prevRect ? { x: prevRect.x, y: prevRect.y + prevRect.h + 6, w: npcBox.w, h: npcBox.h } : npcBox);
      const before = placed.length;
      const sameSpeaker = !!prevItem && prevItem.speaker === item.speaker && !['sfx', 'caption', 'offpanel'].includes(item.kind) && !['sfx', 'caption', 'offpanel'].includes(prevItem.kind);
      let parts = [];
      try { parts = placeNpc(item.text, box, { kind: item.kind, anchor, after: prevRect, connectorFrom: sameSpeaker ? prevRect : null }); }
      catch (e) { console.warn('[StoryTile] opening balloon failed', e); }
      if (item.main) npcParts = parts;
      openingParts.push(...parts);
      openingRects.push(...placed.slice(before));
      if (item.main) npcRects = placed.slice(before);
      seqTimer = scene.time.delayedCall(readMs(item.text), () => revealNext(k + 1));
    };
    revealNext(0);
    const tile = {
      c, storyId, nodeId, node,
      get panelKey() { return panelKey; },
      whenOpened(fn) { if (seqDone) fn(); else onSeqDone = fn; },
      lastOpening: () => seq.at(-1)?.text ?? '',
      setPanelKey(key) {
        if (!key || key === panelKey) return;
        panelKey = key;
        meta = panelMeta(key);
        npcBox  = rectPx(meta.bubble);
        npcTail = ptPx(meta.tail);
        protectPx = (meta.protect ?? []).map(rectPx);
        zonesPx = zonesOf(meta);
        swapped = true;
        // Every OPENING balloon was placed against the old art; none may stay.
        for (const o of openingParts) o.destroy(); openingParts = []; npcParts = [];
        for (const r of openingRects) { const i = placed.indexOf(r); if (i >= 0) placed.splice(i, 1); }
        openingRects = []; npcRects = [];
        drawArt();
        redrawDebug();
      },
      /** The NPC's reply lands AFTER the player's balloon (authored
       *  `replyBubble`, else directly below it, else to its right, else a low
       *  corner).  On an art swap the opening line is gone and the reply takes
       *  the new panel's bubble slot. */
      setReply(text, kind = 'speech', speaker = node.speaker, offpanel = false) {
        if (!text) return;
        const pref = meta.replyBubble ? rectPx(meta.replyBubble)
                   : swapped || !lastPlayerRect ? npcBox
                   : { x: lastPlayerRect.x, y: lastPlayerRect.y + lastPlayerRect.h + 6, w: npcBox.w, h: npcBox.h };
        const anchor = offpanel ? null : (speaker === node.speaker ? npcTail : anchorFor(speaker, kind));
        const before = placed.length;
        replyParts.push(...placeNpc(text, pref, { kind, anchor, after: placed.at(-1) ?? lastPlayerRect ?? npcRects[0] ?? null }));
        return placed[before] ?? null;
      },
      setPlayer(text) {
        const before = placed.length;
        balloon(c, text, rectPx(meta.playerBubble), ptPx(meta.playerTail), { kind: 'player', ...ctx(), after: swapped ? null : (openingRects.at(-1) ?? null) });
        lastPlayerRect = placed[before] ?? lastPlayerRect;
      },
      destroyTimers() { seqTimer?.remove?.(); },
      logOrder: logTileOrder,
      /** The tray has retracted: the lower panel is placeable again. */
      releaseTray() { safeBottom = SCREEN_H - HINT_BAND; },
    };
    strip.add(c);
    tiles.push(tile);
    return tile;
  }

  // ── Responses: translucent verbal-response tray ─────────────────────────
  function clearButtons(fadeMs = 0) {
    const old = btnObjs; btnObjs = [];
    if (!fadeMs) { for (const b of old) b?.destroy?.(); return; }
    for (const b of old) { if (b?.type === 'Text' && b.text === 'TAP TO CONTINUE') { b.destroy(); continue; } if (b?.setAlpha) scene.tweens.add({ targets: b, alpha: 0, duration: fadeMs, onComplete: () => b.destroy() }); else b?.destroy?.(); }
  }

  function showButtons(tile) {
    clearButtons();
    const { storyId, nodeId, node } = tile;
    const choices = story.choicesFor(storyId, nodeId);
    const cash = scene._score ?? 0;
    // A choice-less BEAT (`node.next`): hold, then advance.
    if (!choices.length && node.next) {
      holdThen(holdMs(tile.lastOpening(), true), () => advanceTo(storyId, node.next, null));
      return;
    }
    const list = choices.length ? choices : [{ id: '__tbc', label: 'TO BE CONTINUED…', consequential: false, next: null, effects: {}, _exit: true }];
    // AUTHORED MANDATORY PLAYER LINE: a one-item list is not a decision — it
    // plays as the player's balloon after the reading gap, never as a button.
    if (list.length === 1 && !list[0]._exit) {
      const ch = list[0];
      scene.time.delayedCall(readMs(tile.lastOpening()), () => { if (!finished && tiles.at(-1) === tile) pick(tile, ch); });
      return;
    }
    // Tray: smoked glass over the lower part of the art, cream sentence-case
    // choice surfaces in the dialogue face with a quote tail motif.
    const n = list.length;
    const bh = 38;
    const trayH = Math.min(TRAY_MAX_H, n * (bh + BTN_GAP) + 18);
    const trayTop = TRAY_BOTTOM - trayH;
    btnObjs.push(scene.add.rectangle(SCREEN_W / 2, trayTop + trayH / 2, SCREEN_W, trayH, 0x070B14, 0.80).setDepth(D + 3));
    let y = trayTop + 10;
    for (const ch of list) {
      const cost = Math.max(0, ch.cost | 0);
      const afford = cost <= cash;
      const label = cost ? `${ch.label}  ($${cost})` : ch.label;
      const g = scene.add.graphics().setDepth(D + 3);
      const draw = (hover) => {
        g.clear();
        g.fillStyle(afford ? 0xFFF9D6 : 0x8A8378, hover ? 1 : 0.92);
        g.lineStyle(2, INK, 1);
        g.fillRoundedRect(28, y, ART_W - 56, bh, 9); g.strokeRoundedRect(28, y, ART_W - 56, bh, 9);
        // quote-tail motif on the left: these are sentences the player may say
        g.fillTriangle(24, y + bh - 6, 34, y + bh - 14, 40, y + bh - 2); g.lineBetween(24, y + bh - 6, 34, y + bh - 14); g.lineBetween(24, y + bh - 6, 40, y + bh - 2);
      };
      draw(false);
      const lbl = scene.add.text(48, y + bh / 2, label, {
        fontSize: '16px', fontFamily: LETTERING, color: afford ? '#141414' : '#3A3630', wordWrap: { width: ART_W - 96 }, align: 'left',
      }).setOrigin(0, 0.5).setDepth(D + 4);
      btnObjs.push(g, lbl);
      if (afford) {
        g.setInteractive(new Phaser.Geom.Rectangle(28, y, ART_W - 56, bh), Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
        g.on('pointerover', () => draw(true));
        g.on('pointerout',  () => draw(false));
        g.on('pointerdown', (p, _x, _y, ev) => {
          scene._eatTap(p, ev);
          if (scene._tapBlocked(p)) return;
          scene._gateTaps();
          pick(tile, ch);
        });
      }
      y += bh + BTN_GAP;
    }
  }

  // ── Selection → commit → reveal → hold → advance ────────────────────────
  function pick(tile, ch) {
    // Unselected choices fade promptly; the tray retracts for the reading hold.
    clearButtons(220);
    if (ch._exit) { finish(); return; }
    tile.releaseTray?.();
    const { storyId, nodeId } = tile;
    const r = story.commitChoice({ storyId, nodeId, choiceId: ch.id, mile: scene._odometer ?? 0, stopId }, {
      cash: (n) => { const d = (scene._infiniteMoney?.() && n < 0) ? 0 : n; scene._score = Math.max(0, (scene._score ?? 0) + d); scene._refreshScore?.(); },
      unlockGenre: (g) => { try { window.__genre?.own?.(g); } catch (_) {} },
      contact:     (ct) => { (scene._purchases.storyContacts ??= []).push(ct); },
      wanted:      (n) => { const cur = scene._stars ?? 0; if (n > cur) scene._purchases.bumpStarsOnResume = (scene._purchases.bumpStarsOnResume ?? 0) + (n - cur); scene._stars = Math.max(cur, n); },
      passenger:   (p) => { scene._purchases.storyPassenger = p ?? null; },
      radioGrant:  (g) => { scene._purchases.storyRadioGrant = g ?? null; },
    });
    // FAIL-SAFE (owner 2026-09-11, stuck after a selection): the commit is
    // already persisted; whatever a rendering step throws, the hold is armed
    // and the conversation can always advance.
    const reply = story.resolveReply(storyId, nodeId, ch.id);
    const after = story.resolveAfter?.(storyId, nodeId, ch.id) ?? [];
    if (r.applied && r.leaveStop) leaveAfter = true;
    try {
      tile.setPanelKey(r?.entry?.panelKey ?? resolvePanelKey({ storyId, nodeId, choiceId: ch.id, node: tile.node, choice: ch }));
      tile.setPlayer(ch.label);
    } catch (e) { console.warn('[StoryTile] player balloon failed', e); }
    // Reveal: reply after the player's reading gap, then each `after` line.
    const followers = [...(reply ? [{ text: reply, kind: ch.replyKind ?? 'speech', speaker: tile.node.speaker }] : []), ...after];
    let t = readMs(ch.label);
    let lastText = ch.label;
    followers.forEach((f, i) => {
      const at = t;
      scene.time.delayedCall(at, () => { if (finished) return; try { tile.setReply(f.text, f.kind, f.speaker, !!f.offpanel); } catch (e) { console.warn('[StoryTile] reply balloon failed', e); } });
      t += readMs(f.text);
      lastText = f.text;
    });
    const npcLast = followers.length > 0;
    // Timing begins after the last balloon has appeared.
    const holdStart = followers.length ? t - readMs(lastText) + 300 : 300;
    scene.time.delayedCall(holdStart, () => {
      if (finished) return;
      try { tile.logOrder?.(); } catch (_) {}
      holdThen(holdMs(lastText, npcLast), () => advanceTo(storyId, r.next ?? null, r));
    });
  }

  function advanceTo(storyId, nextId, r) {
    const nextNode = nextId ? getStoryNode(storyId, nextId) : null;
    const stillActive = story.isActive(storyId) || story.status(storyId) === 'available';
    if (nextNode && stillActive && nextNode.stopId === stopId) {
      if (!r) story.advance?.(storyId, nextId);
      openNode(storyId, nextId, nextNode);
    } else {
      finish();
    }
  }

  function openNode(storyId, nodeId, node) {
    const tile = buildTile(storyId, nodeId, node);
    header.setText(`${node.speaker ?? ''}`.toUpperCase());
    const target = stripTargetX();
    if (tiles.length === 1) { strip.x = target; }
    else { scene.tweens.add({ targets: strip, x: target, duration: 420, ease: 'Cubic.easeOut' }); }
    // The tray appears only after the opening dialogue has been revealed.
    tile.whenOpened(() => showButtons(tile));
  }

  // ── Go ──────────────────────────────────────────────────────────────────
  const node0 = getStoryNode(start.storyId, start.nodeId);
  if (!node0) { finish(); return; }
  openNode(start.storyId, start.nodeId, node0);
}
