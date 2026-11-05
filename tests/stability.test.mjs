// ── iPhone stability pass (2026-09-15) — regression coverage ──────────────
// Run: node tests/stability.test.mjs   (also `npm test`)
//
// Everything here runs headless against the REAL modules with injected
// Image / timers / clock / TextureManager doubles, so the state machines the
// directive named are exercised, not just grepped:
//   ImageStreamer   dedup, bounded concurrency, one failure not blocking
//                   others, shutdown mid-load, stale generations, cooldown,
//                   byte budget with hysteresis, pins, ten rest-stop cycles
//   ViewportSettle  N events → ONE ladder
//   GpuRecovery     inconclusive/throwing probe → no rebuild; one rebuild per
//                   restoration; cooldown; deferral while busy; repeated
//                   background/foreground cycles
//   StabilityDiag   canvas accounting + bounded crumb format
// Source-level checks cover the wiring that can't be constructed headlessly
// (GameScene.init resets, scene shutdown releases, the removed shared
// once('loaderror') pattern).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ImageStreamer, STREAM_DEFAULTS } from '../src/systems/ImageStreamer.js';
import { createSettleScheduler } from '../src/systems/ViewportSettle.js';
import { probeGpu, decideRecovery, createVisibilityRecovery } from '../src/systems/GpuRecovery.js';
import { canvasBytes, formatCrumb } from '../src/systems/StabilityDiag.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const read = (p) => readFileSync(ROOT + p, 'utf8');
let pass = 0, fail = 0;
const check = (name, ok) => { if (ok) pass++; else { fail++; console.log(`  ✗ FAIL: ${name}`); } };
const MiB = 1048576;

// ── Test doubles ─────────────────────────────────────────────────────────
function makeClock() {
  let now = 0;
  const timers = [];
  let nextId = 1;
  const api = {
    now: () => now,
    setTimeout: (fn, ms) => { const id = nextId++; timers.push({ id, at: now + ms, fn }); return id; },
    clearTimeout: (id) => { const i = timers.findIndex(t => t.id === id); if (i >= 0) timers.splice(i, 1); },
    requestAnimationFrame: (fn) => api.setTimeout(fn, 16),
    cancelAnimationFrame: (id) => api.clearTimeout(id),
    /** Advance time, running due timers in order. */
    advance(ms) {
      const target = now + ms;
      for (;;) {
        timers.sort((a, b) => a.at - b.at);
        const t = timers[0];
        if (!t || t.at > target) break;
        timers.shift(); now = t.at; t.fn();
      }
      now = target;
    },
    pending: () => timers.length,
  };
  return api;
}

function makeTextures() {
  const map = new Map();
  return {
    map,
    exists: (k) => map.has(k),
    addImage: (k, img) => { map.set(k, { source: [{ width: img.naturalWidth, height: img.naturalHeight }] }); },
    remove: (k) => { map.delete(k); },
    get: (k) => map.get(k),
  };
}

/** Fake Image: completion is driven by the test via .finish() / .fail(). */
function makeImageFactory() {
  const images = [];
  const factory = () => {
    const img = { naturalWidth: 1672, naturalHeight: 941, onload: null, onerror: null, src: '', aborted: false };
    Object.defineProperty(img, 'src', {
      set(v) { img._src = v; if (v === '') img.aborted = true; },
      get() { return img._src; },
    });
    img.finish = () => img.onload?.();
    img.fail = () => img.onerror?.();
    images.push(img);
    return img;
  };
  factory.images = images;
  factory.forKey = (path) => images.filter(i => i._src === path);
  return factory;
}

function makeStreamer(opts = {}) {
  const clock = makeClock();
  const tex = makeTextures();
  const mk = makeImageFactory();
  const s = new ImageStreamer(tex, {
    now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    makeImage: mk, ...opts,
  });
  return { s, clock, tex, mk };
}

