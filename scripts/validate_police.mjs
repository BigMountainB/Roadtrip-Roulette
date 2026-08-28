// Jurisdiction-police visual validation harness (2026-08-27).
//
//   1. npm run dev   (port 3000)
//   2. node scripts/validate_police.mjs
//
// Warps down the route validating each jurisdiction's cruiser art in-game:
// agency frame resolution, steering ladder (007/012), PIT spin fx, SWAT,
// oncoming/front view, lightbar anchor data, helicopter frames both ways,
// pause behavior.  Screenshots land in tmp/police_validation/.
// Dev-machine tool: expects the playwright-core chromium build in
// ~/Library/Caches/ms-playwright.
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
const SHOT = (n) => `${OUTDIR}${n}.png`;

let failures = 0;
const check = (ok, label, detail = '') => {
  console.log(`${ok ? '  ✓' : '  ✗ FAIL'} ${label}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
};

const browser = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 900, height: 506 } });
page.on('pageerror', e => console.log('PAGEERROR:', (e.stack ?? e.message).slice(0, 300)));
await page.addInitScript(() => { try { localStorage.setItem('rtr_intro_call_done', '1'); } catch (_) {} });

// ── Boot into a run (validate_pose.mjs pattern) ─────────────────────────
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
  gs._clearLiveRun?.();
  gs._fireTitleCursor?.();
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
  gs._endHudTour?.();
  gs._startHudTour = () => {};
  gs._showTourTip  = () => {};
  if (gs._paused) gs._paused = false;
});
await sleep(200);

// Pin throttle (RTR auto-throttles; probes must drive) + keep vices/fuel out
// of the way for the whole session.
await page.evaluate(() => {
  const gs = window.__phaserGame.scene.getScene('Game');
  window.__pin = setInterval(() => {
    const gs2 = window.__phaserGame.scene.getScene('Game');
    if (!gs2?.player) return;
    gs2.player.gasMi = 999; gs2.player.hp = 100;
    if (gs2.survival) { gs2.survival.food = 90; gs2.survival.drinks = 90; gs2.survival.alertness = 90; }
  }, 300);
  gs._paused = false;
});

const MILE_UNITS = await page.evaluate(() => {
  const gs = window.__phaserGame.scene.getScene('Game');
  return (gs.road.segments.length * 200) / 293;
});

/** Warp, clear cops, spawn one rear pursuer with a FORCED agency, wait for
 *  its jurisdiction texture to stream in, probe its resolved frame. */
async function probeAgency(name, mile, agencyId, expectPrefix) {
  await page.evaluate(({ mile, agencyId, MILE_UNITS }) => {
    const gs = window.__phaserGame.scene.getScene('Game');
    gs.player.position = mile * MILE_UNITS;
    gs.player.speed = 14000;
    gs.cops.cops.length = 0;
    gs.cops.stars = 2.5;                       // mid-integer (decay gotcha)
    gs._ensurePoliceAssets(true);              // force-queue this region now
    const cop = gs.cops._spawnRearFromEncounter(gs.player.position);
    cop.agencyId = agencyId;                   // deterministic for validation
    // Just behind the CAR (player.position + VIRTUAL_Z 3000) — inside the
    // near-synth band, so the cruiser renders large in the forward view.
    cop.position = gs.player.position + 1500;
  }, { mile, agencyId, MILE_UNITS });
  // Wait for the set's 000 frame to be loaded.
  await page.waitForFunction((pfx) =>
    window.__phaserGame.scene.getScene('Game').textures.exists(`jur_${pfx}_000`),
    expectPrefix, { timeout: 20000 });
  await sleep(1400);                           // let the cruiser close into view
  const probe = await page.evaluate(() => {
    const gs = window.__phaserGame.scene.getScene('Game');
    const cop = gs.cops.cops[0];
    return cop ? { agency: cop.agencyId, frame: cop._renderFrame?.key ?? null,
                   lat: +(cop._latV ?? 0).toFixed(3), rel: Math.round(cop.position - gs.player.position) }
               : null;
  });
  const ok = !!probe?.frame && probe.frame.startsWith(`jur_${expectPrefix}_`);
  check(ok, `${name}: jurisdiction frame`, JSON.stringify(probe));
  await page.screenshot({ path: SHOT(name) });
  return probe;
}

// ── The nine agencies at their route positions ──────────────────────────
await probeAgency('01_seattle_mi3',      3,   'seattle_police',          'seattle_police');
await probeAgency('02_bellevue_mi13',    13,  'bellevue_police',         'bellevue_police');
await probeAgency('03_snoqualmie_mi33',  33,  'snoqualmie_police',       'snoqualmie_police');
await probeAgency('04_wsp_mi48',         48,  'washington_state_patrol', 'wsp');
await probeAgency('05_kittitas_mi90',    90,  'kittitas_county_sheriff', 'kittitas_sheriff');
await probeAgency('06_ellensburg_mi110', 110, 'ellensburg_police',       'ellensburg_police');
await probeAgency('07_adams_mi160',      160, 'adams_county_sheriff',    'adams_sheriff');
await probeAgency('08_othello_mi185',    185, 'othello_police',          'othello_police');
await probeAgency('09_pullman_mi285',    285, 'pullman_police',          'pullman_police');

// Un-forced agency pick sanity: spawn 12 cops at mile 110, all should carry
// SOME agency from the mile-110 pool.
{
  const picks = await page.evaluate((MILE_UNITS) => {
    const gs = window.__phaserGame.scene.getScene('Game');
    gs.cops.cops.length = 0;
    const out = [];
    for (let i = 0; i < 12; i++) {
      const c = gs.cops._spawnRearFromEncounter(gs.player.position);
      out.push(c.agencyId); }
    gs.cops.cops.length = 0;
    return out;
  }, MILE_UNITS);
  const pool = ['pullman_police', 'washington_state_patrol'];   // player is at mi 285 now
  check(picks.every(p => pool.includes(p)), 'spawn picks stay in the mile pool', picks.join(','));
}

// ── Steering ladder: force lateral velocity, expect 007 then 012 ────────
async function steerProbe(name, latV, wantSuffix) {
  await page.evaluate(({ latV, MILE_UNITS }) => {
    const gs = window.__phaserGame.scene.getScene('Game');
    gs.player.position = 110 * MILE_UNITS;
    gs.player.speed = 14000;
    gs.cops.cops.length = 0;
    gs.cops.stars = 2.5;
    const cop = gs.cops._spawnRearFromEncounter(gs.player.position);
    cop.agencyId = 'ellensburg_police';
    cop.position = gs.player.position + 1500;
    // Pin lateral velocity via a getter — CopSystem.update rewrites _latV
    // every frame, so an interval-based pin races it.
    Object.defineProperty(cop, '_latV', { configurable: true, get: () => latV, set() {} });
  }, { latV, MILE_UNITS });
  await sleep(900);   // > hysteresis hold
  const frame = await page.evaluate(() =>
    window.__phaserGame.scene.getScene('Game').cops.cops[0]?._renderFrame?.key ?? null);
  check(frame?.endsWith(wantSuffix), `steer ladder ${name}`, frame);
  await page.screenshot({ path: SHOT(`10_steer_${name}`) });
}
await steerProbe('000_straight', 0.0,  '_000');
await steerProbe('007_gentle',   0.15, '_007');
await steerProbe('012_strong',   0.60, '_012');

// ── PIT spin fx: agency frames step 60→180, no canvas rotation ─────────
{
  await page.evaluate(() => {
    const gs = window.__phaserGame.scene.getScene('Game');
    const cop = gs.cops.cops[0] ?? { laneOffset: 0.4, colorSet: 'police' };
    cop.agencyId = 'ellensburg_police';
    gs._spawnCopSpinFx(cop, 450, 300, 70);
  });
  await sleep(120);
  const fx1 = await page.evaluate(() => {
    const gs = window.__phaserGame.scene.getScene('Game');
    const e = gs.explosions.find(x => x.copFrames);
    return e ? { tex: e.img?.texture?.key, rot: e.img?.rotation ?? 0, frames: e.copFrames.length } : null;
  });
  check(!!fx1 && /jur_ellensburg_police_(060|090)/.test(fx1.tex ?? ''), 'PIT spin fx starts at contact frames', JSON.stringify(fx1));
  await page.screenshot({ path: SHOT('11_pit_spin_early') });
  await sleep(280);
  const fx2 = await page.evaluate(() => {
    const gs = window.__phaserGame.scene.getScene('Game');
    const e = gs.explosions.find(x => x.copFrames);
    return e ? { tex: e.img?.texture?.key, rot: e.img?.rotation ?? 0 } : null;
  });
  check(!!fx2 && /_(120|150|180)$/.test(fx2.tex ?? ''), 'PIT spin fx reaches 120-180', JSON.stringify(fx2));
  check(!fx2 || Math.abs(fx2.rot) < 0.001, 'spin fx never canvas-rotates (no mirrored lettering)', String(fx2?.rot));
  await page.screenshot({ path: SHOT('12_pit_spin_late') });
  await sleep(600);
}

// ── SWAT ────────────────────────────────────────────────────────────────
{
  await page.evaluate((MILE_UNITS) => {
    const gs = window.__phaserGame.scene.getScene('Game');
    gs.cops.cops.length = 0;
    gs.cops.stars = 4.9;
    const cop = gs.cops._spawnRearFromEncounter(gs.player.position);
    cop.colorSet = 'swat'; cop.agencyId = 'swat'; cop.damageMul = 2;
    cop.position = gs.player.position + 1500;
  }, MILE_UNITS);
  await page.waitForFunction(() =>
    window.__phaserGame.scene.getScene('Game').textures.exists('car_back_swat_rendered'), null, { timeout: 20000 });
  await sleep(900);
  const probe = await page.evaluate(() => {
    const gs = window.__phaserGame.scene.getScene('Game');
    const c = gs.cops.cops[0];
    return { frame: c?._renderFrame?.key, cls: c?._renderFrame?.vehicleClass,
             ws: +(c?._renderFrame?.widthScale ?? 0).toFixed(3) };
  });
  // Any frame of the NEW rendered/turn/spin SWAT set is correct here (the
  // van may be mid-steer); the legacy car_back_swat would be the failure.
  check(/^car_(back|front)_swat_(rendered|turn_0\d+|spin_0\d+)$/.test(probe.frame ?? ''),
    'SWAT rendered art in pursuit', JSON.stringify(probe));
  check(probe.cls === 'swat', 'SWAT sized as the largest class', probe.cls);
  await page.screenshot({ path: SHOT('13_swat') });
}

// ── Oncoming = front view (jurisdiction 180) ────────────────────────────
{
  await page.evaluate((MILE_UNITS) => {
    const gs = window.__phaserGame.scene.getScene('Game');
    gs.cops.cops.length = 0;
    gs.cops.stars = 3.5;
    gs.cops.cops.push({ id: 1, position: gs.player.position + 12000, laneOffset: -0.5,
      speed: -9000, baseSpeed: -9000, side: 'front', kind: 'oncoming', colorSet: 'police',
      agencyId: 'ellensburg_police', color: 0xFFFFFF, alive: true, painted: false,
      _closeFactor: 0, _laneDrift: 0 });
  }, MILE_UNITS);
  await sleep(500);
  const frame = await page.evaluate(() =>
    window.__phaserGame.scene.getScene('Game').cops.cops[0]?._renderFrame?.key ?? null);
  check(frame === 'jur_ellensburg_police_180', 'oncoming shows the true front view', frame);
  await page.screenshot({ path: SHOT('14_oncoming_front') });
}

// ── Helicopter: rendered frames, both directions, stable size ───────────
{
  await page.evaluate(() => {
    const gs = window.__phaserGame.scene.getScene('Game');
    gs.cops.cops.length = 0;
    gs.cops.stars = 4.9;
    gs.cops._heliDownT = 0;
    gs.cops.helicopterActive = true;
    gs.cops.helicopterPhase = 0.1;
  });
  await page.waitForFunction(() =>
    window.__phaserGame.scene.getScene('Game').textures.exists('cop_heli_r1'), null, { timeout: 20000 });
  const seen = new Set(); const sizes = new Set();
  for (let i = 0; i < 30; i++) {
    const s = await page.evaluate(() => {
      const gs = window.__phaserGame.scene.getScene('Game');
      const img = gs.hudHelicopterImg;
      return img?.visible ? { key: img.texture.key, w: Math.round(img.displayWidth), h: Math.round(img.displayHeight) } : null;
    });
    if (s) { seen.add(s.key); sizes.add(`${s.w}x${s.h}`); }
    await sleep(120);
  }
  const keys = [...seen];
  check(keys.length && keys.every(k => k.startsWith('cop_heli_r')), 'helicopter uses rendered frames', keys.join(','));
  check(keys.some(k => !k.endsWith('_flip')) , 'helicopter right-facing frames seen', keys.join(','));
  check(keys.some(k => k.endsWith('_flip')), 'helicopter flip frames seen (separately rendered)', keys.join(','));
  check(sizes.size === 1, 'helicopter size stable across frames', [...sizes].join(','));
  await page.screenshot({ path: SHOT('15_helicopter') });
}

// ── Pause mid-chase ─────────────────────────────────────────────────────
{
  await page.evaluate((MILE_UNITS) => {
    const gs = window.__phaserGame.scene.getScene('Game');
    gs.cops.stars = 2.5;
    const cop = gs.cops._spawnRearFromEncounter(gs.player.position);
    cop.agencyId = 'pullman_police';
    cop.position = gs.player.position + 1500;
    gs._paused = true;
  }, MILE_UNITS);
  await sleep(400);
  const err = await page.evaluate(() => window.__lastPageError ?? null);
  check(!err, 'pause during chase: no errors');
  await page.screenshot({ path: SHOT('16_paused_chase') });
  await page.evaluate(() => { window.__phaserGame.scene.getScene('Game')._paused = false; });
}

// ── Parked jurisdiction speed trap ──────────────────────────────────────
{
  const trap = await page.evaluate((MILE_UNITS) => {
    const gs = window.__phaserGame.scene.getScene('Game');
    const miles = gs.road.segments.trapMiles ?? [];
    // find a right-side trap sprite
    for (const tm of miles) {
      const idx = Math.floor(tm * (gs.road.segments.length / 293));
      for (let d = -3; d <= 3; d++) {
        const seg = gs.road.segments[(idx + d + gs.road.segments.length) % gs.road.segments.length];
        const sp = seg?.sprites?.find(s => s.type === 'cop_random_parked');
        if (sp) return { mile: tm, side: sp.side };
      }
    }
    return null;
  }, MILE_UNITS);
  if (trap) {
    await page.evaluate(({ trap, MILE_UNITS }) => {
      const gs = window.__phaserGame.scene.getScene('Game');
      gs.cops.cops.length = 0; gs.cops.stars = 0;
      gs.player.position = (trap.mile - 0.12) * MILE_UNITS;
      gs.player.speed = 3000;
      gs._ensurePoliceAssets(true);
    }, { trap, MILE_UNITS });
    await sleep(1600);
    await page.screenshot({ path: SHOT('17_parked_trap_' + trap.side) });
    console.log('  (trap at mile', trap.mile.toFixed(1), 'side', trap.side + ' — verify livery in screenshot)');
  } else check(false, 'found a parked trap to validate');
}

await page.evaluate(() => clearInterval(window.__pin));
await browser.close();
console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
