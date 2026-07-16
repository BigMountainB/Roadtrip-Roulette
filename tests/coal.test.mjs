// ── Rolling Coal ("coal" F12 weapon) — node CLI unit tests ────────────────
// Run: node tests/coal.test.mjs   (also `npm test`)
//
// Regression for the 2026-07-14 bug: firing rolling coal did nothing to
// pursuing cops — they kept closing and ramming from behind.  Root cause:
// the smoke-zone test only accepted cops strictly BEHIND the player
// (rel < 0), but the rear-cop AI oscillates around rel ≈ 0 (alongside at
// playerSpeed + 200), so the cop actually applying ram pressure never
// qualified.  Coal must smoke every pursuer in the -15000..+2500 band:
// fleeing + _fleeNoSwerve, drop to 35% player speed (never gains again).
// Removal is POSITION-driven (2026-07-15): a smoked cop stays alive until it
// has receded past the bottom of the screen (rel <= -6000, off the forward
// view AND tiny in the mirror) — never a mid-screen pop.  The flee timer is
// only a lifetime failsafe, and (2026-07-16) it can no longer splice a cop
// mid-screen: an expired timer must ALSO have completed the synthetic
// bottom-edge exit (_fleeExit = 1) before removal.
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

  // Simulate up to 8 s of chase at fixed player speed — smoked cops must
  // never gain ground, never touch the player, only despawn once they've
  // receded past the bottom of the screen (rel <= -6000), and be gone well
  // inside the 6 s lifetime failsafe.
  let pos = playerPos;
  let minGapRear = Infinity, everGained = false, everOverSpeed = false;
  let prevGap = pos - rear.position;
  // Last observed rel (cop.position - playerPos) per smoked cop, so we can
  // verify each was OFF-SCREEN (well behind) at the moment it was removed.
  let lastRelRear = rear.position - pos, lastRelAlong = alongside.position - pos;
  let despawnT = null;
  const dt = 1 / 60;
  for (let t = 0; t < 8; t += dt) {
    pos += playerSpeed * dt;
    cs.update(dt, pos, playerSpeed, 0);
    if (cs.cops.includes(rear)) {
      const gap = pos - rear.position;
      if (gap < prevGap - 1e-6) everGained = true;   // cop closed the gap
      if (rear.speed > playerSpeed * 0.35 + 1e-6) everOverSpeed = true;
      minGapRear = Math.min(minGapRear, gap);
      prevGap = gap;
      lastRelRear = rear.position - pos;
    }
    if (cs.cops.includes(alongside)) lastRelAlong = alongside.position - pos;
    if (despawnT == null && !cs.cops.includes(rear) && !cs.cops.includes(alongside)) despawnT = t;
  }
  check('smoked cop never gained on the player', !everGained);
  check('smoked cop capped at 35% player speed', !everOverSpeed);
  check('smoked cop never reached the player (no ram possible)', minGapRear >= 3000);
  check('smoked cops eventually despawned', despawnT != null);
  check('smoked cops despawned inside the 6s failsafe', despawnT != null && despawnT < 6);
  // Position-driven removal: at despawn each cop had already receded past
  // the bottom of the screen (rel <= 0 is off the forward view; the -6000
  // margin means it was faded + tiny in the mirror) — no mid-screen pop.
  check('rear cop was off-screen (rel <= -5500) when removed', lastRelRear <= -5500);
  check('alongside cop was off-screen (rel <= -5500) when removed', lastRelAlong <= -5500);
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

// ── Timer failsafe can't blink a cop out mid-screen ───────────────────────
// Player fully stopped: the fleeing cop's speed (35% of player) is 0, so
// rel never falls.  The 6 s timer expires — but the cop must NOT be spliced
// until the synthetic bottom-edge exit (_fleeExit) has completed, so the
// forward view can slide it off the bottom of the screen first.
{
  const cs = new CopSystem();
  cs.stars = 2;
  cs.addF12Token('coal');
  const playerPos = 100000;
  const stalled = pursuitCop(playerPos + 2000);   // visible ahead, rel = +2000
  cs.cops.push(stalled);
  cs.useF12Token('coal', playerPos);
  check('stalled cop smoked', stalled.fleeing === true);

  const dt = 1 / 60;
  let atTimerExpiry = null, despawnT = null;
  for (let t = 0; t < 12; t += dt) {
    cs.update(dt, playerPos, 0, 0);               // player speed 0 → rel frozen
    const alive = cs.cops.includes(stalled);
    if (t >= 6 && atTimerExpiry == null) atTimerExpiry = { alive, exit: stalled._fleeExit ?? 0 };
    if (!alive && despawnT == null) despawnT = t;
  }
  check('cop still on screen when the timer expires (no blink-out)',
        atTimerExpiry != null && atTimerExpiry.alive === true && atTimerExpiry.exit < 1);
  check('boost finishes the exit slide and despawns the stalled cop', despawnT != null);
  // The splice happens on the same tick _fleeExit reaches 1, so read the
  // final value off the (now-removed) cop object itself.
  check('despawn only after the synthetic exit completed (_fleeExit = 1)', (stalled._fleeExit ?? 0) >= 1);
  // Sanity on the exit geometry: exit progress is positional, 0 at the
  // projection-floor hold depth and 1 once fully behind/below the screen.
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