// ── ImageStreamer: dedup ─────────────────────────────────────────────────
{
  const { s, mk } = makeStreamer();
  const h = s.handle('a');
  let done = 0;
  check('first request is queued/loading', s.request('k1', '/k1.png', { handle: h, onDone: () => done++ }) === 'loading');
  check('second request for the same key joins, state loading', s.request('k1', '/k1.png', { handle: h, onDone: () => done++ }) === 'loading');
  s.request('k1', '/k1.png', { handle: h, onDone: () => done++ });
  check('three requests → ONE Image()', mk.images.length === 1);
  check('dedup counted', s.stats.dedup === 2);
  mk.images[0].finish();
  check('all three waiters called once each', done === 3);
  check('loaded key reports loaded and calls nothing', s.request('k1', '/k1.png', { handle: h, onDone: () => done++ }) === 'loaded' && done === 3);
  check('in-flight marker cleared', s.inFlight === 0 && s.entries.size === 0);
}

// ── ImageStreamer: bounded concurrency ───────────────────────────────────
{
  const { s, mk } = makeStreamer({ maxInFlight: 2 });
  for (let i = 0; i < 5; i++) s.request(`c${i}`, `/c${i}.png`);
  check('only maxInFlight images start', mk.images.length === 2 && s.inFlight === 2);
  check('the rest are queued', s.snapshot().queued === 3);
  mk.images[0].finish();
  check('a completion starts the next one', mk.images.length === 3 && s.inFlight === 2);
  mk.images[1].finish(); mk.images[2].finish(); mk.images[3].finish(); mk.images[4].finish();
  check('everything drains', s.inFlight === 0 && s.snapshot().queued === 0 && s.resident.size === 5);
  check('peak in-flight recorded', s.stats.peakInFlight === 2);
}

// ── ImageStreamer: one failure does not block others ─────────────────────
{
  const { s, clock, mk, tex } = makeStreamer({ maxInFlight: 4, maxTries: 3, retryBaseMs: 1000 });
  const h = s.handle('a');
  const results = {};
  for (const k of ['bad', 'g1', 'g2', 'g3']) {
    s.request(k, `/${k}.png`, { handle: h, onDone: (key) => { results[key] = 'ok'; }, onFail: (key, why) => { results[key] = why; } });
  }
  mk.forKey('/bad.png')[0].fail();
  mk.forKey('/g1.png')[0].finish(); mk.forKey('/g2.png')[0].finish(); mk.forKey('/g3.png')[0].finish();
  check('unrelated files complete while one fails', results.g1 === 'ok' && results.g2 === 'ok' && results.g3 === 'ok');
  check('the failed key is in backoff, not stuck loading', s.entries.get('bad')?.state === 'failed' && s.inFlight === 0);
  check('no retry before the backoff elapses', mk.forKey('/bad.png').length === 1);
  clock.advance(1000);
  check('retry #2 after base backoff', mk.forKey('/bad.png').length === 2);
  mk.forKey('/bad.png')[1].fail();
  clock.advance(2000);
  check('retry #3 after doubled backoff', mk.forKey('/bad.png').length === 3);
  mk.forKey('/bad.png')[2].fail();
  check('gone after maxTries, waiter told exactly once', results.bad === 'gone' && s.gone.has('bad') && !s.entries.has('bad'));
  check('gone does not re-request', s.request('bad', '/bad.png') === 'gone' && mk.forKey('/bad.png').length === 3);
  check('no permanent LOADING state anywhere', [...s.entries.values()].every(e => e.state !== 'loading'));
  check('textures intact for the good ones', tex.exists('g1') && tex.exists('g2') && tex.exists('g3') && !tex.exists('bad'));
}

// ── ImageStreamer: scene shutdown during an active load ──────────────────
{
  const { s, mk, tex } = makeStreamer();
  const h = s.handle('game');
  let called = 0;
  s.request('mid', '/mid.png', { handle: h, onDone: () => called++ });
  check('load in flight', s.inFlight === 1);
  h.release();                                   // scene shut down
  check('handle dead', h.alive === false);
  mk.images[0].finish();                         // network completes afterwards
  check('texture still cached (shared state)', tex.exists('mid'));
  check('callback from the dead generation NOT called', called === 0 && s.stats.cancelled === 1);
  check('in-flight marker cleared after a stale completion', s.inFlight === 0 && s.entries.size === 0);
  // A queued-but-not-started request from a dead handle is dropped entirely.
  const { s: s2, mk: mk2 } = makeStreamer({ maxInFlight: 1 });
  const h2 = s2.handle('game');
  s2.request('a', '/a.png', { handle: h2, onDone: () => {} });
  s2.request('b', '/b.png', { handle: h2, onDone: () => {} });
  h2.release();
  check('queued request with no live waiter is dropped', !s2.entries.has('b'));
  check('loading request survives release (will cache on completion)', s2.entries.has('a'));
  mk2.images[0].finish();
  check('drained cleanly', s2.inFlight === 0 && s2.entries.size === 0);
}

