/**
 * Live story conversation tile — Ch. 18.3 "Live comic presentation".
 *
 * Drawn with Phaser over the rest-stop shop (depth 600, above the ordinary
 * encounter card at 500).  One landscape tile per story node: clean panel
 * art (placeholder until Phase 8), a white speech balloon with the NPC's
 * line in comic lettering, and the player's SPOKEN responses as buttons
 * beneath the art.  Choosing one commits through StorySystem.commitChoice
 * BEFORE any animation (18.2), drops the player's line into its balloon,
 * shows the NPC's reaction, then slides the finished tile left into the
 * strip.  Part of the previous tile stays visible and the strip can be
 * dragged back through the conversation; a new choice snaps to the newest
 * tile.
 *
 * This module never touches the existing `_showEncounterCard` — single-step
 * encounters keep their card (18.11 "preserve existing single-step
 * encounters").  It borrows the scene's tap-gating helpers and its live
 * `_score` so story cash flows through the same wallet path as shop
 * purchases and encounter effects.
 *
 * Relationship frames / mood icons (Phase 4-5) are gameplay overlays drawn
 * here, never in the comic record.
 */

import { SCREEN_W, SCREEN_H } from '../constants.js';
import { getStoryNode } from '../data/featuredStories.js';
// NOTE: the NPC portrait import is deliberately gone.  The tile used to draw a
// rest-stop portrait as stand-in "art", which is how an unrelated character
// appeared in a Brittney panel.  A panel with no approved art now shows a
// placeholder instead (Ch.18 missing-art policy).
import { panelMeta, panelKeyFor, resolvePanelKey } from '../data/comicPanels.js';
import { layoutBalloon } from './balloonLayout.js';

const D = 600;
// Caption boxes (narration) are a different content type from speech
// (workshop §C): square-ish, no tail, its own paper colour and typeface.
const CAPTION_FACE = '"Comic Neue", "Trebuchet MS", "Helvetica Neue", Arial, sans-serif';
const CAPTION_FILL = 0xFFF1B8;
/** Debug overlays (workshop §D): protected rects, mouth points, balloon
 *  bounds, tail paths, reading order, tray-risk area.  `?comicdebug=1` or
 *  `window.__comicDebug = true`. */
const comicDebug = () => { try { return !!window.__comicDebug; } catch (_) { return false; } };
/** Reading pace (owner 2026-09-10: "bubble appearances should be 2 sec apart
 *  unless really long"): 2 s between balloons, plus 90 ms for every word past
 *  eight so a long line gets its time before the next balloon lands. */
export const BALLOON_GAP_MS = 2000;
export const BALLOON_MS_PER_EXTRA_WORD = 90;
export function readMs(text) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean).length;
  return BALLOON_GAP_MS + Math.max(0, words - 8) * BALLOON_MS_PER_EXTRA_WORD;
}
// Comic lettering with a readable fallback (character-specific faces land
// with the Phase-8 art; iOS ships Chalkboard SE / Marker Felt, macOS Comic
// Sans MS, everything else falls to a humanist sans).
export const LETTERING = '"Chalkboard SE", "Comic Sans MS", "Marker Felt", "Trebuchet MS", Arial, sans-serif';
const IMPACT = 'Impact, "Arial Black", Arial, sans-serif';

// FULL-SCREEN tile (owner 2026-09-10: "the comic tiles are still not taking
// up the full screen").  The screen is 800×450 = exactly 16:9, the same
// aspect as every page panel (PANEL_ASPECT), so the art fills it edge to
// edge with no side bars and no crop.  The response tray is TRANSLUCENT over
// the bottom band of the art (workshop: "translucent response tray"); that
// band is the tray-risk area and balloons are kept out of it.
const ART_W  = SCREEN_W;                            // 800
const ART_H  = SCREEN_H;                            // 450
const ART_X  = 0;
const ART_Y  = 0;
const PEEK   = 0;       // the newest tile owns the screen; drag right to browse back
const GAP    = 8;
const TILE_W = ART_W - PEEK;
const BTN_AREA_H = 104;
const BTN_TOP = SCREEN_H - BTN_AREA_H - 6;          // 340
const BTN_GAP = 4;
const MIN_FONT = 13;

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
 *                _tapBlocked, _eatTap, _swallowTaps, _ensureNpcTexture,
 *                _score, _purchases, _stop, _odometer)
 * @param start   { storyId, nodeId }
 * @param onDone  called once when the conversation closes
 */
