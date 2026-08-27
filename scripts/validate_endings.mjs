// Ending-screen outcome validation harness (2026-08-27).
//
//   1. npm run dev   (port 3000)
//   2. node scripts/validate_endings.mjs
//
// Drives real runs to CRASHED / BUSTED / OUT OF GAS endings and verifies the
// RESTART DRIVE / CONTINUE buttons' previewed cash+mileage+HP+fuel exactly
// match the state after choosing them, across difficulties, repeats, missing
// checkpoints and inventory restoration.  Screenshots (desktop + mobile
// aspect) land in tmp/ending_validation/.  Dev-machine tool: expects the
// playwright-core chromium build in ~/Library/Caches/ms-playwright.
import { createRequire } from 'module';
import fs from 'fs';
const PROJ = decodeURIComponent(new URL('..', import.meta.url).pathname);
const require = createRequire(PROJ + '/package.json');
const { chromium } = require('playwright-core');
const OUTDIR = PROJ + 'tmp/ending_validation/';
fs.mkdirSync(OUTDIR, { recursive: true });
const EXE = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let failures = 0;
const check = (ok, label, detail = '') => {
  console.log(`${ok ? '  ✓' : '  ✗ FAIL'} ${label}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
};

const browser = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });

async function newPage(viewport = { width: 900, height: 506 }) {
  const page = await browser.newPage({ viewport });
  page.on('pageerror', e => console.log('PAGEERROR:', (e.stack ?? e.message).slice(0, 300)));
  await page.addInitScript(() => {
    try { localStorage.setItem('rtr_intro_call_done', '1'); } catch (_) {}
  });
  await page.goto('http://localhost:3000/');
  await page.waitForFunction(() => window.__phaserGame?.scene?.getScene?.('Game')?.player, null, { timeout: 30000 });
  return page;
}

// Start a run at the given difficulty; dismisses plate modal + tutorial pauses.
async function startRun(page, difficulty = 'normal') {
  await page.evaluate((diff) => {
    const g = window.__phaserGame;
    g.registry.set('titleDiffPick', diff); g.registry.set('difficulty', diff);
    const gs = g.scene.getScene('Game');
    if (g.scene.isActive('GameOver')) g.scene.getScene('GameOver').scene.start('Game', {});
  }, difficulty);
  await sleep(600);
  await page.evaluate(() => {
    const gs = window.__phaserGame.scene.getScene('Game');
    if (gs._awaitingStart !== false) gs.scene.restart();
  });
  await sleep(900);
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
  await sleep(1200);
  await page.evaluate(() => {
    try { localStorage.removeItem('rtr_tutStage2'); } catch (_) {}
    const gs = window.__phaserGame.scene.getScene('Game');
    gs._endHudTour?.(); gs._startHudTour = () => {}; gs._showTourTip = () => {};
    if (gs._paused) gs._paused = false;
  });
  await sleep(300);
}

const crashNow = (page) => page.evaluate(() => {
  const gs = window.__phaserGame.scene.getScene('Game');
  gs._invincibleUntil = 0;
  gs._applyDamage(9999, 'head_on');
});

const waitGameOver = async (page) => {
  await page.waitForFunction(() => window.__phaserGame.scene.isActive('GameOver'), null, { timeout: 15000 });
  await sleep(600);   // plate art callback + UI build
};

const readGameOver = (page) => page.evaluate(() => {
  const go = window.__phaserGame.scene.getScene('GameOver');
  return { outcomes: go.outcomes, startCash: go.driveStartCash,
           finalScore: go.finalScore, cause: go.cause,
           texts: go.children?.list?.filter(o => o.type === 'Text').map(o => o.text) };
});

const readGameState = (page) => page.evaluate(() => {
  const gs = window.__phaserGame.scene.getScene('Game');
  return { cash: Math.round(gs.score), pos: Math.round(gs.player.position),
           hp: gs.damage?.getDurability?.(), fuel: gs.player?.gasMi,
           stars: gs.cops?.stars, f12: [...(gs.cops?.f12Tokens ?? [])],
           cpName: gs._lastCheckpoint?.name };
});

// ═════ SCENARIO A (normal): earn, consume-state change, crash, RESTART ═════
console.log('A — earn + inventory change, crash, RESTART DRIVE restores snapshot');
{
  const page = await newPage();
  await startRun(page, 'normal');
  // Seed a known snapshot difference: pretend the drive started with one
  // donut + $0 (fresh), then mid-drive: earn cash, pick up a weapon.
  await page.evaluate(() => {
    const gs = window.__phaserGame.scene.getScene('Game');
    gs._driveStartSnap.f12Tokens = ['donut'];         // drive began holding a donut
    gs.score += 500;                                   // mid-drive earnings
    gs.cops.f12Tokens = ['donut', 'fireworks'];        // mid-drive pickup
    gs._runItemCounts.weapons = { 'Rolling Coal': 2 }; // items-collected tally
    // Mid-run purchase that a restart must revert (cost is refunded by the
    // cash restore, so the part cannot survive).
    const sv = gs.registry.get('save');
    sv?.set?.('upgrades', { beater: { engine: 'engine_1' } });
  });
  await sleep(300);
  const preSnap = await page.evaluate(() => ({ ...window.__phaserGame.scene.getScene('Game')._driveStartSnap }));
  await crashNow(page);
  await waitGameOver(page);
  const go = await readGameOver(page);
  check(go.cause === 'crash' && !!go.outcomes?.restart, 'crashed with outcome data');
  check(go.outcomes.restart.cash === preSnap.cash, 'restart preview = snapshot cash', `${go.outcomes.restart.cash} vs ${preSnap.cash}`);
  const sumLine = go.texts.find(t => /EARNED THIS DRIVE|LOST THIS DRIVE/.test(t ?? ''));
  const labelIdx = go.texts.indexOf(sumLine);
  check(!!sumLine, 'accounting delta row rendered', String(sumLine));
  // crash penalty halves earnings-since-checkpoint, so final < start+500 → LOST or EARNED depending on numbers; just require label matches sign
  const delta = go.finalScore - go.startCash;
  check((delta >= 0) === /EARNED/.test(sumLine ?? 'LOST'), 'delta label matches sign', `delta=${delta} label=${sumLine}`);
  await page.screenshot({ path: OUTDIR + 'crashed_desktop.png' });
  // ITEMS COLLECTED modal — weapons/special counts render.
  await page.evaluate(() => window.__phaserGame.scene.getScene('GameOver')._openViceLog());
  await sleep(300);
  const modalTexts = await page.evaluate(() => {
    const out = [];
    const walk = (list) => list?.forEach?.(o => {
      if (o.type === 'Text') out.push(o.text);
      if (o.list) walk(o.list);           // containers (the modal layer)
    });
    walk(window.__phaserGame.scene.getScene('GameOver').children.list);
    return out;
  });
  check(modalTexts.some(t => /ITEMS COLLECTED/.test(t ?? '')), 'items modal title renamed');
  check(modalTexts.some(t => /Rolling Coal ×2/.test(t ?? '')), 'weapon pickup count listed');
  await page.screenshot({ path: OUTDIR + 'items_collected.png' });
  await page.evaluate(() => {
    const go2m = window.__phaserGame.scene.getScene('GameOver');
    go2m._closeViceLog?.();
  });
  await sleep(200);
  // Apply RESTART via the same method the button calls.
  await page.evaluate(() => window.__phaserGame.scene.getScene('GameOver')._applyRestartOutcome());
  await sleep(1500);
  const st = await readGameState(page);
  check(st.cash === preSnap.cash, 'post-restart cash = button amount', `${st.cash} vs ${preSnap.cash}`);
  // Position: the car starts driving the moment the scene lands, so allow
  // the ~1.5 s of forward travel between apply and this probe.
  check(st.pos >= preSnap.position && st.pos - preSnap.position < 60000,
        'post-restart position = snapshot (+ drive-off drift)', `${st.pos} vs ${preSnap.position}`);
  check(Math.round(st.hp) === Math.round(preSnap.hp), 'post-restart HP = snapshot', `${st.hp} vs ${preSnap.hp}`);
  check(Math.abs((st.fuel ?? 0) - (preSnap.fuelMi ?? 0)) < 0.6, 'post-restart fuel = snapshot', `${st.fuel} vs ${preSnap.fuelMi}`);
  check(JSON.stringify(st.f12) === JSON.stringify(['donut']), 'restart restores drive-start inventory (pickup removed)', JSON.stringify(st.f12));
  check(go.outcomes.restart.mi === 0, 'restart always returns to mile 0', String(go.outcomes.restart.mi));
  const upg = await page.evaluate(() => window.__phaserGame.scene.getScene('Game').registry.get('save')?.get?.('upgrades'));
  check(JSON.stringify(upg?.beater ?? {}) === JSON.stringify(preSnap.upgrades?.beater ?? {}),
        'restart reverts mid-run upgrade purchase', JSON.stringify(upg));

  // ═════ SCENARIO B: repeat restarts can't duplicate money ═════
  console.log('B — second crash + restart restores the SAME snapshot');
  await sleep(400);
  await page.evaluate(() => { window.__phaserGame.scene.getScene('Game').score += 900; });
  await crashNow(page);
  await waitGameOver(page);
  const go2 = await readGameOver(page);
  check(go2.outcomes.restart.cash === preSnap.cash, 'restart preview unchanged on repeat', `${go2.outcomes.restart.cash}`);
  await page.evaluate(() => window.__phaserGame.scene.getScene('GameOver')._applyRestartOutcome());
  await sleep(1500);
  const st2 = await readGameState(page);
  check(st2.cash === preSnap.cash, 'repeat restart: same cash, no duplication', String(st2.cash));

  // ═════ SCENARIO C: CONTINUE — halving fee, applied == previewed ═════
  console.log('C — crash with cash, CONTINUE (checkpoint + recovery fee)');
  await page.evaluate(() => { window.__phaserGame.scene.getScene('Game').score = 7863; });
  await sleep(200);
  await crashNow(page);
  await waitGameOver(page);
  const go3 = await readGameOver(page);
  const c3 = go3.outcomes.cont;
  check(c3.valid === true, 'checkpoint continue valid');
  check(c3.cash === Math.floor(go3.finalScore / 2), 'continue preview = half remaining', `${c3.cash} vs final ${go3.finalScore}`);
  check(/Includes .* recovery/.test(c3.note ?? ''), 'recovery fee note present', c3.note);
  const contBtnTexts = go3.texts.filter(t => /Resume at|Includes/.test(t ?? ''));
  check(contBtnTexts.length >= 1, 'continue button renders resume line', JSON.stringify(contBtnTexts));
  await page.evaluate(() => window.__phaserGame.scene.getScene('GameOver')._applyContinueOutcome());
  await sleep(1500);
  const st3 = await readGameState(page);
  check(st3.cash === c3.cash, 'post-continue cash = button amount', `${st3.cash} vs ${c3.cash}`);

  // ═════ SCENARIO D: repeat continues each re-apply the rule ═════
  console.log('D — second continue halves again (no penalty skip)');
  await crashNow(page);
  await waitGameOver(page);
  const go4 = await readGameOver(page);
  check(go4.outcomes.cont.cash === Math.floor(go4.finalScore / 2), 'second continue halves current remaining', `${go4.outcomes.cont.cash} vs ${go4.finalScore}`);
  check(go4.outcomes.cont.mi >= c3.mi - 0.01,
        'continue never offers a checkpoint behind the last resume point', `${go4.outcomes.cont.mi} vs ${c3.mi}`);
  await page.close();
}

// ═════ SCENARIO E (hard): BUSTED — bail once, continue keeps remainder ═════
console.log('E — hard difficulty BUSTED: continue keeps post-bail cash');
{
  const page = await newPage();
  await startRun(page, 'hard');
  await page.evaluate(() => { const gs = window.__phaserGame.scene.getScene('Game'); gs.score = 5000; });
  await sleep(300);
  await page.evaluate(() => {
    const gs = window.__phaserGame.scene.getScene('Game');
    gs.cops.stars = 3; gs.cops.arrestPending = true;
  });
  await page.waitForFunction(() => window.__phaserGame.scene.isActive('GameOver'), null, { timeout: 20000 });
  await sleep(600);
  const go = await readGameOver(page);
  check(go.cause === 'busted', 'busted ending reached');
  check(go.outcomes.cont.cash === go.finalScore, 'busted continue keeps post-bail cash (no extra fee)', `${go.outcomes.cont.cash} vs ${go.finalScore}`);
  check(go.outcomes.cont.fee === 0, 'no recovery fee on busted');
  check(go.outcomes.restart.cash === go.startCash, 'busted restart restores pre-drive cash', `${go.outcomes.restart.cash} vs ${go.startCash}`);
  await page.screenshot({ path: OUTDIR + 'busted_desktop.png' });
  await page.evaluate(() => window.__phaserGame.scene.getScene('GameOver')._applyContinueOutcome());
  await sleep(1500);
  const st = await readGameState(page);
  check(st.cash === go.outcomes.cont.cash, 'post-continue cash matches (busted)', String(st.cash));
  await page.close();
}

// ═════ SCENARIO F (easy): crash ending outcomes on easy ═════
console.log('F — easy difficulty crash: rules render + apply the same');
{
  const page = await newPage();
  await startRun(page, 'easy');
  await page.evaluate(() => { window.__phaserGame.scene.getScene('Game').score = 2000; });
  await sleep(200);
  await crashNow(page);
  await waitGameOver(page);
  const go = await readGameOver(page);
  check(go.outcomes.cont.cash === Math.floor(go.finalScore / 2), 'easy continue uses the same engine rule', `${go.outcomes.cont.cash} vs ${go.finalScore}`);
  await page.evaluate(() => window.__phaserGame.scene.getScene('GameOver')._applyContinueOutcome());
  await sleep(1500);
  const st = await readGameState(page);
  check(st.cash === go.outcomes.cont.cash, 'easy: applied == previewed', String(st.cash));
  await page.close();
}

// ═════ SCENARIO G: no checkpoint → CONTINUE disabled ═════
console.log('G — no checkpoint: continue disabled, not clickable-through');
{
  const page = await newPage();
  await startRun(page, 'normal');
  await page.evaluate(() => { window.__phaserGame.scene.getScene('Game')._lastCheckpoint = null; });
  await crashNow(page);
  await waitGameOver(page);
  const go = await readGameOver(page);
  check(go.outcomes.cont.valid === false, 'continue outcome invalid');
  check(go.texts.some(t => t === 'NO CHECKPOINT AVAILABLE'), 'NO CHECKPOINT AVAILABLE rendered');
  const before = await page.evaluate(() => window.__phaserGame.scene.isActive('GameOver'));
  await page.evaluate(() => window.__phaserGame.scene.getScene('GameOver')._applyContinueOutcome());
  await sleep(600);
  const after = await page.evaluate(() => window.__phaserGame.scene.isActive('GameOver'));
  check(before && after, 'continue no-ops when invalid (still on GameOver)');
  await page.screenshot({ path: OUTDIR + 'no_checkpoint.png' });
  await page.close();
}

// ═════ SCENARIO H: out of gas card shows outcome sub-lines ═════
console.log('H — out of gas: tow + start-over sub-lines');
{
  const page = await newPage();
  await startRun(page, 'normal');
  await page.evaluate(() => {
    const gs = window.__phaserGame.scene.getScene('Game');
    gs.score = 4000;                       // enough to tow
    gs.player.gasMi = 0.05;                // about to run dry
  });
  await page.waitForFunction(() =>
    !!window.__phaserGame.scene.getScene('Game')._outOfGasCard, null, { timeout: 25000 });
  await sleep(700);
  const texts = await page.evaluate(() =>
    window.__phaserGame.scene.getScene('Game').children.list
      .filter(o => o.type === 'Text').map(o => o.text));
  // The card prints the live wallet; the tow sub-line must be exactly that
  // minus the $1,500 fee (the run may earn a few dollars before running dry).
  const wallet = Number((texts.find(t => /^WALLET/.test(t ?? '')) ?? '').replace(/[^0-9]/g, ''));
  const towSub = texts.find(t => /^→ \$[\d,]+ · /.test(t ?? '')) ?? '';
  const towCash = Number(towSub.replace(/^→ \$([\d,]+).*$/, '$1').replace(/,/g, ''));
  check(wallet > 1500 && towCash === wallet - 1500,
        'tow sub-line = wallet minus $1,500 fee', `wallet=${wallet} sub=${towSub}`);
  check(texts.some(t => /^→ .*mi$/.test(t ?? '')), 'start-over sub-line shows snapshot cash + place');
  await page.screenshot({ path: OUTDIR + 'out_of_gas.png' });
  await page.close();
}

// ═════ SCENARIO I: big cash + long names fit (mobile aspect) ═════
console.log('I — mobile aspect + large values: layout fits');
{
  const page = await newPage({ width: 844, height: 390 });
  await startRun(page, 'normal');
  await page.evaluate(() => {
    const gs = window.__phaserGame.scene.getScene('Game');
    gs.score = 12345678;
    gs._driveStartSnap.cash = 99999999;
    gs._driveStartSnap.locName = 'An Extremely Long Checkpoint Name WA';
    gs._lastCheckpoint = { name: 'Another Very Long Town Name, WA', position: gs.player.position, scoreAtCP: 0 };
  });
  await sleep(200);
  await crashNow(page);
  await waitGameOver(page);
  const go = await readGameOver(page);
  check(go.texts.some(t => /\$99,999,999/.test(t ?? '')), 'large restart cash rendered with commas');
  check(go.texts.some(t => /…/.test(t ?? '')), 'long location truncated with ellipsis');
  await page.screenshot({ path: OUTDIR + 'crashed_mobile.png' });
  await page.close();
}

// ═════ SCENARIO J: Easy bust — cinematic plays, then checkpoint respawn ═════
console.log('J — easy bust: takedown cinematic, respawn with full HP + banner');
{
  const page = await newPage();
  await startRun(page, 'easy');
  await page.evaluate(() => {
    const gs = window.__phaserGame.scene.getScene('Game');
    gs.score = 3000;
    gs.cops.stars = 3; gs.cops.arrestPending = true;
  });
  await sleep(1200);
  const mid = await page.evaluate(() => {
    const gs = window.__phaserGame.scene.getScene('Game');
    return { cine: !!gs._endingCine, kind: gs._endingCine?.kind,
             easy: !!gs._endingCine?.easyRespawn };
  });
  check(mid.cine && mid.kind === 'busted' && mid.easy, 'easy bust runs the BUSTED cinematic with respawn payload', JSON.stringify(mid));
  await sleep(6500);   // cinematic (~4.8s) + respawn
  const end = await page.evaluate(() => {
    const g = window.__phaserGame;
    const gs = g.scene.getScene('Game');
    return { gameOver: g.scene.isActive('GameOver'), game: g.scene.isActive('Game'),
             hp: gs.damage?.getDurability?.(), max: gs.damage?.getMax?.(),
             cash: Math.round(gs.score), popup: gs._popupText?.text ?? gs.popupText?.text ?? null };
  });
  check(!end.gameOver && end.game, 'no GameOver screen — run continues', JSON.stringify(end));
  check(end.hp === end.max, 'respawned fully repaired (old Easy rule kept)', `${end.hp}/${end.max}`);
  check(end.cash <= 3000, 'bail stayed docked (no refund on respawn)', String(end.cash));
  await page.screenshot({ path: OUTDIR + 'easy_bust_respawn.png' });
  await page.close();
}

await browser.close();
console.log(failures === 0 ? '\nALL ENDING-OUTCOME CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
