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

const D = 600;
// Comic lettering with a readable fallback (character-specific faces land
// with the Phase-8 art; iOS ships Chalkboard SE / Marker Felt, macOS Comic
// Sans MS, everything else falls to a humanist sans).
export const LETTERING = '"Chalkboard SE", "Comic Sans MS", "Marker Felt", "Trebuchet MS", Arial, sans-serif';
const IMPACT = 'Impact, "Arial Black", Arial, sans-serif';

// Widescreen tile (owner 2026-09-06: "the conversation tiles can be bigger"):
// 720×324 of the 800×450 screen, 20:9.  Page panels stay 16:9
// (PANEL_ASPECT); the same art cover-fits both.
const TILE_ASPECT = 20 / 9;
const ART_W  = 720;
const ART_H  = Math.round(ART_W / TILE_ASPECT);    // 324
const ART_X  = Math.round((SCREEN_W - ART_W) / 2); // 40
const ART_Y  = 8;
const PEEK   = 30;      // px of the previous tile left showing
const GAP    = 8;
const TILE_W = ART_W - PEEK;
const BTN_TOP = ART_Y + ART_H + 8;                 // 340
const BTN_GAP = 4;
const BTN_AREA_H = SCREEN_H - BTN_TOP - 6;         // 104
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
    const hint = scene.add.text(SCREEN_W / 2, BTN_TOP + 18, 'TAP TO CONTINUE', {
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
   *  into two linked balloons when even the smallest readable size overflows. */
  function balloon(container, text, box, tail, opts = {}) {
    const out = [];
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
    let x = box.x, y = box.y;
    parts.forEach((part, i) => {
      const t = scene.add.text(0, 0, part, { fontSize: `${size}px`, fontFamily: LETTERING, color: '#111', wordWrap: { width: maxW - 24 }, align: 'center' });
      const w = Math.min(maxW, t.width + 24), h = t.height + 18;
      const bx = i === 0 ? x : Math.min(TILE_W - w - 6, x + 40), by = i === 0 ? y : y + h - 6;
      const g = scene.add.graphics();
      const fill = opts.fill ?? 0xFFFFFF;
      if (i === parts.length - 1 && tail) {
        // Tail leaves from the balloon EDGE that faces the speaker anchor
        // (never across the text), drawn first so the balloon body sits on
        // top of its base.
        const tx = tail.x, ty = tail.y;
        let ax, ay, bx2, by2;
        if (tx > bx + w && ty < by + h + 8) {            // anchor to the right
          ax = bx + w - 1; ay = Math.max(by + 12, Math.min(by + h - 26, ty - 8)); bx2 = ax; by2 = ay + 18;
        } else if (tx < bx && ty < by + h + 8) {         // anchor to the left
          ax = bx + 1; ay = Math.max(by + 12, Math.min(by + h - 26, ty - 8)); bx2 = ax; by2 = ay + 18;
        } else {                                          // anchor below
          const cx = Math.max(bx + 24, Math.min(bx + w - 24, tx)); ax = cx - 10; ay = by + h - 1; bx2 = cx + 10; by2 = ay;
        }
        g.fillStyle(fill, 1); g.lineStyle(2.5, 0x111111, 1);
        g.fillTriangle(ax, ay, bx2, by2, tx, ty);
        g.lineBetween(ax, ay, tx, ty); g.lineBetween(bx2, by2, tx, ty);
      }
      g.fillStyle(fill, 1); g.lineStyle(2.5, 0x111111, 1);
      g.fillRoundedRect(bx, by, w, h, 14); g.strokeRoundedRect(bx, by, w, h, 14);
      t.setPosition(bx + w / 2, by + h / 2).setOrigin(0.5);
      container.add([g, t]); out.push(g, t);
      y = by;
    });
    return out;
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
    // NPC balloon from panel metadata, mapped to the ART rect.
    let npcBox  = rectPx(meta.bubble);
    let npcTail = ptPx(meta.tail);
    let npcParts = balloon(c, story.resolveLine(storyId, nodeId), npcBox, npcTail);
    const tile = {
      c, storyId, nodeId, node,
      get panelKey() { return panelKey; },
      /** Swap to the RESPONSE panel for the committed choice.  Called by pick()
       *  before the tile slides into the comic, so the live tile and the book
       *  show the same authored image. */
      setPanelKey(key) {
        if (!key || key === panelKey) return;
        panelKey = key;
        meta = panelMeta(key);
        npcBox  = rectPx(meta.bubble);
        npcTail = ptPx(meta.tail);
        drawArt();
      },
      setReply(text) {
        for (const o of npcParts) o.destroy();
        npcParts = text ? balloon(c, text, npcBox, npcTail) : [];
      },
      setPlayer(text) {
        balloon(c, text, rectPx(meta.playerBubble), ptPx(meta.playerTail), { fill: 0xFFF9D6 });
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
    const n = list.length;
    const bh = Math.max(24, Math.min(36, Math.floor((BTN_AREA_H - (n - 1) * BTN_GAP) / n)));
    let y = BTN_TOP;
    for (const ch of list) {
      const cost = Math.max(0, ch.cost | 0);
      const afford = cost <= cash;
      const label = cost ? `${ch.label}  ($${cost})` : ch.label;
      const bg = scene.add.rectangle(SCREEN_W / 2, y + bh / 2, ART_W, bh, afford ? 0x143A5A : 0x2A1010)
        .setStrokeStyle(2, afford ? 0x39A8FF : 0x662222).setDepth(D + 3);
      const fs = Math.max(12, Math.min(17, bh - 12));
      const lbl = scene.add.text(SCREEN_W / 2, y + bh / 2, label, {
        fontSize: `${fs}px`, fontFamily: IMPACT, color: afford ? '#F4F7FF' : '#996666', wordWrap: { width: ART_W - 24 }, align: 'center',
      }).setOrigin(0.5).setDepth(D + 4);
      btnObjs.push(bg, lbl);
      if (afford) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => bg.setFillStyle(0x1E5280));
        bg.on('pointerout',  () => bg.setFillStyle(0x143A5A));
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
    scene.time.delayedCall(650, () => { if (!finished && reply) tile.setReply(reply); });
    // The reply lands, then the tile HOLDS until the player taps — no timed
    // hand-off.  The short delay here is only so the prompt doesn't appear on
    // top of the reply arriving, and so the tap that picked the choice can't
    // carry through and skip the beat it just created.
    scene.time.delayedCall(reply ? 1200 : 450, () => {
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
