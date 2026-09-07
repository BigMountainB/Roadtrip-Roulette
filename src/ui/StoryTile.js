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
import { getPortrait } from '../data/npcPortraits.js';
import { panelMeta, panelKeyFor } from '../data/comicPanels.js';

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
  const finish = () => {
    if (finished) return; finished = true; teardown();
    if (leaveAfter && typeof scene._continue === 'function') { scene._continue(); return; }
    onDone?.();
  };

  // ── Chrome ──────────────────────────────────────────────────────────────
  const objs = [];
  const add = (...n) => { objs.push(...n); return n[0]; };
  scene._gateTaps();
  add(scene._swallowTaps(scene.add.rectangle(SCREEN_W / 2, SCREEN_H / 2, SCREEN_W, SCREEN_H, 0x02040B, 0.86).setDepth(D)));
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
    const meta = panelMeta(panelKeyFor(storyId, nodeId));
    // Placeholder art: dark panel, speaker silhouette right, scene label.
    const bg = scene.add.graphics();
    bg.fillGradientStyle(0x1B2A44, 0x1B2A44, 0x0A1020, 0x0A1020, 1); bg.fillRect(0, 0, TILE_W, ART_H);
    c.add(bg);
    const port = getPortrait(node.portrait ?? 'grandma');
    scene._ensureNpcTexture?.(port.texture, port.placeholderTint ?? 0x555555);
    const tex = scene.textures.get(port.texture)?.source?.[0];
    const iw = tex?.width || 200, ih = tex?.height || 220;
    const ph = ART_H * 0.92, pw = ph * (iw / ih);
    const img = scene.add.image(TILE_W - pw * 0.55, ART_H * 0.56, port.texture).setDisplaySize(pw, ph).setOrigin(0.5);
    c.add(img);
    c.add(scene.add.text(10, ART_H - 8, `${scene._stop?.name ?? ''} · MILE ${Math.round(scene._odometer ?? 0)}`, { fontSize: '11px', fontFamily: IMPACT, color: '#8FB7E6' }).setOrigin(0, 1));
    if (!meta.art) c.add(scene.add.text(TILE_W / 2, ART_H - 8, 'STORY ART PENDING', { fontSize: '10px', fontFamily: IMPACT, color: '#3E5A80' }).setOrigin(0.5, 1));
    // NPC balloon from panel metadata (0–1 rects → px).
    const b = meta.bubble, t = meta.tail;
    const npcBox = { x: b.x * TILE_W, y: b.y * ART_H, w: b.w * TILE_W, h: b.h * ART_H };
    const npcTail = { x: t.x * TILE_W, y: t.y * ART_H };
    let npcParts = balloon(c, story.resolveLine(storyId, nodeId), npcBox, npcTail);
    const tile = {
      c, storyId, nodeId, node,
      setReply(text) {
        for (const o of npcParts) o.destroy();
        npcParts = text ? balloon(c, text, npcBox, npcTail) : [];
      },
      setPlayer(text) {
        const pb = meta.playerBubble, pt = meta.playerTail;
        balloon(c, text, { x: pb.x * TILE_W, y: pb.y * ART_H, w: pb.w * TILE_W, h: pb.h * ART_H }, { x: pt.x * TILE_W, y: pt.y * ART_H }, { fill: 0xFFF9D6 });
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
    // Player line into its balloon, then the reaction.
    tile.setPlayer(ch.label);
    const reply = story.resolveReply(storyId, nodeId, ch.id);
    // Authored eject (North Bend's "Piss off"): the stop closes behind the
    // tile — no storefront, no welcome NPC.
    if (r.applied && r.leaveStop) leaveAfter = true;
    scene.time.delayedCall(650, () => { if (!finished && reply) tile.setReply(reply); });
    scene.time.delayedCall(reply ? 1700 : 900, () => {
      if (finished) return;
      const nextId = r.next ?? null;
      const nextNode = nextId ? getStoryNode(storyId, nextId) : null;
      const stillActive = story.isActive(storyId);
      if (nextNode && stillActive && nextNode.stopId === stopId) {
        openNode(storyId, nextId, nextNode);
      } else {
        finish();
      }
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