// ── ImageStreamer: stale completion after a NEW generation ───────────────
{
  const { s, mk } = makeStreamer();
  const gen1 = s.handle('game');
  const gen2Calls = [], gen1Calls = [];
  s.request('shared', '/shared.png', { handle: gen1, onDone: (k) => gen1Calls.push(k) });
  gen1.release();                                // restart: old generation gone
  const gen2 = s.handle('game');                 // new generation wants the same key
  const st = s.request('shared', '/shared.png', { handle: gen2, onDone: (k) => gen2Calls.push(k) });
  check('new generation joins the in-flight request', st === 'loading' && mk.images.length === 1);
  mk.images[0].finish();
  check('only the NEW generation is called', gen2Calls.length === 1 && gen1Calls.length === 0);
}

// ── ImageStreamer: cooldown prevents load/evict/reload oscillation ───────
{
  const { s, clock, mk, tex } = makeStreamer({ cooldownMs: 5000 });
  s.request('band', '/band.png'); mk.images[0].finish();
  check('resident after load', tex.exists('band') && s.resident.has('band'));
  const freed = s.release(['band']);
  check('release frees bytes and removes the texture', freed === 1672 * 941 * 4 && !tex.exists('band'));
  const st = s.request('band', '/band.png');
  check('immediate re-request is COOLING, not started', st === 'cooling' && mk.images.length === 1);
  clock.advance(4999);
  check('still held before the cooldown', mk.images.length === 1);
  clock.advance(1);
  check('starts once the cooldown elapses', mk.images.length === 2);
  mk.images[1].finish();
  check('counted as a reload', s.stats.reloaded === 1);
  // force bypasses the cooldown (explicit consumer intent)
  s.release(['band']);
  check('force=true reloads immediately', s.request('band', '/band.png', { force: true }) === 'loading');
}

// ── ImageStreamer: byte budget with hysteresis + pins ────────────────────
{
  const bytesEach = 1672 * 941 * 4;               // ~6 MiB
  const { s, clock, mk } = makeStreamer({ budgetBytes: bytesEach * 4 + 1, lowWaterBytes: bytesEach * 2, maxInFlight: 10 });
  const h = s.handle('game');
  const onScreen = new Set(['p2']);
  h.pin((k) => onScreen.has(k));
  for (let i = 0; i < 4; i++) { s.request(`p${i}`, `/p${i}.png`); clock.advance(1); mk.images[i].finish(); }
  check('under budget: nothing evicted', s.resident.size === 4 && s.stats.evicted === 0);
  s.request('p4', '/p4.png'); clock.advance(1); mk.images[4].finish();     // pushes over the high-water
  check('over budget: evicts down to LOW water (hysteresis), not just under high', s.residentBytes() <= bytesEach * 2);
  check('LRU order: oldest unpinned went first', !s.resident.has('p0') && !s.resident.has('p1'));
  check('pinned key survived even though it was old', s.resident.has('p2'));
  check('newest stays', s.resident.has('p4'));
  check('peak bytes recorded the transient', s.stats.peakBytes >= bytesEach * 5);
  check('snapshot reports MB + rings', typeof s.snapshot().residentMb === 'number' && s.snapshot().recentEvicted.length >= 2);
}

