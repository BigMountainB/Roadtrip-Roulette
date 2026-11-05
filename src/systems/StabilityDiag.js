// ── StabilityDiag — measure the restart boundary, and leave a breadcrumb ───
// iPhone stability pass (2026-09-15), item 1.
//
// An iOS memory termination fires no JS error, so the only evidence is what
// was written BEFORE it.  This module:
//   • takes a small snapshot of everything we can see that costs memory —
//     registered textures (TextureBudget), the canvas backing buffer and its
//     compositor footprint at the device pixel ratio, WebGL wrapper counts,
//     JS heap (Chromium only; Safari has no performance.memory), streamer
//     queues, scene / mile / orientation / visibility
//   • persists ONE bounded record in localStorage on every lifecycle event
//     (boot, scene change, rest-stop in/out, story tile open/close, settle,
//     visibility, GPU recovery) — the latest snapshot plus a short ring of
//     one-line events, ≤ ~2 KB, so it survives the kill and the next boot can
//     say what the process was doing when it died
//   • never keeps screenshots, arrays of records, or anything unbounded
//
// Facts it makes visible rather than assumed:
//   the canvas is NOT DPR-multiplied — Phaser FIT sets canvas.width/height to
//   baseSize (ScaleManager.refresh: "the canvas pixel size remains untouched");
//   `zoom` only feeds the CSS size, and FIT re-derives that from the parent.
//   The DPR cost is the compositor layer WebKit keeps for any fullscreen
//   element: cssW×cssH×dpr²×4.  Both are reported separately.

import { textureReport } from './TextureBudget.js';
import { ROUTE_SEGS, SEG_LENGTH, TOTAL_ROUTE_MILES } from '../constants.js';

export const DIAG_KEY = 'rtr_diag';
const MiB = 1048576;
const RING = 14;

let _peakMb = 0;
let _lastSnap = null;
let _bootId = 0;

const r1 = (n) => Math.round(n * 10) / 10;

/** Canvas + compositor cost.  Pure, for tests. */
export function canvasBytes({ width = 0, height = 0, cssW = 0, cssH = 0, dpr = 1 } = {}) {
  const backing = width * height * 4;
  const compositor = Math.round(cssW * dpr) * Math.round(cssH * dpr) * 4;
  return { backing, compositor, backingMb: r1(backing / MiB), compositorMb: r1(compositor / MiB) };
}

/** Find the running gameplay scene's mile, if any. */
function currentMile(game) {
  try {
    const s = game?.scene?.getScene?.('Game');
    if (!s?.player || typeof s.player.position !== 'number') return null;
    return r1((s.player.position / (ROUTE_SEGS * SEG_LENGTH)) * TOTAL_ROUTE_MILES);
  } catch (_) { return null; }
}

function activeScenes(game) {
  try { return (game?.scene?.getScenes?.(true) ?? []).map(s => s.scene.key); } catch (_) { return []; }
}

/** One measurement.  Everything is best-effort and null when unsupported. */
export function snapshot(game, ev = '', extra = {}) {
  const t = Date.now();
  const rec = { t, ev, boot: _bootId };
  try {
    const tr = textureReport(game, { top: 0 });
    rec.tex = { n: tr.count, mb: tr.mb };
  } catch (_) { rec.tex = null; }
  try {
    const c = game?.canvas;
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const cssW = c?.clientWidth ?? 0, cssH = c?.clientHeight ?? 0;
    const cb = canvasBytes({ width: c?.width ?? 0, height: c?.height ?? 0, cssW, cssH, dpr });
    rec.canvas = { w: c?.width ?? 0, h: c?.height ?? 0, cssW, cssH, dpr: r1(dpr),
      backingMb: cb.backingMb, compositorMb: cb.compositorMb };
  } catch (_) { rec.canvas = null; }
  try {
    const r = game?.renderer;
    rec.gl = r?.gl ? {
      lost: !!(r.contextLost || r.gl.isContextLost?.()),
      tex: r.glTextureWrappers?.length ?? null,
      fbo: r.glFramebufferWrappers?.length ?? null,
    } : null;
  } catch (_) { rec.gl = null; }
  try {
    const m = (typeof performance !== 'undefined' && performance.memory) || null;
    rec.heap = m ? { usedMb: r1(m.usedJSHeapSize / MiB), totalMb: r1(m.totalJSHeapSize / MiB) } : null;
  } catch (_) { rec.heap = null; }
  try {
    const s = game?.registry?.get?.('streamer');
    rec.stream = s?.snapshot ? s.snapshot() : null;
  } catch (_) { rec.stream = null; }
  rec.scenes = activeScenes(game);
  rec.mile = currentMile(game);
  try {
    rec.vis = typeof document !== 'undefined' ? document.visibilityState : null;
    rec.orient = (typeof window !== 'undefined')
      ? (window.innerHeight > window.innerWidth ? 'portrait' : 'landscape') : null;
  } catch (_) {}
  // Streamed textures are already inside tex.mb (they live in the same
  // TextureManager); the canvas terms are what TextureBudget never counted.
  rec.estMb = r1((rec.tex?.mb ?? 0) + (rec.canvas?.backingMb ?? 0) + (rec.canvas?.compositorMb ?? 0));
  _peakMb = Math.max(_peakMb, rec.estMb);
  rec.peakMb = _peakMb;
  Object.assign(rec, extra);
  _lastSnap = rec;
  return rec;
}