export function showStoryConversation(scene, start, onDone) {
  const story = scene.registry.get('story');
  if (!story) { onDone?.(); return; }
  const stopId = scene._stop?.id;
  let finished = false, leaveAfter = false;
  // Panel textures this conversation loaded on demand.  A 1672x941 panel costs
  // ~6.0 MB DECODED (w x h x 4) no matter how small its PNG is, so leaving them
  // in Phaser's TextureManager would grow the resident set every stop — the
  // exact class of retention behind the iPhone restarts.  Released after
  // teardown, once the tiles using them are destroyed.  ComicReader keeps its
  // own HTMLImageElement cache, so the book is unaffected.
  const loadedArtKeys = new Set();
  const finish = () => {
    if (finished) return; finished = true;
    scene._storyTileOpen = false;      // the rest stop owns SPACE again
    teardown();
    for (const k of loadedArtKeys) {
      try { scene.textures.remove(k); } catch (_) {}
    }
    loadedArtKeys.clear();
    if (leaveAfter && typeof scene._continue === 'function') { scene._continue(); return; }
    onDone?.();
  };

  // ── Chrome ──────────────────────────────────────────────────────────────
  const objs = [];
  const add = (...n) => { objs.push(...n); return n[0]; };
  scene._gateTaps();
  // Full-screen scrim.  Captured because the tap-to-continue gate has to hook
  // THIS object (and dragZone) rather than scene.input: _swallowTaps calls
  // _eatTap → ev.stopPropagation(), and in Phaser that aborts the scene-level
  // pointer event, so a scene.input listener never sees the tap at all.
  const scrim = add(scene._swallowTaps(scene.add.rectangle(SCREEN_W / 2, SCREEN_H / 2, SCREEN_W, SCREEN_H, 0x02040B, 0.86).setDepth(D)));
  // A story conversation owns the screen: the rest stop's "SPACE = leave"
  // binding must not fire under it, or the player is thrown back onto the road
  // and skips the rest-stop menu entirely (owner 2026-09-09 — made the
  // bathroom unreachable with Brittney aboard).
  scene._storyTileOpen = true;
  // Viewport frame around the art.
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
    // Tray-risk area: where the response tray sits.  Nothing that must stay
    // readable may be placed here (workshop §D).
    add(scene.add.rectangle(SCREEN_W / 2, BTN_TOP + BTN_AREA_H / 2, ART_W, BTN_AREA_H, 0xFF9020, 0.14).setDepth(D + 6));
    add(scene.add.text(ART_X + 4, BTN_TOP + 2, 'TRAY RISK', { fontSize: '9px', fontFamily: IMPACT, color: '#FF9020' }).setDepth(D + 6));
  }

  const tiles = [];          // { c: Container, w }
  let btnObjs = [];
  let dragging = null;
  // Strip x is ABSOLUTE (the container was created at ART_X) — the newest
  // tile sits at ART_X + PEEK, older ones off to the left behind the mask.
  const stripTargetX = () => ART_X + (tiles.length ? PEEK - (tiles.length - 1) * (TILE_W + GAP) : 0);
  const stripMinX = () => stripTargetX();
  const stripMaxX = () => ART_X + PEEK;

  // Drag back through earlier tiles (18.3 step 7).
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

  function teardown() {
    for (const b of btnObjs) b?.destroy?.();
    for (const o of objs) o?.destroy?.();
  }

  /** Hold a finished tile on screen until the player TAPS (owner 2026-09-07).
   *
   *  Replaces a fixed auto-advance timer, which cut a beat off mid-read on a
   *  long reply and rushed short ones.  The player now sets the pace.
   *
   *  A DRAG is not a tap: the strip can be scrubbed back through earlier tiles
   *  (18.3 step 7), and browsing it must never advance the conversation — so a
   *  pointer that moved more than a few px is ignored. */
  function awaitTapThen(fn) {
    if (finished) return;
    const hint = scene.add.text(SCREEN_W / 2, SCREEN_H - 22, 'TAP TO CONTINUE', {
      fontSize: '14px', fontFamily: IMPACT, color: '#8FB7E6', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(D + 5);
    btnObjs.push(hint);
    const pulse = scene.tweens.add({ targets: hint, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });

    let down = null, spent = false;
    // Hook the OBJECTS, not scene.input.  The scrim's _swallowTaps handler and
    // dragZone both call _eatTap → ev.stopPropagation(), which in Phaser aborts
    // the scene-level pointer event — so `scene.input.on('pointerup')` never
    // fired and the prompt was unclickable (owner 2026-09-09).  These two
    // cover the whole screen between them: dragZone the art, the scrim the rest.
    const taps = [dragZone, scrim].filter(Boolean);
    const cleanup = () => {
      if (spent) return; spent = true;
      for (const o of taps) {
        try { o.off('pointerdown', onDown); o.off('pointerup', onUpTap); } catch (_) {}
      }
      try { scene.input.keyboard?.off('keydown-SPACE', onKey); } catch (_) {}
      try { scene.input.keyboard?.off('keydown-ENTER', onKey); } catch (_) {}
      try { pulse?.remove?.(); } catch (_) {}
      hint.destroy();
    };
    const advance = () => { cleanup(); if (!finished) fn(); };
    const onDown = (p) => { down = { x: p.x, y: p.y }; };
    const onUpTap = (p) => {
      if (!down) return;                       // a stray release, not a tap here
      const moved = Math.hypot(p.x - down.x, p.y - down.y);
      down = null;
      if (moved > 12) return;                  // that was a strip drag
      advance();
    };
    // SPACE/ENTER advance the conversation too.  Without this they fell through
    // to the rest stop's own "SPACE = leave" binding, which dumped the player
    // back on the road mid-conversation.
    const onKey = () => advance();
    for (const o of taps) { o.on('pointerdown', onDown); o.on('pointerup', onUpTap); }
    scene.input.keyboard?.on('keydown-SPACE', onKey);
    scene.input.keyboard?.on('keydown-ENTER', onKey);
    objs.push({ destroy: cleanup });
  }

  // ── Balloons ────────────────────────────────────────────────────────────
  /** White speech balloon with a tail; auto-sizes small/medium/large, splits
   *  into two linked balloons when even the smallest readable size overflows.
   *
   *  FACE PROTECTION (workshop §D): the measured balloon is placed through
   *  layoutBalloon() against the panel's `protect` rects, the balloons already
   *  on this tile (`opts.avoid`) and the art/tile bounds — authored slot first,
   *  then the art corners, then the gutter.  The tail is clipped so it stops
   *  short of the protected face it points at and never crosses another.
   *  `opts.placed` (an array) receives the final rects; `opts.debug` (a
   *  Graphics) gets the overlays. */
  function balloon(container, text, box, tail, opts = {}) {
    const out = [];
    if (!text) return out;
    const maxW = box.w, maxH = box.h;
    const sizes = [20, 18, 16, 14, MIN_FONT];
    let size = sizes[sizes.length - 1], probe = null;
    for (const s of sizes) {
      probe?.destroy();
      probe = scene.add.text(0, 0, text, { fontSize: `${s}px`, fontFamily: LETTERING, color: '#111', wordWrap: { width: maxW - 24 }, align: 'center' }).setVisible(false);
      if (probe.height + 20 <= maxH) { size = s; break; }
      size = s;
    }
    let parts = [text];
    if (probe.height + 20 > maxH) {
      // Two linked balloons: split at the sentence boundary nearest the middle.
      const m = text.match(/^(.{20,}?[.!?…])\s+(.+)$/s);
      if (m) parts = [m[1], m[2]];
    }
    probe.destroy();
    const fill = opts.fill ?? 0xFFFFFF;
    const protect = opts.protect ?? [];
    const avoid = [...(opts.avoid ?? [])];
    let prev = null;
    parts.forEach((part, i) => {
      const t = scene.add.text(0, 0, part, { fontSize: `${size}px`, fontFamily: LETTERING, color: '#111', wordWrap: { width: maxW - 24 }, align: 'center' });
      const w = Math.min(maxW, t.width + 24), h = t.height + 18;
      const last = i === parts.length - 1;
      // A linked second balloon hangs under the first; only the last carries the tail.
      const want = prev ? { x: Math.min(TILE_W - w - 6, prev.x + 40), y: prev.y + prev.h - 6, w, h } : { x: box.x, y: box.y, w, h };
      const L = layoutBalloon({ size: { w, h }, box: want, anchor: last ? tail : null, protect, art: opts.art ?? null, bounds: opts.bounds ?? null, avoid, after: i === 0 ? (opts.after ?? null) : null });
      const { x: bx, y: by } = L.rect;
      const g = scene.add.graphics();
      if (L.tail) {
        // Tail leaves from the balloon EDGE that faces the speaker anchor
        // (never across the text), drawn first so the balloon body sits on
        // top of its base.  Its tip stops OUTSIDE the protected face.
        const { ax, ay, bx: bx2, by: by2, tx, ty } = L.tail;
        g.fillStyle(fill, 1); g.lineStyle(2.5, 0x111111, 1);
        g.fillTriangle(ax, ay, bx2, by2, tx, ty);
        g.lineBetween(ax, ay, tx, ty); g.lineBetween(bx2, by2, tx, ty);
      }
      g.fillStyle(fill, 1); g.lineStyle(2.5, 0x111111, 1);
      g.fillRoundedRect(bx, by, w, h, 14); g.strokeRoundedRect(bx, by, w, h, 14);
      t.setPosition(bx + w / 2, by + h / 2).setOrigin(0.5);
      container.add([g, t]); out.push(g, t);
      avoid.push(L.rect); opts.placed?.push(L.rect); prev = L.rect;
      if (opts.debug) debugMark(opts.debug, L, opts.order ?? 0, !L.clean);
      logLayout({ kind: 'speech', text: part.slice(0, 40), slot: L.slot, clean: L.clean, tailClipped: !!L.tail?.clipped, rect: L.rect });
    });
    return out;
  }

  /** CAPTION box — narration, never a speaker's words (workshop §C).  Square
   *  corners, no tail, its own paper and typeface, uppercase. */
  function caption(container, text, box, opts = {}) {
    const out = [];
    if (!text) return out;
    const t = scene.add.text(0, 0, String(text).toUpperCase(), { fontSize: '13px', fontFamily: CAPTION_FACE, fontStyle: 'bold', color: '#222', wordWrap: { width: box.w - 20 }, align: 'left' });
    const w = Math.min(box.w, t.width + 20), h = t.height + 16;
    const L = layoutBalloon({ size: { w, h }, box: { x: box.x, y: box.y, w, h }, anchor: null, protect: opts.protect ?? [], art: opts.art ?? null, bounds: opts.bounds ?? null, avoid: opts.avoid ?? [] });
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.35); g.fillRect(L.rect.x + 3, L.rect.y + 3, w, h);          // drop shadow
    g.fillStyle(CAPTION_FILL, 1); g.lineStyle(2, 0x111111, 1);
    g.fillRect(L.rect.x, L.rect.y, w, h); g.strokeRect(L.rect.x, L.rect.y, w, h);
    t.setPosition(L.rect.x + 10, L.rect.y + 8).setOrigin(0);
    container.add([g, t]); out.push(g, t);
    opts.placed?.push(L.rect);
    if (opts.debug) debugMark(opts.debug, L, opts.order ?? 0, !L.clean);
    logLayout({ kind: 'caption', text: String(text).slice(0, 40), slot: L.slot, clean: L.clean, rect: L.rect });
    return out;
  }

  /** Placement log for review probes (`window.__comicLayoutLog`) — every
   *  balloon/caption with the slot it landed in and whether it was clean. */
  function logLayout(rec) {
    try { (window.__comicLayoutLog ??= []).push({ stop: scene._stop?.id ?? null, ...rec }); } catch (_) {}
  }

  /** Debug overlay for one placed box: green bounds (red when forced), the
   *  tail path in yellow, and the reading-order number. */
  function debugMark(gfx, L, order, forced) {
    gfx.lineStyle(2, forced ? 0xFF3030 : 0x30FF60, 1);
    gfx.strokeRect(L.rect.x, L.rect.y, L.rect.w, L.rect.h);
    if (L.tail) {
      gfx.lineStyle(2, 0xFFE030, 1);
      gfx.lineBetween((L.tail.ax + L.tail.bx) / 2, (L.tail.ay + L.tail.by) / 2, L.tail.tx, L.tail.ty);
      gfx.fillStyle(0xFFE030, 1); gfx.fillCircle(L.tail.tx, L.tail.ty, 3);
    }
    const n = scene.add.text(L.rect.x - 2, L.rect.y - 2, String(order), { fontSize: '12px', fontFamily: IMPACT, color: '#FFF', backgroundColor: '#000', padding: { x: 4, y: 1 } }).setOrigin(1, 1);
    gfx.parentContainer?.add(n);
    gfx._debugTexts = (gfx._debugTexts ?? []).concat(n);
  }

  // ── Tile ────────────────────────────────────────────────────────────────
  function buildTile(storyId, nodeId, node) {
    const c = scene.add.container(tiles.length * (TILE_W + GAP), 0);
    // ESTABLISHING art: the node panel, shown while the player is still
    // choosing.  pick() swaps in the selected response panel afterwards.
    let panelKey = panelKeyFor(storyId, nodeId);
    let meta     = panelMeta(panelKey);
    const bg = scene.add.graphics();
    bg.fillGradientStyle(0x1B2A44, 0x1B2A44, 0x0A1020, 0x0A1020, 1); bg.fillRect(0, 0, TILE_W, ART_H);
    c.add(bg);

    // ── Art rect ──────────────────────────────────────────────────────────
    // PANEL_META rects are authored against the 16:9 PANEL, but this tile is
    // 20:9.  Mapping them onto the whole tile (the old `b.x * TILE_W`) skews
    // every balloon sideways, and cover-fitting would crop ~16% vertically —
    // enough to push a y:0.05 balloon clean off the top.  So the art is
    // CONTAIN-fitted into a centred 16:9 box and every authored coordinate is
    // mapped to THAT box, which keeps each anchor exactly where it was
    // measured.  The gradient shows as side bars.
    const AW = Math.min(TILE_W, ART_H * (16 / 9));
    const AH = AW * (9 / 16);
    const AX = (TILE_W - AW) / 2;
    const AY = (ART_H - AH) / 2;
    const rectPx = (r) => ({ x: AX + r.x * AW, y: AY + r.y * AH, w: r.w * AW, h: r.h * AH });
    const ptPx   = (p) => ({ x: AX + p.x * AW, y: AY + p.y * AH });

    let artObjs = [];
    /** Draw the current panel's art, or a placeholder.  NEVER an unrelated
     *  image — no NPC portrait stand-in, which is what made a tired gas-station
     *  attendant appear as Brittney. */
    // REQUEST TOKEN (working-notes comic finding #3, confirmed 2026-09-09): the
    // shared scene loader fires ONE `complete` for whatever batch finished, so
    // an establishing-art load completing after setPanelKey() had already
    // swapped `meta` could redraw the STALE establishing image over the chosen
    // response art.  Every drawArt() call takes a fresh token; a completion
    // whose token is no longer current is ignored.
    let artReq = 0;
    const drawArt = () => {
      const myReq = ++artReq;
      for (const o of artObjs) o.destroy();
      artObjs = [];
      const url = meta.art;
      if (url && scene.textures.exists(url)) {
        const img = scene.add.image(AX + AW / 2, AY + AH / 2, url)
          .setDisplaySize(AW, AH).setOrigin(0.5);
        c.add(img); artObjs.push(img);
        c.sendToBack?.(img); c.sendToBack?.(bg);
        return;
      }
      // Placeholder — explicit about WHY there's no art.
      const msg = url ? 'STORY ART LOADING…' : 'STORY ART PENDING';
      const ph  = scene.add.text(AX + AW / 2, AY + AH / 2, msg,
        { fontSize: '11px', fontFamily: IMPACT, color: '#3E5A80' }).setOrigin(0.5);
      c.add(ph); artObjs.push(ph);
      if (!url) return;
      // Load once, then redraw this tile in place.  Phaser's shared loader may
      // already be busy with shop/portrait art when the story tile opens.  The
      // old code simply gave up in that case, leaving even correctly mapped
      // panels blank for the rest of the conversation.  Wait for that batch,
      // then retry this panel as its own load.
      if (scene.load.isLoading()) {
        scene.load.once('complete', () => { if (c.active !== false && myReq === artReq) drawArt(); });
        return;
      }
      scene.load.image(url, url);
      loadedArtKeys.add(url);          // released in finish() — see the note there
      scene.load.once('complete', () => { if (c.active !== false && myReq === artReq) drawArt(); });
      scene.load.start();
    };
    drawArt();

    c.add(scene.add.text(10, ART_H - 8, `${scene._stop?.name ?? ''} · MILE ${Math.round(scene._odometer ?? 0)}`, { fontSize: '11px', fontFamily: IMPACT, color: '#8FB7E6' }).setOrigin(0, 1));
    // Establishing/intro panels precede the dialogue in the book (Ch.18 special beats).
    try { story.noteNodeShown?.(storyId, nodeId, scene._odometer ?? 0); } catch (_) {}
    // ── Placement context (workshop §D) ───────────────────────────────────
    // Balloons and captions live ABOVE the tray band: both the alternate
    // slots and the clamp bounds stop at BTN_TOP, so nothing readable is ever
    // placed under the translucent response tray / TAP TO CONTINUE prompt.
    const safeBottom = BTN_TOP - ART_Y - 4;
    const artRect  = { x: AX, y: AY, w: AW, h: Math.min(AH, safeBottom - AY) };
    const tileRect = { x: 0, y: 0, w: TILE_W, h: Math.min(ART_H, safeBottom) };
    let protectPx  = (meta.protect ?? []).map(rectPx);
    const placed   = [];                 // rects already on this tile, in reading order
    let order      = 0;
    // Debug layer sits above everything on the tile.  Built ONCE per panel
    // (protected rects + mouth points), then each placement adds its own
    // mark; a panel swap rebuilds it and re-marks what is already placed.
    let dbg = null;
    const debugBase = (rebuild = false) => {
      if (!comicDebug()) return null;
      if (dbg && !rebuild) { c.bringToTop(dbg); return dbg; }
      if (dbg) { for (const t of dbg._debugTexts ?? []) t.destroy(); dbg.destroy(); }
      dbg = scene.add.graphics(); c.add(dbg); dbg.parentContainer = c;
      dbg.lineStyle(2, 0xFF3030, 0.95);
      for (const p of protectPx) dbg.strokeRect(p.x, p.y, p.w, p.h);
      dbg.fillStyle(0xFF30E0, 1);
      const m1 = ptPx(meta.tail), m2 = ptPx(meta.playerTail);
      dbg.fillCircle(m1.x, m1.y, 4); dbg.fillCircle(m2.x, m2.y, 4);
      return dbg;
    };
    const ctx = () => ({ protect: protectPx, art: artRect, bounds: tileRect, avoid: placed, placed, debug: debugBase(), order: ++order });
    const redrawDebug = () => { if (!comicDebug()) return; const d = debugBase(true); let i = 0; for (const r of placed) debugMark(d, { rect: r, tail: null, clean: true }, ++i, false); };
    // CAPTION (narration) first, then the NPC line — both optional.
    let capParts = caption(c, story.resolveCaption?.(storyId, nodeId) ?? '', meta.caption ? rectPx(meta.caption) : { x: AX + 10, y: AY + 10, w: AW * 0.40, h: AH * 0.24 }, ctx());
    let npcBox  = rectPx(meta.bubble);
    let npcTail = ptPx(meta.tail);
    let npcRects = [];
    let swapped = false;           // the art changed since the line was placed
    let lastPlayerRect = null;     // the balloon a reply must follow
    let replyParts = [];
    const placeNpc = (text, box, extra = {}) => {
      const o = { ...ctx(), ...extra }; const before = placed.length;
      const parts = balloon(c, text, box, npcTail, o);
      if (!extra.after) npcRects = placed.slice(before);
      return parts;
    };
    let npcParts = placeNpc(story.resolveLine(storyId, nodeId), npcBox);
    const tile = {
      c, storyId, nodeId, node,
      get panelKey() { return panelKey; },
      /** Swap to the RESPONSE panel for the committed choice.  Called by pick()
       *  before the tile slides into the comic, so the live tile and the book
       *  show the same authored image — and so every balloon placed from here
       *  on is checked against THAT image's protected faces and mouth points. */
      setPanelKey(key) {
        if (!key || key === panelKey) return;
        panelKey = key;
        meta = panelMeta(key);
        npcBox  = rectPx(meta.bubble);
        npcTail = ptPx(meta.tail);
        protectPx = (meta.protect ?? []).map(rectPx);
        swapped = true;
        // The opening line was placed against the OLD art; it cannot stay.
        for (const o of npcParts) o.destroy(); npcParts = [];
        for (const r of npcRects) { const i = placed.indexOf(r); if (i >= 0) placed.splice(i, 1); }
        npcRects = [];
        drawArt();
        redrawDebug();
      },
      /** The NPC's reply.  READING ORDER (owner 2026-09-10: "the reply above
       *  and to the left of the preceding quote is confusing"): the opening
       *  line STAYS on the tile and the reply lands AFTER the player's balloon
       *  — an authored `replyBubble` slot if the panel has one, else directly
       *  below the player's balloon, else to its right, else a LOW corner.
       *  Only when the art was swapped (choice-level panel) is the opening
       *  line gone, and the reply takes the panel's own bubble slot. */
      setReply(text) {
        for (const o of replyParts) o.destroy(); replyParts = [];
        if (!text) return;
        const pref = meta.replyBubble ? rectPx(meta.replyBubble)
                   : swapped || !lastPlayerRect ? npcBox
                   : { x: lastPlayerRect.x, y: lastPlayerRect.y + lastPlayerRect.h + 6, w: npcBox.w, h: npcBox.h };
        replyParts = placeNpc(text, pref, { after: lastPlayerRect ?? npcRects[0] ?? null });
      },
      setPlayer(text) {
        const before = placed.length;
        balloon(c, text, rectPx(meta.playerBubble), ptPx(meta.playerTail), { fill: 0xFFF9D6, ...ctx(), after: swapped ? null : (npcRects[0] ?? null) });
        lastPlayerRect = placed[before] ?? lastPlayerRect;
      },
    };
    strip.add(c);
    tiles.push(tile);
    return tile;
  }

  // ── Responses ───────────────────────────────────────────────────────────
  function clearButtons() { for (const b of btnObjs) b?.destroy?.(); btnObjs = []; }

  function showButtons(tile) {
    clearButtons();
    const { storyId, nodeId, node } = tile;
    const choices = story.choicesFor(storyId, nodeId);
    const cash = scene._score ?? 0;
    // A stub / dead-end node can't strand the player: one plain way out that
    // records nothing (the story stays parked on this node).
    const list = choices.length ? choices : [{ id: '__tbc', label: 'TO BE CONTINUED…', consequential: false, next: null, effects: {}, _exit: true }];
    // AUTHORED MANDATORY PLAYER LINE (workshop §A): a one-item choice list is
    // not a decision.  It plays as the player's speech balloon through the
    // tap-to-continue sequence — never as a full-width fake button.  (The
    // dead-end TO BE CONTINUED exit keeps its button.)
    if (list.length === 1 && !list[0]._exit) {
      const ch = list[0];
      const opening = `${story.resolveCaption?.(storyId, nodeId) ?? ''} ${story.resolveLine(storyId, nodeId)}`;
      scene.time.delayedCall(readMs(opening), () => { if (!finished && tiles.at(-1) === tile) pick(tile, ch); });
      return;
    }
    const n = list.length;
    const bh = Math.max(24, Math.min(36, Math.floor((BTN_AREA_H - (n - 1) * BTN_GAP) / n)));
    // Translucent tray band: the art stays visible through it.
    btnObjs.push(scene.add.rectangle(SCREEN_W / 2, BTN_TOP + BTN_AREA_H / 2 + 3, SCREEN_W, BTN_AREA_H + 12, 0x02040B, 0.55).setDepth(D + 3));
    let y = BTN_TOP;
    for (const ch of list) {
      const cost = Math.max(0, ch.cost | 0);
      const afford = cost <= cash;
      const label = cost ? `${ch.label}  ($${cost})` : ch.label;
      const bg = scene.add.rectangle(SCREEN_W / 2, y + bh / 2, ART_W - 16, bh, afford ? 0x143A5A : 0x2A1010, 0.82)
        .setStrokeStyle(2, afford ? 0x39A8FF : 0x662222).setDepth(D + 3);
      const fs = Math.max(12, Math.min(17, bh - 12));
      const lbl = scene.add.text(SCREEN_W / 2, y + bh / 2, label, {
        fontSize: `${fs}px`, fontFamily: IMPACT, color: afford ? '#F4F7FF' : '#996666', wordWrap: { width: ART_W - 24 }, align: 'center',
      }).setOrigin(0.5).setDepth(D + 4);
      btnObjs.push(bg, lbl);
      if (afford) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => bg.setFillStyle(0x1E5280, 0.92));
        bg.on('pointerout',  () => bg.setFillStyle(0x143A5A, 0.82));
        bg.on('pointerdown', (p, _x, _y, ev) => {
          scene._eatTap(p, ev);
          if (scene._tapBlocked(p)) return;
          scene._gateTaps();
          pick(tile, ch);
        });
      }
      y += bh + BTN_GAP;
    }
  }

  // ── Selection → commit → animate ────────────────────────────────────────
  function pick(tile, ch) {
    clearButtons();
    if (ch._exit) { finish(); return; }
    const { storyId, nodeId } = tile;
    // 18.2: persist + apply BEFORE the animation.  Every world effect goes
    // through these hooks exactly once (duplicate → nothing fires).
    const r = story.commitChoice({ storyId, nodeId, choiceId: ch.id, mile: scene._odometer ?? 0, stopId }, {
      cash: (n) => {
        const d = (scene._infiniteMoney?.() && n < 0) ? 0 : n;
        scene._score = Math.max(0, (scene._score ?? 0) + d);
        scene._refreshScore?.();
      },
      unlockGenre: (g) => { try { window.__genre?.own?.(g); } catch (_) {} },
      contact:     (ct) => { (scene._purchases.storyContacts ??= []).push(ct); },
      wanted:      (n) => {
        const cur = scene._stars ?? 0;
        if (n > cur) scene._purchases.bumpStarsOnResume = (scene._purchases.bumpStarsOnResume ?? 0) + (n - cur);
        scene._stars = Math.max(cur, n);
      },
      passenger:   (p) => { scene._purchases.storyPassenger = p ?? null; },
      radioGrant:  (g) => { scene._purchases.storyRadioGrant = g ?? null; },
    });
    // Switch the live tile from the ESTABLISHING panel to the exact panel for
    // the choice just committed, BEFORE it slides into the comic — so the tile
    // and the book show the same authored image.  Prefer the key the ledger
    // actually stored (that is the one the comic will render); fall back to the
    // same deterministic resolver when nothing was committed (a duplicate or
    // non-consequential pick).
    tile.setPanelKey(
      r?.entry?.panelKey
      ?? resolvePanelKey({ storyId, nodeId, choiceId: ch.id, node: tile.node, choice: ch }),
    );
    // Player line into its balloon, then the reaction.
    tile.setPlayer(ch.label);
    const reply = story.resolveReply(storyId, nodeId, ch.id);
    // Authored eject (North Bend's "Piss off"): the stop closes behind the
    // tile — no storefront, no welcome NPC.
    if (r.applied && r.leaveStop) leaveAfter = true;
    const replyAt = readMs(ch.label);
    scene.time.delayedCall(replyAt, () => { if (!finished && reply) tile.setReply(reply); });
    // The reply lands, then the tile HOLDS until the player taps — no timed
    // hand-off.  The short delay here is only so the prompt doesn't appear on
    // top of the reply arriving, and so the tap that picked the choice can't
    // carry through and skip the beat it just created.
    scene.time.delayedCall(reply ? replyAt + 800 : 450, () => {
      if (finished) return;
      awaitTapThen(() => {
        const nextId = r.next ?? null;
        const nextNode = nextId ? getStoryNode(storyId, nextId) : null;
        const stillActive = story.isActive(storyId);
        if (nextNode && stillActive && nextNode.stopId === stopId) {
          openNode(storyId, nextId, nextNode);
        } else {
          finish();
        }
      });
    });
  }

  function openNode(storyId, nodeId, node) {
    const tile = buildTile(storyId, nodeId, node);
    header.setText(`${node.speaker ?? ''}`.toUpperCase());
    const target = stripTargetX();
    if (tiles.length === 1) { strip.x = target; }
    else {
      // Slide the completed tile left; the new one arrives from the right.
      scene.tweens.add({ targets: strip, x: target, duration: 420, ease: 'Cubic.easeOut' });
    }
    showButtons(tile);
  }

  // ── Go ──────────────────────────────────────────────────────────────────
  const node0 = getStoryNode(start.storyId, start.nodeId);
  if (!node0) { finish(); return; }
  // Idempotency against scene re-entry: if this node's consequential choices
  // are all already committed on this attempt, the story has moved on — show
  // nothing and let the stop open normally.
  story.activate(start.storyId, { nodeId: start.nodeId });
  openNode(start.storyId, start.nodeId, node0);
}