// ── ImageStreamer: TEN rest-stop enter/exit cycles ───────────────────────
{
  const { s, clock, mk, tex } = makeStreamer({ maxInFlight: 8 });
  const game = s.handle('game');
  const baseline = { resident: s.resident.size, bytes: s.residentBytes() };
  let calls = 0;
  for (let cycle = 0; cycle < 10; cycle++) {
    clock.advance(5 * 60 * 1000);                                          // stops are minutes apart
    const stop = s.handle('reststop');
    const keys = [`shop_${cycle % 3}`, 'npc_a', 'npc_b', `story_${cycle}`];
    // Portraits/panels are on-demand UI art → force (skips the cooldown);
    // the storefront rides the plain path like a preload would.
    for (const k of keys) stop.request(k, `/${k}.png`, () => calls++, null, { force: k !== `shop_${cycle % 3}` });
    for (const img of mk.images.filter(i => i.onload)) img.finish();      // all land
    check(`cycle ${cycle}: everything resident while at the stop`, keys.every(k => tex.exists(k)));
    stop.release();                                                        // scene shutdown
    s.release(keys);                                                       // GameScene on the way out
  }
  // On-demand re-request RIGHT after an eviction (a reopened card) must not
  // wait for the cooldown — that is the hole force exists for.
  const again = s.handle('reststop');
  check('forced re-request of a just-evicted portrait starts immediately',
    again.request('npc_a', '/npc_a.png', null, null, { force: true }) === 'loading');
  check('unforced re-request of a just-evicted key cools instead (route sweeps)',
    again.request('npc_b', '/npc_b.png') === 'cooling');
  for (const img of mk.images.filter(i => i.onload)) img.finish();
  again.release(); s.release(['npc_a', 'npc_b']);
  check('after 10 cycles: no rest-stop texture resident', s.resident.size === baseline.resident && s.residentBytes() === baseline.bytes);
  check('after 10 cycles: no dead handles retained', [...s.handles.values()].every(h => h.alive) && s.handles.size === 1);
  check('after 10 cycles: nothing in flight or queued', s.inFlight === 0 && s.entries.size === 0);
  check('every load called back exactly once', calls === 40);
  game.release();
}

// ── ImageStreamer: the HANDLE api the scenes actually call ───────────────
// 2026-09-16: the first device boot threw in _ensureSceneryAssets because the
// scene called releaseUnpinned() on its handle, which only had
// request/pin/release — and release() on a handle DISPOSES it, so the police
// path's release(keys) would have killed the game's handle.  Exercise every
// method a scene uses, on the handle, not the streamer.
{
  const { s, mk, tex } = makeStreamer({ maxInFlight: 8 });
  const h = s.handle('game');
  const onScreen = new Set();
  h.pin((k) => onScreen.has(k));
  for (const k of ['b1', 'b2', 'b3']) h.request(k, `/${k}.png`);
  for (const img of mk.images) img.finish();
  onScreen.add('b2');
  check('handle.releaseUnpinned exists and respects pins',
    typeof h.releaseUnpinned === 'function' && h.releaseUnpinned(['b1', 'b2']) > 0 && !tex.exists('b1') && tex.exists('b2'));
  check('handle.releaseKeys exists and ignores pins',
    typeof h.releaseKeys === 'function' && h.releaseKeys(['b2']) > 0 && !tex.exists('b2'));
  check('handle.touch exists', typeof h.touch === 'function' && (h.touch('b3'), true));
  check('handle is still alive after releasing keys', h.alive === true);
  h.release();
  check('handle.release() with no args disposes the handle', h.alive === false);
  const gs = read('src/scenes/GameScene.js').replace(/\/\/.*$/gm, '');
  check('no scene passes keys to handle.release()', !/_stream\??\.release\([^)]/.test(gs)
    && !/_stream\??\.release\([^)]/.test(read('src/scenes/RestStopScene.js')));
  for (const m of ['releaseUnpinned', 'releaseKeys', 'request', 'pin', 'touch']) {
    // every method a scene calls on _stream must exist on the handle
    const used = new RegExp(`_stream\\??\\.${m}\\(`).test(gs);
    check(`GameScene's _stream.${m} is a real handle method`, !used || typeof s.handle('x')[m] === 'function');
  }
}

// ── ViewportSettle: N events → ONE ladder ────────────────────────────────
{
  const clock = makeClock();
  let applies = 0;
  const settle = createSettleScheduler({
    apply: () => applies++, steps: [120, 300, 550, 900],
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    requestAnimationFrame: clock.requestAnimationFrame, cancelAnimationFrame: clock.cancelAnimationFrame,
  });
  // iOS-style burst: 7 events over 60 ms from four sources
  for (let i = 0; i < 7; i++) { settle.schedule(); clock.advance(10); }
  check('pending while the ladder runs', settle.pending());
  clock.advance(2000);
  check('a burst of 7 events produced ONE ladder: rAF + 4 steps = 5 applies', applies === 5);
  check('not pending once the ladder is done', !settle.pending());
  check('sequences counted', settle.stats().sequences === 7 && settle.stats().applies === 5);
  applies = 0;
  settle.schedule(); clock.advance(200); settle.cancel(); clock.advance(2000);
  check('cancel() stops the remaining steps', applies === 2);
}

