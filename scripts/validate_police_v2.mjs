// Police rendering pipeline — MOTION + geometry validation (2026-08-29
// pipeline review).  Complements validate_police.mjs (agency/frame matrix):
// this one watches values OVER TIME to catch scale popping, baseline jumps,
// light bars detaching, 180→0 snapping, rotor jitter and facing flicker.
//
//   1. npm run dev   (port 3000)
//   2. node scripts/validate_police_v2.mjs
import { createRequire } from 'module';
const PROJ = '/Users/brendanbaughn/Documents/Claude/Road trip roulette';
const require = createRequire(PROJ + '/package.json');
const { chromium } = require('playwright-core');
const EXE = '/Users/brendanbaughn/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
import fs from 'fs';
import { fileURLToPath } from 'url';
const OUTDIR = fileURLToPath(new URL('../tmp/police_validation/', import.meta.url));
fs.mkdirSync(OUTDIR, { recursive: true });

let failures = 0;
const check = (ok, label, detail = '') => {
  console.log(`${ok ? '  ✓' : '  ✗ FAIL'} ${label}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
};

async function boot(viewport) {
  const browser = await chromium.launch({ executablePath: EXE, headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
  const page = await browser.newPage({ viewport });
  page.on('pageerror', e => console.log('PAGEERROR:', (e.stack ?? e.message).slice(0, 250)));
  await page.addInitScript(() => { try { localStorage.setItem('rtr_intro_call_done', '1'); } catch (_) {} });
  await page.goto('http://localhost:3000/');
  await page.waitForFunction(() => window.__phaserGame?.scene?.getScene?.('Game')?.player, null, { timeout: 30000 });
  await page.evaluate(() => {
    const g = window.__phaserGame;
    g.registry.set('titleDiffPick', 'normal'); g.registry.set('difficulty', 'normal');
    g.scene.getScene('Game').scene.restart();
  });
  await sleep(1000);
  await page.evaluate(() => {
    const gs = window.__phaserGame.scene.getScene('Game');
    gs._clearLiveRun?.(); gs._fireTitleCursor?.();
  });
  await sleep(800);
  await page.evaluate(() => {
    const m = document.getElementById('plate-modal');
    if (m?.classList?.contains('open')) {
      const i = document.getElementById('plate-input');
      i.value = 'TESTER'; i.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('plate-done').click();
    }
  });
  await page.waitForFunction(() =>
    !document.getElementById('plate-modal')?.classList?.contains('open'), null, { timeout: 10000 });
  await sleep(1200);
  await page.evaluate(() => {
    try { localStorage.removeItem('rtr_tutStage2'); } catch (_) {}
    const gs = window.__phaserGame.scene.getScene('Game');
    gs._endHudTour?.(); gs._startHudTour = () => {}; gs._showTourTip = () => {};
    if (gs._paused) gs._paused = false;
    gs._awaitingFirstGameTap = false;   // ready-state freezes gameTime (pose clocks) until the first tap
    window.__pin = setInterval(() => {
      const g2 = window.__phaserGame.scene.getScene('Game');
      if (!g2?.player) return;
      g2.player.gasMi = 999; g2.player.hp = 100;
      g2._arrestHandled = true;               // probes must never end the run
      if (g2.cops) {
        g2.cops.bumpCount = 0; g2.cops.headOnCount = 0; g2.cops.pitCount = 0;
        g2.cops._spawnCooldown = 9e9;                   // no autonomous spawns —
        g2.cops._tickOnrampReinforcements = () => {};   // probes own the roster
      }
      if (g2.survival) { g2.survival.food = 90; g2.survival.drinks = 90; g2.survival.alertness = 90; }
    }, 300);
  });
  return { browser, page };
}

const MILE = (page) => page.evaluate(() => {
  const gs = window.__phaserGame.scene.getScene('Game');
  return (gs.road.segments.length * 200) / 293;
});

async function spawnCop(page, mile, agencyId, opts = {}) {
  await page.evaluate(({ mile, agencyId, opts, MU }) => {
    const gs = window.__phaserGame.scene.getScene('Game');
    gs._awaitingFirstGameTap = false;
    gs.player.position = mile * MU;
    gs.player.speed = opts.speed ?? 14000;
    gs.cops.cops.length = 0;
    gs.cops.stars = 2.5;
    gs._ensurePoliceAssets(true);
    const cop = gs.cops._spawnRearFromEncounter(gs.player.position);
    cop.__probe = true;
    cop.agencyId = agencyId;
    cop.position = gs.player.position + (opts.rel ?? 1500);
    if (opts.latV !== undefined) {
      Object.defineProperty(cop, '_latV', { configurable: true, get: () => opts.latV, set() {} });
    }
    if (opts.pinRel !== undefined) {
      Object.defineProperty(cop, 'position', { configurable: true,
        get: () => gs.player.position + opts.pinRel, set() {} });
      // Pinned cops plow through traffic and chip their HP → wreck splice.
      Object.defineProperty(cop, 'hp', { configurable: true, get: () => 100, set() {} });
    }
    if (opts.onStation) {
      Object.defineProperty(cop, '_onStation', { configurable: true, get: () => true, set() {} });
      // A held on-station unit arms a PIT within seconds and the PIT strike
      // SPLICES it (that's gameplay) — keep the probe cop un-armable.
      Object.defineProperty(cop, '_pitArmed', { configurable: true, get: () => false, set() {} });
      Object.defineProperty(cop, '_lungeT',   { configurable: true, get: () => 0,     set() {} });
    }
  }, { mile, agencyId, opts, MU: await MILE(page) });
}

const { browser, page } = await boot({ width: 900, height: 506 });
const MU = await MILE(page);
await page.evaluate(() => {
  const gs = window.__phaserGame.scene.getScene('Game');
  gs.player.position = 3 * ((gs.road.segments.length * 200) / 293);
  gs._ensurePoliceAssets(true);
});
await page.waitForFunction(() =>
  window.__phaserGame.scene.getScene('Game').textures.exists('jur_seattle_police_000'), null, { timeout: 25000 });

// ── 1. Pursuit motion: no scale pops / baseline jumps; bar glued ────────
{
  await spawnCop(page, 3, 'seattle_police', { pinRel: 1800 });
  await sleep(800);
  const samples = [];
  for (let i = 0; i < 50; i++) {
    const s = await page.evaluate(() => {
      const gs = window.__phaserGame.scene.getScene('Game');
      const c = gs.cops.cops.find(x => x.__probe) ?? gs.cops.cops[0];
      const gm = c?._renderGeom, fr = c?._renderFrame;
      if (!gm || !fr) return null;
      const m = fr.meta;
      return { key: fr.key,
        bodyH: gm.targetH * (m.cy1 - (m.sy0 ?? m.cy0)),   // solid car height on screen
        base:  gm.seatY, alpha: gm.alpha };
    });
    if (s) samples.push(s);
    await sleep(50);
  }
  check(samples.length > 30, 'pursuit motion sampled', `${samples.length} frames`);
  let popBad = 0, baseBad = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i];
    if (a.bodyH > 8 && Math.abs(b.bodyH - a.bodyH) / a.bodyH > 0.25) popBad++;
    if (Math.abs(b.base - a.base) > Math.max(14, a.bodyH * 0.6)) baseBad++;
  }
  check(popBad === 0, 'no frame-to-frame scale pops (>25%)', `${popBad} pops`);
  check(baseBad === 0, 'no baseline jumps', `${baseBad} jumps`);
  await page.screenshot({ path: OUTDIR + '20_motion_pursuit.png' });
}

// ── 2. Steering: right = native art, left = 0° fallback, never mirrored ─
{
  await spawnCop(page, 3, 'seattle_police', { latV: 0.6, pinRel: 2400, onStation: true });   // hard RIGHT
  await sleep(900);
  const r = await page.evaluate(() => {
    const f = (window.__phaserGame.scene.getScene('Game').cops.cops.find(x => x.__probe) ?? window.__phaserGame.scene.getScene('Game').cops.cops[0])?._renderFrame;
    return { key: f?.key, flip: f?.flipX };
  });
  check(r.key?.endsWith('_012') && r.flip === false, 'right steer uses native 12°, unmirrored', JSON.stringify(r));
  await page.screenshot({ path: OUTDIR + '21_steer_right.png' });
  await spawnCop(page, 3, 'seattle_police', { latV: -0.6, pinRel: 2400, onStation: true });  // hard LEFT
  await sleep(900);
  const l = await page.evaluate(() => {
    const f = (window.__phaserGame.scene.getScene('Game').cops.cops.find(x => x.__probe) ?? window.__phaserGame.scene.getScene('Game').cops.cops[0])?._renderFrame;
    return { key: f?.key, flip: f?.flipX };
  });
  check(l.key?.endsWith('_000') && l.flip === false, 'left steer falls back to 0°, never mirrored', JSON.stringify(l));
  await page.screenshot({ path: OUTDIR + '22_steer_left.png' });
}

// ── 3. Diverted spin: one-shot to 180, holds — never snaps back to 0 ────
{
  await page.evaluate((MU) => {
    const gs = window.__phaserGame.scene.getScene('Game');
    gs.cops.cops.length = 0; gs.cops.stars = 2.5;
    const cop = gs.cops._spawnRearFromEncounter(gs.player.position);
    cop.agencyId = 'seattle_police';
    cop.position = gs.player.position + 2000;
    gs._awaitingFirstGameTap = false;
    gs.cops._coalSmokeOut(cop);   // the real diverted/smoked path
    cop._fleeTimer = 30;          // hold it alive long enough to sample
  }, MU);
  const seen = [];
  for (let i = 0; i < 30; i++) {
    const k = await page.evaluate(() =>
      (window.__phaserGame.scene.getScene('Game').cops.cops.find(x => x.__probe)
        ?? window.__phaserGame.scene.getScene('Game').cops.cops[0])?._renderFrame?.key ?? null);
    if (k) seen.push(k);
    await sleep(60);
  }
  const angles = seen.map(k => parseInt(k.match(/_(\d+)(?:_left)?$/)?.[1] ?? '-1', 10));
  const reached180At = angles.indexOf(180);
  check(reached180At >= 0, 'diverted spin reaches 180°', angles.join(','));
  const after = angles.slice(reached180At);
  check(after.every(a => a === 180), 'holds 180° after the spin — no 180→0 snap', after.join(','));
  await page.screenshot({ path: OUTDIR + '23_diverted_hold180.png' });
}

// ── 4. PIT spin fx: full revolution, stable body height + ground line ───
{
  await page.evaluate(() => {
    const gs = window.__phaserGame.scene.getScene('Game');
    gs.cops.cops.length = 0;
    const cop = { laneOffset: 0.4, colorSet: 'police', agencyId: 'seattle_police', position: gs.player.position };
    gs._spawnCopSpinFx(cop, 450, 300, 70);
  });
  const snaps = [];
  for (let i = 0; i < 16; i++) {
    const s = await page.evaluate(() => {
      const gs = window.__phaserGame.scene.getScene('Game');
      const e = gs.explosions.find(x => x.copFrames);
      if (!e?.img?.scene) return null;
      const f = e.copFrames[e._copIdx ?? 0];
      const m = f.meta;
      return { key: e.img.texture.key,
        solidH: e.img.displayHeight * (m.cy1 - (m.sy0 ?? m.cy0)),
        groundY: e.img.y + e.img.displayHeight * (m.cy1 - f._oy),   // tire line on screen
        rot: e.img.rotation };
    });
    if (s) snaps.push(s);
    await sleep(70);
  }
  check(snaps.length >= 8, 'pit spin sampled', `${snaps.length}`);
  const keys = snaps.map(s => s.key);
  check(keys.some(k => k.endsWith('_180')), 'pit spin passes through 180°', [...new Set(keys)].join(','));
  const hs = snaps.map(s => s.solidH);
  const hSpread = (Math.max(...hs) - Math.min(...hs)) / Math.max(...hs);
  check(hSpread < 0.12, 'spin body height stable (no broadside shrink)', `spread ${(hSpread * 100).toFixed(1)}%`);
  const gys = snaps.map(s => s.groundY);
  check(Math.max(...gys) - Math.min(...gys) < 6, 'spin tire baseline stable', `${(Math.max(...gys) - Math.min(...gys)).toFixed(1)}px drift`);
  check(snaps.every(s => Math.abs(s.rot) < 0.001), 'no canvas rotation (lettering never reversed)');
  await sleep(700);
}

// ── 5. Tunnel: body + bar share the tunnel scale ────────────────────────
{
  await spawnCop(page, 5.15, 'seattle_police', { speed: 2000, rel: 6000, pinRel: 6000 });   // Mt Baker tunnel 4.9-5.6
  await sleep(900);
  const t = await page.evaluate(() => {
    const gs = window.__phaserGame.scene.getScene('Game');
    const c = gs.cops.cops.find(x => x.__probe) ?? gs.cops.cops[0];
    return { inTunnel: c?._renderGeom?.inTunnel ?? null, hasGeom: !!c?._renderGeom };
  });
  check(t.hasGeom && t.inTunnel === true, 'cop renders with tunnel geometry (bar shares 0.88 scale)', JSON.stringify(t));
  await page.screenshot({ path: OUTDIR + '24_tunnel_cop.png' });
}

// ── 6. Two cops + near/mid/far ──────────────────────────────────────────
{
  await page.evaluate((MU) => {
    const gs = window.__phaserGame.scene.getScene('Game');
    gs.player.position = 3 * MU; gs.player.speed = 12000;
    gs.cops.cops.length = 0; gs.cops.stars = 3.5;
    for (const rel of [1500, 6000, 14000]) {
      const c = gs.cops._spawnRearFromEncounter(gs.player.position);
      c.agencyId = 'seattle_police';
      Object.defineProperty(c, 'position', { configurable: true,
        get: () => gs.player.position + rel, set() {} });   // pinned seat per distance
    }
  }, MU);
  await sleep(700);
  const n = await page.evaluate(() =>
    window.__phaserGame.scene.getScene('Game').cops.cops.filter(c => c._renderGeom).length);
  check(n >= 2, 'multiple cruisers render simultaneously (near/mid/far)', `${n} with geometry`);
  await page.screenshot({ path: OUTDIR + '25_three_distances.png' });
}

// ── 7. Boundary: agency stays stamped across a jurisdiction line ────────
{
  await spawnCop(page, 9.5, 'seattle_police', { speed: 16000, pinRel: 1500 });
  await sleep(400);
  const before = await page.evaluate(() => (window.__phaserGame.scene.getScene('Game').cops.cops.find(x => x.__probe) ?? window.__phaserGame.scene.getScene('Game').cops.cops[0])?.agencyId);
  await page.evaluate((MU) => {   // warp the CHASE across mile 10 (Seattle→Bellevue)
    const gs = window.__phaserGame.scene.getScene('Game');
    gs.player.position += 1.2 * MU;   // probe cop's pinned seat follows the player
  }, MU);
  await sleep(600);
  const after = await page.evaluate(() => {
    const gs = window.__phaserGame.scene.getScene('Game');
    const c = gs.cops.cops.find(x => x.__probe) ?? gs.cops.cops[0];
    return { agency: c?.agencyId, frame: c?._renderFrame?.key ?? null };
  });
  check(before === 'seattle_police' && after.agency === 'seattle_police'
    && (after.frame ?? '').includes('seattle_police'),
    'chase keeps its agency across the mile-10 boundary', JSON.stringify(after));
}

// ── 8. Helicopter: 3 frames ~11fps, stable body, facing hysteresis ──────
{
  await page.evaluate(() => {
    const gs = window.__phaserGame.scene.getScene('Game');
    gs.cops.cops.length = 0; gs.cops.stars = 4.9;
    gs.cops._heliDownT = 0; gs.cops.helicopterActive = true; gs.cops.helicopterPhase = 0.01;
    clearInterval(window.__starPin);
    window.__starPin = setInterval(() => {
      const g2 = window.__phaserGame.scene.getScene('Game');
      if (g2?.cops) { g2.cops.stars = 4.9; g2.cops._heliDownT = 0; }
    }, 400);
  });
  await page.waitForFunction(() =>
    window.__phaserGame.scene.getScene('Game').textures.exists('cop_heli_r3'), null, { timeout: 25000 });
  await page.waitForFunction(() =>
    window.__phaserGame.scene.getScene('Game').hudHelicopterImg?.visible === true, null, { timeout: 15000 });
  const hs = [];
  for (let i = 0; i < 70; i++) {
    const s = await page.evaluate(() => {
      const gs = window.__phaserGame.scene.getScene('Game');
      const img = gs.hudHelicopterImg;
      if (!img?.visible) return null;
      const m = gs.textures ? null : null;
      return { key: img.texture.key, h: Math.round(img.displayHeight), y: Math.round(img.y),
               tint: img.tintTopLeft };
    });
    if (s) hs.push(s);
    await sleep(90);
  }
  const keys = new Set(hs.map(s => s.key));
  check([...keys].filter(k => !k.endsWith('_flip')).length >= 3 || [...keys].filter(k => k.endsWith('_flip')).length >= 3,
    'all three rotor frames cycle', [...keys].join(','));
  // Body height stability: displayHeight varies with per-frame registration,
  // but the FUSELAGE height (displayH × body frac) is what must hold — probe
  // it via the game's own meta.
  const flipIdx = hs.map((s, i) => i > 0 && s.key.endsWith('_flip') !== hs[i - 1].key.endsWith('_flip') ? i : -1).filter(i => i > 0);
  const rapid = flipIdx.filter((v, i) => i > 0 && v - flipIdx[i - 1] <= 2).length;
  check(rapid === 0 && flipIdx.length <= 7,
    'facing turns follow the sway, no center flicker', `${flipIdx.length} turns, ${rapid} rapid, in ${hs.length} samples`);
  const tints = new Set(hs.map(s => s.tint));
  check(tints.size === 1 && tints.has(0xFFFFFF), 'fuselage keeps natural color (no whole-body tint)', [...tints].map(t => t.toString(16)).join(','));
  await page.screenshot({ path: OUTDIR + '26_heli_glow.png' });
  await page.evaluate(() => clearInterval(window.__starPin));
}

await page.evaluate(() => clearInterval(window.__pin));
await browser.close();

// ── 9. Mobile viewport spot check ───────────────────────────────────────
{
  const { browser: b2, page: p2 } = await boot({ width: 844, height: 390 });
  await p2.evaluate(() => {
    const gs = window.__phaserGame.scene.getScene('Game');
    gs.player.position = 3 * ((gs.road.segments.length * 200) / 293);
    gs.player.speed = 14000;
    gs.cops.cops.length = 0; gs.cops.stars = 2.5;
    gs._ensurePoliceAssets(true);
  });
  await p2.waitForFunction(() =>
    window.__phaserGame.scene.getScene('Game').textures.exists('jur_seattle_police_000'), null, { timeout: 25000 });
  await p2.evaluate(() => {
    const gs = window.__phaserGame.scene.getScene('Game');
    const c = gs.cops._spawnRearFromEncounter(gs.player.position);
    c.__probe = true; c.agencyId = 'seattle_police';
    Object.defineProperty(c, 'position', { configurable: true,
      get: () => gs.player.position + 1800, set() {} });
  });
  await sleep(900);
  const mres = await p2.evaluate(() => {
    const gs = window.__phaserGame.scene.getScene('Game');
    const c = gs.cops.cops.find(x => x.__probe) ?? gs.cops.cops[0];
    return { geom: !!c?._renderGeom, frame: c?._renderFrame?.key ?? null,
             rel: c ? Math.round(c.position - gs.player.position) : null,
             paused: gs._paused, await: gs._awaitingStart, tap: gs._awaitingFirstGameTap };
  });
  check(mres.geom && (mres.frame ?? '').startsWith('jur_seattle'),
    'mobile viewport renders jurisdiction cop with shared geometry', JSON.stringify(mres));
  await p2.screenshot({ path: OUTDIR + '27_mobile_viewport.png' });
  await p2.evaluate(() => clearInterval(window.__pin));
  await b2.close();
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