/** Compact one-line form for the ring.  Pure, for tests. */
export function formatCrumb(rec) {
  const mile = rec.mile == null ? '' : `@${rec.mile}`;
  return `${rec.t}|${rec.ev}|${(rec.scenes ?? []).join('+')}${mile}|${rec.tex?.mb ?? '?'}MB|${rec.vis ?? ''}|${rec.orient ?? ''}`;
}

function readStore() {
  try {
    const raw = localStorage.getItem(DIAG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

function writeStore(obj) {
  try {
    let s = JSON.stringify(obj);
    // Bounded: drop ring entries before the record itself could grow past ~2 KB.
    while (s.length > 2048 && obj.ring?.length > 2) { obj.ring.shift(); s = JSON.stringify(obj); }
    localStorage.setItem(DIAG_KEY, s);
  } catch (_) {}
}

/**
 * Persist a breadcrumb for lifecycle event `ev`.  Returns the snapshot.
 * The stored shape: { boot, last: <snapshot>, ring: [<line>...], peakMb }.
 */
export function crumb(game, ev, extra = {}) {
  const rec = snapshot(game, ev, extra);
  const store = readStore() ?? { ring: [] };
  if (!Array.isArray(store.ring)) store.ring = [];
  store.boot = _bootId;
  store.last = rec;
  store.ring.push(formatCrumb(rec));
  while (store.ring.length > RING) store.ring.shift();
  store.peakMb = Math.max(store.peakMb ?? 0, rec.peakMb ?? 0);
  writeStore(store);
  return rec;
}

/**
 * Called ONCE at boot before the first crumb: report how the previous
 * session ended.  A JS crash sets `rtr_crashed` (main.js); GameScene reads
 * and clears that marker later, so this only PEEKS.  Anything else with a
 * last crumb is the OS ending the process — and the crumb says during what.
 */
export function previousSession() {
  const store = readStore();
  let crashed = false;
  try { crashed = localStorage.getItem('rtr_crashed') === '1'; } catch (_) {}
  _bootId = (store?.boot ?? 0) + 1;
  if (!store?.last) return { first: true, crashed, bootId: _bootId };
  const last = store.last;
  const age = Date.now() - (last.t ?? 0);
  const out = {
    first: false, crashed, bootId: _bootId,
    endedAfter: last.ev, scenes: last.scenes, mile: last.mile,
    texMb: last.tex?.mb ?? null, estMb: last.estMb ?? null, peakMb: store.peakMb ?? null,
    vis: last.vis, orient: last.orient, ageSec: Math.round(age / 1000),
    ring: [...(store.ring ?? [])],
    verdict: crashed ? 'js-error'
      : last.vis === 'hidden' ? 'ended-while-backgrounded'
      : /settle|orient/.test(last.ev) ? 'ended-after-viewport-settle'   // rotation OR cold-load fit
      : /gpu/.test(last.ev) ? 'ended-during-gpu-recovery'
      : /reststop|story|comic/.test(last.ev) ? 'ended-during-' + last.ev
      : 'ended-silently',
  };
  return out;
}

/** Console + window hooks.  `?devtools=1` mirrors console into the on-screen
 *  overlay, which is how the owner reads this on a phone. */
export function installDiagProbe(game) {
  const prev = previousSession();
  try {
    globalThis.__diagLast = prev;
    globalThis.__diag = (label) => crumb(game, label || 'manual');
    globalThis.__diagRing = () => readStore()?.ring ?? [];
  } catch (_) {}
  if (!prev.first) {
    const line = `[diag] previous session: ${prev.verdict} — after "${prev.endedAfter}" in ${(prev.scenes ?? []).join('+') || '?'}`
      + (prev.mile != null ? ` @ mile ${prev.mile}` : '')
      + `, textures ${prev.texMb ?? '?'} MB (session peak est ${prev.peakMb ?? '?'} MB), ${prev.vis ?? '?'}/${prev.orient ?? '?'}, ${prev.ageSec}s ago`;
    try { (prev.crashed ? console.error : console.warn)(line); } catch (_) {}
  }
  return prev;
}

export function lastSnapshot() { return _lastSnap; }
export function sessionPeakMb() { return _peakMb; }