// ── GpuRecovery: probe verdicts ──────────────────────────────────────────
{
  const w = (ok) => ({ webGLTexture: {} , ok });
  const glOf = (deadSet, throwing = false) => ({
    isContextLost: () => false,
    isTexture: (t) => { if (throwing) throw new Error('boom'); return !deadSet.has(t); },
  });
  const wrappers = [w(), w(), w()];
  check('healthy when every sampled handle is a texture', probeGpu({ gl: glOf(new Set()), wrappers }).verdict === 'healthy');
  check('evicted when any sampled handle is dead', probeGpu({ gl: glOf(new Set([wrappers[1].webGLTexture])), wrappers }).verdict === 'evicted');
  check('a THROWING probe is inconclusive, not evicted', probeGpu({ gl: glOf(new Set(), true), wrappers }).verdict === 'inconclusive');
  check('no wrappers to sample is inconclusive', probeGpu({ gl: glOf(new Set()), wrappers: [] }).verdict === 'inconclusive');
  check('no gl is inconclusive', probeGpu({ gl: null, wrappers }).verdict === 'inconclusive');
  check('a real context loss is reported as lost', probeGpu({ gl: { isContextLost: () => true, isTexture: () => true }, wrappers }).verdict === 'lost');

  check('brief app switch → skip', decideRecovery({ awayMs: 5000 }).action === 'skip');
  check('inconclusive probe → skip (fail closed)', decideRecovery({ awayMs: 60000, probe: { verdict: 'inconclusive' } }).action === 'skip');
  check('healthy probe → skip', decideRecovery({ awayMs: 60000, probe: { verdict: 'healthy' } }).action === 'skip');
  check('evicted probe → rebuild', decideRecovery({ awayMs: 60000, probe: { verdict: 'evicted', dead: 2, checked: 8 } }).action === 'rebuild');
  check('context lost → Phaser owns it, skip', decideRecovery({ awayMs: 60000, contextLost: true, probe: { verdict: 'evicted' } }).action === 'skip');
  check('busy (rotation/loading) → defer, never overlap', decideRecovery({ awayMs: 60000, busy: true, probe: { verdict: 'evicted' } }).action === 'defer');
  check('inside cooldown → skip', decideRecovery({ awayMs: 60000, sinceLastRebuildMs: 1000, probe: { verdict: 'evicted' } }).action === 'skip');
}

// ── GpuRecovery: controller — repeated background/foreground cycles ──────
{
  const clock = makeClock();
  let rebuilds = 0, busy = false, dead = false;
  const gl = { isContextLost: () => false, isTexture: () => !dead };
  const rec = createVisibilityRecovery({
    getGpu: () => ({ gl, wrappers: [{ webGLTexture: {} }], contextLost: false }),
    isBusy: () => busy, rebuild: () => rebuilds++,
    now: clock.now, setTimeout: clock.setTimeout, minAwayMs: 30000, cooldownMs: 60000, deferMs: 1000,
  });
  // 20 brief cycles: never a rebuild
  for (let i = 0; i < 20; i++) { rec.onVisibility('hidden'); clock.advance(2000); rec.onVisibility('visible'); clock.advance(500); }
  check('20 brief background cycles → 0 rebuilds', rebuilds === 0);
  // long cycle, healthy GPU → still nothing
  rec.onVisibility('hidden'); clock.advance(40000); rec.onVisibility('visible');
  check('long background with a healthy GPU → 0 rebuilds', rebuilds === 0);
  // long cycle, evicted handles → exactly one rebuild
  dead = true;
  rec.onVisibility('hidden'); clock.advance(40000); rec.onVisibility('visible');
  check('evicted handles after a long hide → ONE rebuild', rebuilds === 1);
  // immediately again (still "dead" from the fake) → cooldown blocks it
  rec.onVisibility('hidden'); clock.advance(40000); rec.onVisibility('visible');
  check('a second long return inside the cooldown → no second rebuild', rebuilds === 1);
  clock.advance(60000);
  // busy on return: deferred, then runs once the settle finishes
  busy = true;
  rec.onVisibility('hidden'); clock.advance(40000); rec.onVisibility('visible');
  check('busy on return → deferred, not rebuilt yet', rebuilds === 1);
  busy = false; clock.advance(1000);
  check('deferred rebuild runs once busy clears', rebuilds === 2);
  // a throwing probe never rebuilds
  clock.advance(60000);
  gl.isTexture = () => { throw new Error('probe exploded'); };
  rec.onVisibility('hidden'); clock.advance(40000); rec.onVisibility('visible');
  check('throwing probe → NO rebuild (fail closed)', rebuilds === 2);
  const last = rec.state().history.filter(h => h.ev === 'decide').pop();
  check('the inconclusive reason is recorded for diagnostics', /inconclusive/.test(last?.reason ?? ''));
  check('history is bounded', rec.state().history.length <= 16);
}

