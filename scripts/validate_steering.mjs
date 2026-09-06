// Touch steering — HELD-STATE validation (2026-09-04 owner report: "press both
// left and right thumb at the same time and release your left thumb and the car
// will not go right").  Steering is derived from the fingers still on the glass,
// not from the last press/release, so this drives Phaser's real input emitter
// with multiple pointer ids and asserts _touchLeft / _touchRight after each
// press and lift.
//
//   1. npm run dev   (port 3000)
//   2. node scripts/validate_steering.mjs
import { createRequire } from 'module';
const PROJ = '/Users/brendanbaughn/Documents/Claude/Road trip roulette';
const require = createRequire(PROJ + '/package.json');
const { chromium } = require('playwright-core');
const EXE = '/Users/brendanbaughn/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let failures = 0;
const check = (ok, label, detail = '') => {
  console.log(`${ok ? '  ✓' : '  ✗ FAIL'} ${label}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
};

const browser = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
page.on('pageerror', e => console.log('PAGEERROR:', (e.stack ?? e.message).slice(0, 250)));
await page.addInitScript(() => { try { localStorage.setItem('rtr_intro_call_done', '1'); } catch (_) {} });
await page.goto('http://localhost:3000/');
await page.waitForFunction(() => window.__phaserGame?.scene?.getScene?.('Game')?.player, null, { timeout: 30000 });
await sleep(800);

// Probe rig: put the scene in plain classic-steering gameplay and blank every
// live button box so a mid-screen press lands on open road, not a pedal.
await page.evaluate(() => {
  const gs = window.__phaserGame.scene.getScene('Game');
  gs._paused = false;
  gs._awaitingStart = false;
  gs._awaitingFirstGameTap = false;
  // _introDone is latched at create() from _awaitingStart; flipping the flag
  // late would drop update() into the (unreachable in real play) intro-pan
  // branch, which dereferences a never-created _introGfx.
  gs._introDone = true;
  gs._ctrlEditMode = false;
  gs._draggingViceId = gs._draggingSurvKey = gs._draggingStars = null;
  gs._noSteerThisGesture = false;
  gs._steerPtrs?.clear();
  gs._anyModalOpen = () => false;
  gs._activeSteeringMode = () => 'classic';
  gs._topRowButtons = [];
  gs._pedalHitZones = [];
  gs._weaponCellBounds = null;
  gs._disguiseHitBounds = null;
  gs._wiperLiveBounds = null;
  gs._missionChipBounds = null;
  gs._mirrorBaseBounds = null;
  window.__probe = {
    // Emit through the real InputPlugin emitter the handlers are bound to.
    down: (id, x, y = 300) => {
      const gs = window.__phaserGame.scene.getScene('Game');
      gs.input.emit('pointerdown', { id, x, y, isDown: true });
    },
    move: (id, x, y = 300) => {
      const gs = window.__phaserGame.scene.getScene('Game');
      gs.input.emit('pointermove', { id, x, y, isDown: true });
    },
    up: (id, x, y = 300) => {
      const gs = window.__phaserGame.scene.getScene('Game');
      gs.input.emit('pointerup', { id, x, y, isDown: false });
    },
    read: () => {
      const gs = window.__phaserGame.scene.getScene('Game');
      return {
        L: !!gs._touchLeft, R: !!gs._touchRight,
        steer: gs._isLeft() ? 'left' : gs._isRight() ? 'right' : 'none',
        ptrs: [...(gs._steerPtrs ?? new Map())].map(([k, v]) => k + ':' + v).join(','),
      };
    },
  };
});

// Discover the actual canvas-space x for each half (HUD_OFFSET_X may shift it)
// by pressing and asking which side the scene registered.
const LEFT_X = await page.evaluate(() => {
  const gs = window.__phaserGame.scene.getScene('Game');
  for (let x = 4; x < 900; x += 10) {
    window.__probe.down(99, x); const s = gs._steerPtrs.get(99); window.__probe.up(99, x);
    if (s === 'L') return x;
  }
  return -1;
});
const RIGHT_X = await page.evaluate(() => {
  const gs = window.__phaserGame.scene.getScene('Game');
  for (let x = 896; x > 0; x -= 10) {
    window.__probe.down(99, x); const s = gs._steerPtrs.get(99); window.__probe.up(99, x);
    if (s === 'R') return x;
  }
  return -1;
});
console.log(`\nsteer halves: left x=${LEFT_X}  right x=${RIGHT_X}`);
if (LEFT_X < 0 || RIGHT_X < 0) { console.log('could not locate steer halves'); await browser.close(); process.exit(1); }

const step = (fn) => page.evaluate(fn, { LEFT_X, RIGHT_X });

console.log('\n[1] two thumbs down, LEFT lifts → car must go RIGHT (the reported bug)');
let r = await page.evaluate(({ LEFT_X, RIGHT_X }) => {
  const p = window.__probe; p.up(1); p.up(2);
  p.down(1, LEFT_X);  const a = p.read();
  p.down(2, RIGHT_X); const b = p.read();
  p.up(1, LEFT_X);    const c = p.read();
  p.up(2, RIGHT_X);   const d = p.read();
  return { a, b, c, d };
}, { LEFT_X, RIGHT_X });
check(r.a.L && !r.a.R, 'left thumb alone steers left', JSON.stringify(r.a));
check(r.b.L && r.b.R, 'both thumbs register as both held', JSON.stringify(r.b));
check(!r.c.L && r.c.R && r.c.steer === 'right', 'lifting LEFT leaves the car steering RIGHT', JSON.stringify(r.c));
check(!r.d.L && !r.d.R && r.d.steer === 'none', 'lifting both stops the steer', JSON.stringify(r.d));

console.log('\n[2] mirrored: RIGHT lifts → car must go LEFT');
r = await page.evaluate(({ LEFT_X, RIGHT_X }) => {
  const p = window.__probe; p.up(1); p.up(2);
  p.down(1, RIGHT_X); p.down(2, LEFT_X);
  const b = p.read(); p.up(1, RIGHT_X); const c = p.read(); p.up(2, LEFT_X);
  return { b, c };
}, { LEFT_X, RIGHT_X });
check(r.b.L && r.b.R, 'both held', JSON.stringify(r.b));
check(r.c.L && !r.c.R && r.c.steer === 'left', 'lifting RIGHT leaves the car steering LEFT', JSON.stringify(r.c));

console.log('\n[3] third finger churn — two on the right, one lifts, still right');
r = await page.evaluate(({ LEFT_X, RIGHT_X }) => {
  const p = window.__probe; p.up(1); p.up(2); p.up(3);
  p.down(1, RIGHT_X); p.down(2, RIGHT_X); p.down(3, LEFT_X);
  const a = p.read(); p.up(3, LEFT_X); const b = p.read(); p.up(1, RIGHT_X); const c = p.read();
  p.up(2, RIGHT_X); const d = p.read();
  return { a, b, c, d };
}, { LEFT_X, RIGHT_X });
check(r.a.L && r.a.R, 'two right + one left held', JSON.stringify(r.a));
check(!r.b.L && r.b.R, 'left lifts → right only', JSON.stringify(r.b));
check(r.c.R && r.c.steer === 'right', 'one of two right fingers lifts → still right', JSON.stringify(r.c));
check(!r.d.L && !r.d.R, 'all up → neutral', JSON.stringify(r.d));

console.log('\n[4] single-finger drag across the center line still switches sides');
r = await page.evaluate(({ LEFT_X, RIGHT_X }) => {
  const p = window.__probe; p.up(1);
  p.down(1, LEFT_X); const a = p.read();
  p.move(1, RIGHT_X); const b = p.read();
  p.move(1, LEFT_X);  const c = p.read();
  p.up(1, LEFT_X);
  return { a, b, c };
}, { LEFT_X, RIGHT_X });
check(r.a.L && !r.a.R, 'press left', JSON.stringify(r.a));
check(!r.b.L && r.b.R, 'drag right of center → right', JSON.stringify(r.b));
check(r.c.L && !r.c.R, 'drag back left → left', JSON.stringify(r.c));

console.log('\n[5] a finger that starts on a top-row button never steers, and does not');
console.log('    cancel the other thumb that IS steering');
r = await page.evaluate(({ LEFT_X, RIGHT_X }) => {
  const p = window.__probe; p.up(1); p.up(2);
  p.down(1, RIGHT_X); const a = p.read();
  p.down(2, LEFT_X, 20);          // y<20 = top button band
  const b = p.read();
  p.move(2, RIGHT_X, 300);        // drag the button finger onto the road
  const c = p.read();
  p.up(2, RIGHT_X); const d = p.read();
  p.up(1, RIGHT_X);
  return { a, b, c, d };
}, { LEFT_X, RIGHT_X });
check(r.a.R && !r.a.L, 'right thumb steering', JSON.stringify(r.a));
check(r.b.R && !r.b.L, 'button press does not add a steer', JSON.stringify(r.b));
check(r.c.R && !r.c.L, 'button finger stays suppressed while dragging', JSON.stringify(r.c));
check(r.d.R && !r.d.L, 'lifting the button finger leaves the thumb steering', JSON.stringify(r.d));

console.log(`\n${failures === 0 ? 'ALL PASS' : failures + ' FAILURE(S)'}`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);
