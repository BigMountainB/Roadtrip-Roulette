// ── Rolling Coal ("coal" F12 weapon) — node CLI unit tests ────────────────
// Run: node tests/coal.test.mjs   (also `npm test`)
//
// Regression for the 2026-07-14 bug: firing rolling coal did nothing to
// pursuing cops — they kept closing and ramming from behind.  Root cause:
// the smoke-zone test only accepted cops strictly BEHIND the player
// (rel < 0), but the rear-cop AI oscillates around rel ≈ 0 (alongside at
// playerSpeed + 200), so the cop actually applying ram pressure never
// qualified.  Coal must smoke every pursuer in the -15000..+2500 band:
// fleeing + _fleeNoSwerve.
// Recede (owner 2026-07-17): a smoked cop KEEPS PACE with the player for
// COAL_PACE_SEC (~1.5 s), then slows to 0.45× and falls back, dropping off the
// bottom edge the SAME WAY IT DROVE IN — pure positional recede, NO synthetic
// bottom-slide (_fleeExit stays 0), NO in-place fade. It despawns once rel ≤
// FLEE_DESPAWN_REL, or via the FLEE_MAX_SEC timer if the player is stopped.
// 2026-07-16 additions: a coal use that smokes >= 1 cop suppresses ALL new
// cop spawns for 30 s (_coalLull re-asserted onto _spawnCooldown every tick
// so nothing shortens it), and the synthetic exit slide (FLEE_EXIT_HOLD_REL
// depth clamp + screen-Y push in GameScene) replaces the old blink-out.

import { CopSystem, FLEE_EXIT_HOLD_REL, FLEE_EXIT_SPAN } from '../src/systems/CopSystem.js';
import { MAX_SPEED } from '../src/constants.js';
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; }
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

function pursuitCop(position, laneOffset = 0) {
  return {
    id: Math.random(), position, laneOffset,
    speed: MAX_SPEED, baseSpeed: MAX_SPEED,
    side: 'rear', kind: 'rear', colorSet: 'police', damageMul: 1,
    color: 0xFFFFFF, alive: true, painted: false,
    _closeFactor: 0.08, _laneDrift: 0.5,
  };
}

// ── Coal smokes the rear pursuer AND the alongside rammer ────────────────
{
  const cs = new CopSystem();
  cs.stars = 2;
  cs.addF12Token('coal');                       // grants 6 clouds
  const playerPos   = 100000;
  const playerSpeed = MAX_SPEED * 0.75;         // ~90 mph
  const rear      = pursuitCop(playerPos - 3000);   // classic tail chaser
  const alongside = pursuitCop(playerPos + 800);    // nose-ahead rammer (rel > 0!)
  const farAhead  = pursuitCop(playerPos + 20000);  // out of the cloud
  cs.cops.push(rear, alongside, farAhead);

  const res = cs.useF12Token('coal', playerPos);
  check('coal fire ok', res.ok === true);
  check('coal consumed a cloud', cs.coalAmmo === 5);
  check('rear pursuer smoked (fleeing)', rear.fleeing === true && rear._fleeNoSwerve === true);
  check('alongside rammer smoked too (rel > 0 band)', alongside.fleeing === true);
  check('far-ahead cop untouched', !farAhead.fleeing);
  check('PIT disarmed on smoked cops', !rear._pitArmed && !alongside._pitArmed);
  check('arrest counters cleared', cs.rearBumpCount === 0 && !cs.arrestPending);

  // Simulate up to 20 s of chase at fixed player speed — a smoked cop KEEPS
  // PACE (never gains, never exceeds player speed), then slows and recedes off
  // the bottom via PURE POSITION (rel ≤ FLEE_DESPAWN_REL), never the synthetic
  // slide (_fleeExit stays 0).
  let pos = playerPos;
  let minGapRear = Infinity, everGained = false, everOverSpeed = false;
  let prevGap = pos - rear.position;
  let maxExitRear = 0, lastRelRear = rear.position - pos;
  let despawnT = null;
  const dt = 1 / 60;
  for (let t = 0; t < 20; t += dt) {
    pos += playerSpeed * dt;
    cs.update(dt, pos, playerSpeed, 0);
    if (cs.cops.includes(rear)) {
      const gap = pos - rear.position;
      if (gap < prevGap - 1e-6) everGained = true;   // cop closed the gap
      if (rear.speed > playerSpeed + 1e-6) everOverSpeed = true;
      minGapRear = Math.min(minGapRear, gap);
      prevGap = gap;
      maxExitRear = Math.max(maxExitRear, rear._fleeExit ?? 0);
      lastRelRear = rear.position - pos;
    }
    if (despawnT == null && !cs.cops.includes(rear) && !cs.cops.includes(alongside)) despawnT = t;
  }
  check('smoked cop never gained on the player', !everGained);
  check('smoked cop never exceeds player speed (keeps pace, then slower)', !everOverSpeed);
  check('smoked cop never reached the player (no ram possible)', minGapRear >= 2500);
  check('smoked cops eventually despawned', despawnT != null);
  check('smoked cops despawned only after keep-pace phase', despawnT != null && despawnT > 1.5);
  // NO synthetic bottom-edge slide — it recedes off the bottom naturally.
  check('smoked cop never used the synthetic exit (_fleeExit stays 0)', maxExitRear === 0);
  check('rear cop had receded far behind when removed', lastRelRear <= -5000);
  check('unsmoked far-ahead cop survives', cs.cops.includes(farAhead));
}