// ── StabilityDiag: canvas accounting + crumb format ──────────────────────
{
  const cb = canvasBytes({ width: 1000, height: 450, cssW: 852, cssH: 393, dpr: 3 });
  check('backing buffer is the canvas pixel size, NOT DPR-multiplied', cb.backing === 1000 * 450 * 4);
  check('compositor layer IS DPR-multiplied (css × dpr)²', cb.compositor === (852 * 3) * (393 * 3) * 4);
  const line = formatCrumb({ t: 1, ev: 'reststop-enter', scenes: ['RestStop'], mile: 10.2, tex: { mb: 480.1 }, vis: 'visible', orient: 'landscape' });
  check('crumb line is one short pipe-delimited record', line === '1|reststop-enter|RestStop@10.2|480.1MB|visible|landscape');
  check('crumb ring stays small (≤ 120 chars per line)', line.length < 120);
}

// ── Source-level wiring (what can't be constructed headlessly) ──────────
{
  const gameScene = read('src/scenes/GameScene.js');
  const restStop  = read('src/scenes/RestStopScene.js');
  const storyTile = read('src/ui/StoryTile.js');
  const bootScene = read('src/scenes/BootScene.js');
  const mainJs    = read('src/main.js');
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const gs = strip(gameScene), rs = strip(restStop), st = strip(storyTile), mj = strip(mainJs);

  // Item 4 — reused-scene state reset in init()
  const initBody = gs.slice(gs.indexOf('  init(data) {'), gs.indexOf('  init(data) {') + 4000);
  for (const f of ['_scnAssetT = -99', '_polAssetT = -99', '_polEvictT = -99', '_polQueued = new Set()']) {
    check(`GameScene.init resets ${f.split(' ')[0]}`, initBody.includes(f));
  }
  check('GameScene.init releases the previous streamer handle and takes a new one',
    /_stream\?\.release\(\)[\s\S]{0,120}_stream = this\.registry\.get\('streamer'\)\?\.handle\('game'\)/.test(initBody));
  check('GameScene releases its handle on shutdown',
    /events\.once\('shutdown'[^)]*\)[\s\S]{0,300}_stream\?\.release\(\)/.test(gs));
  check('RestStopScene takes a per-visit handle in init and releases it on shutdown',
    /handle\('reststop'\)/.test(rs) && /events\.once\('shutdown'[\s\S]{0,300}_stream\?\.release\(\)/.test(rs));
  check('the old per-scene police retry maps are gone', !/_polTex\b/.test(gs) && !/_polWanted\b/.test(gs));

  // Item 5 — one loader
  check('BootScene registers the streamer', bootScene.includes("registry.set('streamer', new ImageStreamer("));
  check('scenery streams through the handle, not this.load',
    /_ensureSceneryAssets\([\s\S]{0,1500}stream\.request\(key, path\)/.test(gs)
    && !/_ensureSceneryAssets\([\s\S]{0,1500}this\.load\.image/.test(gs));
  check('police art streams through the handle, no bare Image()',
    /_ensurePoliceAssets\([\s\S]{0,6000}_stream\.request\(key, path\)/.test(gs)
    && !/_ensurePoliceAssets\([\s\S]{0,6000}new Image\(\)/.test(gs));
  check('story panels stream through a handle', /artHandle\.request\(url, url/.test(st));
  check('rest-stop portraits stream through the handle', /_ensureNpcTexture\([\s\S]{0,1200}_stream\.request\(key, path/.test(rs));
  check('storefront recovery streams through the handle', /_loadMissingShopBg\([\s\S]{0,800}_stream\.request\(bgKey, path/.test(rs));

  // Item 6 — the shared once('loaderror') pattern must not return
  check("no shared once('loaderror') listener anywhere in RestStopScene", !/once\('loaderror'/.test(rs));
  check("no shared once('complete') as the primary story-art path", !/scene\.load\.once\('complete'[^\n]*\n[^\n]*loadedArtKeys/.test(st));
  check('portrait placeholder is never written to the real key', /\$\{key\}__ph/.test(rs));

  // Item 7 — pins protect what is displayed
  check('scenery/police pin predicate is registered', /_stream\?\.pin\(\(k\) => this\._isStreamedKeyOnScreen\(k\)\)/.test(gs));
  check('pin covers displayed bands', /_isStreamedKeyOnScreen\(k\)[\s\S]{0,400}displayTexture\?\.key === k/.test(gs));
  check('pin covers the visible plate and peaks', /_nbBasePlate\?\.visible/.test(gs) && /_landmarkImgs\?\.\[i\]\?\.visible/.test(gs));
  check('rest-stop pins the card portrait and the storefront on screen', /_cardPortraitKey \|\| this\._shopBg\?\.texture\?\.key === k/.test(rs));
  check('story tile pins the panel on screen', /artHandle\?\.pin\(\(k\) => k === artOnScreen\)/.test(st));
  check('route-window eviction goes through releaseUnpinned', /stream\.releaseUnpinned\(routeStreamEvictableKeys\(\)/.test(gs));
  check('rest-stop release goes through the streamer', /_releaseRestStopTextures\(\)[\s\S]{0,600}stream\.release\(keys\)/.test(gs));

  // Items 2/3 — main.js uses the tested modules
  check('main.js settle ladder comes from ViewportSettle', mj.includes('createSettleScheduler({ apply: applyOrientation })'));
  check('main.js no longer keeps its own settle timer arrays', !/_settleTimers/.test(mj));
  check('rotate-enter timers are coalesced too', mj.includes("createSettleScheduler({ apply: _rotateEnter"));
  check('GPU recovery is the guarded controller', mj.includes('createVisibilityRecovery({'));
  check('recovery is busy while a settle is pending / a load is in flight',
    /isBusy: \(\) => _settle\.pending\(\)[\s\S]{0,300}inFlight/.test(mj));
  check('the old throw→rebuild probe is gone', !/catch \(_\) \{ return true; \}/.test(mj));
  check('canvas zoom config is unchanged (backing buffer is not DPR-scaled under FIT — see StabilityDiag)',
    mj.includes('zoom: window.devicePixelRatio || 1'));

  // Item 1 — breadcrumbs at the lifecycle points the directive lists
  check('boot crumb', bootScene.includes("crumb(this.game, 'boot')"));
  check('game create/shutdown crumbs', gs.includes("'game-create'") && gs.includes("'game-shutdown'"));
  check('rest-stop enter/exit crumbs', rs.includes("'reststop-enter'") && rs.includes("'reststop-exit'"));
  check('story open/close crumbs', st.includes("'story-open'") && st.includes("'story-close'"));
  check('settle crumb only when the fit changed', /_lastFitW = fw; _lastFitH = fh;[\s\S]{0,1600}crumb\(game, 'settle'/.test(mj));
  check('visibility crumbs (hidden is the one that survives a kill)', mj.includes("st === 'hidden' ? 'hidden' : 'visible'"));
  check('GPU recovery crumbs before and after', mj.includes("'gpu-rebuild-start'") && mj.includes("crumb(game, 'gpu-' + ev)"));
  check('previous-session report installed in main.js BEFORE the first crumb',
    /new Phaser\.Game\(config\);[\s\S]{0,400}installDiagProbe\(game\)/.test(mj) && !bootScene.includes('installDiagProbe('));

  // 2026-09-16 device probe: the byte budget evicted in-window police frames
  // while the sweep kept re-requesting them.  The route windows must be
  // PINNED so the budget is a backstop above them, never a competitor.
  check('scenery evict window is pinned', /_scnKeep\?\.has\(k\)/.test(gs) && /this\._scnKeep = keep/.test(gs));
  check('every queued police agency is pinned, not just live cops',
    /_policeKeyPinned\(k\)[\s\S]{0,900}for \(const id of \(this\._polQueued \?\? \[\]\)\)/.test(gs));
}

console.log(`stability tests: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
