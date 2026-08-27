// Vehicle visual-orientation validation harness (2026-08-27).
//
//   1. npm run dev   (port 3000)
//   2. node scripts/validate_pose.mjs
//
// Sweeps the full angle ladder per genre (frames, mirroring/folding, car
// content-size stability, ground anchor, physics isolation), then drives the
// live steering ladder with real key input and both PIT directions.
// Screenshots land in tmp/pose_validation/.  Dev-machine tool: expects the
// playwright-core chromium build in ~/Library/Caches/ms-playwright.
import { createRequire } from 'module';
const PROJ = '/Users/brendanbaughn/Documents/Claude/Road trip roulette';
const require = createRequire(PROJ + '/package.json');
const { chromium } = require('playwright-core');
const EXE = '/Users/brendanbaughn/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
import fs from 'fs';
const OUTDIR = new URL('../tmp/pose_validation/', import.meta.url).pathname;
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

async function bootGenre(genre) {
  if (!page.url().startsWith('http')) await page.goto('http://localhost:3000/');
  await page.evaluate((g) => { try { localStorage.setItem('rtr.genre', g); } catch (_) {} }, genre);
  await page.reload();
  await page.waitForFunction(() => window.__phaserGame?.scene?.getScene?.('Game')?.player, null, { timeout: 30000 });
  await page.evaluate(() => {
    const g = window.__phaserGame;
    g.registry.set('titleDiffPick', 'normal'); g.registry.set('difficulty', 'normal');
    g.scene.getScene('Game').scene.restart();
  });
  await sleep(1000);
  await page.evaluate(() => {
    const gs = window.__phaserGame.scene.getScene('Game');
    gs._clearLiveRun?.();          // else a prior sweep's autosave opens the resume prompt
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
  // Fresh headless profiles trigger the first-run HUD tour, which PAUSES the
  // game ~0.4 s into the run — dismiss it and clear its stage flag.
  await page.evaluate(() => {
    try { localStorage.removeItem('rtr_tutStage2'); } catch (_) {}
    const gs = window.__phaserGame.scene.getScene('Game');
    gs._endHudTour?.();
    gs._startHudTour = () => {};   // it can re-arm later and pause mid-test
    gs._showTourTip  = () => {};   // contextual tip popups also pause
    if (gs._paused) gs._paused = false;
  });
  await sleep(200);
}

const poseProbe = () => page.evaluate(() => {
  const gs = window.__phaserGame.scene.getScene('Game');
  const ps = gs.playerSprite;
  const key = ps?.texture?.key;
  const box = gs._texContentBox?.(key);
  const b = ps?.getBounds?.();
  return {
    tex: key, flip: !!ps?.flipX,
    dw: Math.round(ps?.displayWidth), dh: Math.round(ps?.displayHeight),
    carW: box ? Math.round(box.w * (ps.displayWidth / box.cw)) : null,
    carH: box ? Math.round(box.h * (ps.displayHeight / box.ch)) : null,
    y: Math.round(ps?.y), bottom: b ? Math.round(b.bottom) : null,
    px: +(+(gs.player?.x ?? 0)).toFixed(3),
  };
});

const ANGLES = [0, 7, 12, 30, 60, 90, 120, 150, 180, 210, 270, 330];

for (const genre of ['norteno', 'classic_rock', 'metal']) {
  console.log(`\n═════ GENRE: ${genre} ═════`);
  await bootGenre(genre);
  // Freeze gameplay so the steer pose can't fight the stepped angles.
  await page.evaluate(() => { window.__phaserGame.scene.getScene('Game')._paused = true; });
  const rows = [];
  for (const a of ANGLES) {
    await page.evaluate((ang) => {
      const gs = window.__phaserGame.scene.getScene('Game');
      gs._applyPoseFrame(ang, -1);
    }, a);
    await sleep(60);
    const s = await poseProbe();
    rows.push({ a, ...s });
    if ([0, 12, 60, 90, 120, 150, 210].includes(a)) await page.screenshot({ path: SHOT(`pose_${genre}_${a}`) });
  }
  for (const r of rows) console.log(`   ${String(r.a).padStart(3)}° ${String(r.tex).padEnd(30)} flip=${r.flip} car=${r.carW}x${r.carH} y=${r.y} px=${r.px}`);
  // Checks: car height stable ±25% of the 0° height; y stable ±6px; player.x untouched.
  const h0 = rows[0].carH, y0 = rows[0].y, px0 = rows[0].px;
  check(rows.every(r => r.carH && Math.abs(r.carH - h0) <= Math.max(6, h0 * 0.25)),
        'car content height stable through rotation', rows.map(r => r.carH).join(','));
  check(rows.every(r => Math.abs(r.y - y0) <= 6), 'ground anchor: no vertical hop', rows.map(r => r.y).join(','));
  check(rows.every(r => r.px === px0), 'player physics x untouched by pose swaps');
  check(rows.find(r => r.a === 7).tex.endsWith('_007') && rows.find(r => r.a === 12).tex.endsWith('_012'),
        'true 7°/12° frames used');
  check(rows.find(r => r.a === 90).tex.endsWith('spin_090'), '90° uses the side profile');
  check(rows.find(r => r.a === 180).tex.endsWith('front'), '180° uses the front view');
  const r150 = rows.find(r => r.a === 150), r210 = rows.find(r => r.a === 210);
  check(r150.tex === r210.tex && r150.flip !== r210.flip,
        '210° folds to mirrored 150° (full-revolution mapping)', `${r150.flip} vs ${r210.flip}`);
  const r330 = rows.find(r => r.a === 330), r30 = rows.find(r => r.a === 30);
  check(r330.tex === r30.tex && r330.flip !== r30.flip, '330° folds to mirrored 30°', `${r30.flip} vs ${r330.flip}`);
  await page.evaluate(() => { window.__phaserGame.scene.getScene('Game')._paused = false; });
}

// ═════ Steering ladder + mirroring (real key input, norteno left loaded last → reboot) ═════
console.log('\n═════ STEERING LADDER (metal, live input) ═════');
{
  await bootGenre('metal');   // FRESH boot — reused thrice-reloaded pages go stale
  await sleep(400);
  const tex = () => page.evaluate(() => ({
    tex: window.__phaserGame.scene.getScene('Game').playerSprite?.texture?.key,
    flip: !!window.__phaserGame.scene.getScene('Game').playerSprite?.flipX,
    tier: window.__phaserGame.scene.getScene('Game')._steerPose?.tier,
    angle: +(window.__phaserGame.scene.getScene('Game')._steerPose?.angle ?? 0).toFixed(1),
  }));
  const idle = await tex();
  check(String(idle.tex).endsWith('_back'), 'straight driving uses starter_back', idle.tex);
  // Quick tap → 7° frame.
  await page.keyboard.down('ArrowLeft');
  await sleep(170);
  const tap = await tex();
  await page.keyboard.up('ArrowLeft');
  check(tap.tex?.endsWith('_007') && tap.flip === true, 'light LEFT steering → 7° frame, MIRRORED (art is nose-right native)', JSON.stringify(tap));
  await sleep(600);
  // Long hold → 12° frame.
  await page.keyboard.down('ArrowRight');
  await sleep(1000);
  const hold = await tex();
  const diag = await page.evaluate(async () => {
    const gs = window.__phaserGame.scene.getScene('Game');
    const t0 = gs.gameTime;
    await new Promise(r => setTimeout(r, 250));
    return { paused: gs._paused, awaitStart: gs._awaitingStart, cine: !!gs._endingCine,
             ticking: gs.gameTime > t0, load: +(gs._steerPose?.load ?? 0).toFixed(2),
             intent: gs._steerIntent, pit: !!gs._pitSpin,
             tip: !!gs._tourTip, garage: !!gs._garageModalOpen, ad: !!gs._adActive,
             oog: !!gs._outOfGasCard, modal: !!gs._modalOpen, hudTour: !!gs._hudTour,
             tut: !!gs._titleTut, gas: gs._gasTankMi ?? gs._fuelMi ?? null };
  });
  console.log('   diag:', JSON.stringify(diag));
  check(hold.tex?.endsWith('_012') && hold.flip === false, 'held RIGHT steering → 12° frame, native (nose-right art)', JSON.stringify(hold));
  // Release → passes back through 7° to 0°.
  await page.keyboard.up('ArrowRight');
  const seq = [];
  for (let i = 0; i < 14; i++) { seq.push((await tex()).tex); await sleep(45); }
  const passed7 = seq.some(t => t?.endsWith('_007'));
  const endsBase = seq[seq.length - 1]?.endsWith('_back');
  check(passed7 && endsBase, 'release unwinds 12→7→0 (no snap)', seq.map(t => t?.slice(-8)).join('>'));
}

// ═════ PIT spin direction ═════
console.log('\n═════ PIT SPIN DIRECTION ═════');
{
  for (const [dir, expectFlip, label] of [[1, true, 'push RIGHT → nose-left (spin art mirrored)'], [-1, false, 'push LEFT → nose-right (spin art native)']]) {
    await page.evaluate((d) => {
      const gs = window.__phaserGame.scene.getScene('Game');
      gs._startPitSpin(d);
    }, dir);
    await sleep(400);   // mid-spin (peak ~0.55s)
    const mid = await page.evaluate(() => {
      const gs = window.__phaserGame.scene.getScene('Game');
      return { tex: gs.playerSprite?.texture?.key, flip: !!gs.playerSprite?.flipX };
    });
    check(mid.tex?.includes('spin_') && mid.flip === expectFlip, `PIT ${label}`, JSON.stringify(mid));
    await sleep(900);   // let it finish
  }
  const done = await page.evaluate(() => window.__phaserGame.scene.getScene('Game').playerSprite?.texture?.key);
  check(String(done).endsWith('_back'), 'PIT spin settles back on the rear view', done);
}

await browser.close();
console.log(failures === 0 ? '\nALL POSE CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