// ── Barricade rows are immune to smoke (not chasing by sight) ─────────────
{
  const cs = new CopSystem();
  cs.stars = 5;
  cs.addF12Token('coal');
  const playerPos = 50000;
  const block = { ...pursuitCop(playerPos + 1000), kind: 'barricade', speed: 200, baseSpeed: 200 };
  cs.cops.push(block);
  cs.useF12Token('coal', playerPos);
  check('barricade cop not smoked', !block.fleeing);
}

// ── 30 s spawn suppression after a smoked cop ─────────────────────────────
{
  const cs = new CopSystem();
  cs.stars     = 2;
  cs.starTimer = 999;                 // hold the wanted level through the lull
  cs.addF12Token('coal');
  const playerSpeed = MAX_SPEED * 0.75;
  let pos = 100000;
  const chaser = pursuitCop(pos - 3000);
  cs.cops.push(chaser);

  cs.useF12Token('coal', pos);
  check('coal smoke arms >= 30 s spawn cooldown', cs._spawnCooldown >= 30);
  check('coal lull timer armed (guards encounter/barricade spawns too)', (cs._coalLull ?? 0) >= 30);

  // A later system trying to shorten the cooldown (trap escalation, star
  // change, clearArrest) must be overridden by the lull re-assert in update.
  cs._spawnCooldown = 1;
  const dt = 1 / 60;
  let firstSpawnT = null;
  const initial = new Set(cs.cops);
  // 120 s window: the post-lull spawn is a probabilistic per-tick roll, so a
  // 10 s tail sometimes (legitimately) produced no spawn — flaky test, not a
  // gameplay bug.  The lull assertion itself stays exact.
  for (let t = 0; t < 120; t += dt) {
    pos += playerSpeed * dt;
    cs.update(dt, pos, playerSpeed, 0);
    if (firstSpawnT == null && cs.cops.some(c => !initial.has(c))) firstSpawnT = t;
  }
  // 29.9 tolerance: t accumulates 1/60 floats, so the first legal spawn
  // tick lands at ~29.9999 rather than a clean 30.
  check('no new cop spawns during the 30 s lull', firstSpawnT == null || firstSpawnT >= 29.9);
  check('pursuit resumes after the lull (stars persisted)', firstSpawnT != null && firstSpawnT < 120);
}

// ── Timer failsafe removes a "stalled" coal cop (player fully stopped) ─────
// Player fully stopped: rel never changes, so the positional recede can't fire.
// The FLEE_MAX_SEC lifetime timer removes the cop instead — never immortal, and
// still no synthetic bottom-slide (_fleeExit stays 0).
{
  const cs = new CopSystem();
  cs.stars = 2;
  cs.addF12Token('coal');
  const playerPos = 100000;
  const stalled = pursuitCop(playerPos + 2000);   // visible ahead, rel = +2000
  cs.cops.push(stalled);
  cs.useF12Token('coal', playerPos);
  check('stalled cop smoked', stalled.fleeing === true && stalled._fleeNoSwerve === true);

  const dt = 1 / 60;
  let despawnT = null, maxExit = 0;
  for (let t = 0; t < 12; t += dt) {
    cs.update(dt, playerPos, 0, 0);               // player speed 0 → rel frozen
    if (cs.cops.includes(stalled)) {
      maxExit = Math.max(maxExit, stalled._fleeExit ?? 0);
    } else if (despawnT == null) despawnT = t;
  }
  // rel can't fall (player stopped), so the FLEE_MAX_SEC timer failsafe removes
  // it — never an immortal cop, and never the synthetic slide.
  check('stalled coal cop despawns via the FLEE_MAX_SEC timer failsafe', despawnT != null && despawnT <= 6.2);
  check('stalled coal cop never used the synthetic exit (_fleeExit stays 0)', maxExit === 0);
  // Exit-slide constants still exported + sane (used elsewhere by the renderer).
  check('exit constants sane (hold depth ahead of camera, span past rel 0)',
        FLEE_EXIT_HOLD_REL > 0 && FLEE_EXIT_HOLD_REL - FLEE_EXIT_SPAN < 0);
}

// ── GameScene guards: fleeing cops excluded from collision / ram ─────────
{
  const src = readFileSync(new URL('../src/scenes/GameScene.js', import.meta.url), 'utf8');
  check('GameScene collision loop skips fleeing cops', /if \(cop\.fleeing\) continue;/.test(src));
  check('GameScene renders the synthetic exit (depth clamp at FLEE_EXIT_HOLD_REL)',
        /Math\.max\(cop\.relativePos, FLEE_EXIT_HOLD_REL\)/.test(src));
  check('GameScene slides the exiting cruiser past the bottom edge (SCREEN_H push)',
        /proj\.sy \+ sink \* \(SCREEN_H/.test(src));
}

console.log(`coal.test: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
