// ── Rolling Coal ("coal" F12 weapon) — node CLI unit tests ────────────────
// Run: node tests/coal.test.mjs   (also `npm test`)
//
// SMOKE-OUT model (owner 2026-07-22, Option 1 — coal ENDS the chase): firing
// lays a world-anchored SMOKE CLOUD region behind the car (backZ = playerPos -
// COAL_CLOUD_BACK … frontZ = playerPos + COAL_CLOUD_FRONT) that lives
// COAL_CLOUD_LIFE seconds. A cop caught in the cloud (at fire, or by driving
// into it while it lives) BREAKS PURSUIT: the `_fleeNoSwerve` flee — keep pace
// briefly, then sink straight back into the smoke and despawn. Replaces the
// old 60 mph slow-cap, which kept the cop visibly chasing ("the first cop
// withstood the coal" at player speeds ≤60). Barricade rows + parked held-stop
// troopers are immune. Firing still clears any in-progress arrest and arms the
// 30 s spawn lull.

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

// ── Firing smoke-outs every cop in the cloud; outsiders untouched ─────────
{
  const cs = new CopSystem();
  cs.stars = 2;
  cs.addF12Token('coal');                       // grants 1 cloud
  const playerPos   = 100000;
  const playerSpeed = MAX_SPEED * 0.75;         // ~90 mph
  const rear      = pursuitCop(playerPos - 3000);   // in the cloud, behind
  const alongside = pursuitCop(playerPos + 800);    // in the +front slack band
  const farAhead  = pursuitCop(playerPos + 20000);  // way ahead, outside the cloud
  const trap      = pursuitCop(playerPos - 2500);   // civil-stop pursuer in the cloud
  trap.trapPursuit = true;
  cs.cops.push(rear, alongside, farAhead, trap);

  const res = cs.useF12Token('coal', playerPos);
  check('coal fire ok', res.ok === true);
  check('coal consumed a cloud', cs.coalAmmo === 0);
  check('rear pursuer in the cloud breaks pursuit (fleeing)', rear.fleeing === true);
  check('smoke-out uses the straight-back recede (_fleeNoSwerve)', rear._fleeNoSwerve === true);
  check('alongside rammer smoked too (front slack band)', alongside.fleeing === true);
  check('far-ahead cop untouched (outside the cloud)', !farAhead.fleeing);
  check('smoked trap pursuer sheds its trapPursuit tag', trap.fleeing === true && trap.trapPursuit === false);
  check('smoked cop disarmed (no PIT possible)', !rear._pitArmed && (rear._pitProgress ?? 0) === 0);
  check('arrest counters cleared on fire', cs.rearBumpCount === 0 && !cs.arrestPending);

  // A tick must not re-arm the flee timers for cops still inside the band.
  const tBefore = rear._fleeTimer;
  cs.update(1 / 60, playerPos, playerSpeed, 0);
  check('touch check does not re-arm an already-fleeing cop', rear._fleeTimer < tBefore + 1e-9);
}

// ── Coal caps at 3 (1 per pickup, same as every other weapon) ─────────────
{
  const capCs = new CopSystem();
  for (let i = 0; i < 6; i++) capCs.addF12Token('coal');   // way over cap
  check('coal 1 per pickup, caps at 3', capCs.coalAmmo === 3);
  check('coal canCarryMore false at cap', capCs.canCarryMore('coal') === false);
}

// ── The smoked cop recedes and despawns; the chase is OVER ─────────────────
// Player speed is a slow 55 mph — the case the old 60 mph cap failed on
// ("the first cop withstood the coal"): the smoke-out must shake the cop
// regardless of how slow the player is going.
{
  const cs = new CopSystem();
  cs.stars = 2;
  cs.addF12Token('coal');
  const playerSpeed = MAX_SPEED * (55 / 120);
  let pos = 100000;
  const rear = pursuitCop(pos - 2000);
  cs.cops.push(rear);
  cs.useF12Token('coal', pos);

  const dt = 1 / 60;
  let everGained = false, despawnT = null;
  let prevGap = pos - rear.position;
  for (let t = 0; t < 40; t += dt) {
    pos += playerSpeed * dt;
    cs.update(dt, pos, playerSpeed, 0);
    if (cs.cops.includes(rear)) {
      const gap = pos - rear.position;
      if (gap < prevGap - 1e-6) everGained = true;   // cop closed the gap
      prevGap = gap;
    } else if (despawnT == null) despawnT = t;
  }
  check('smoked cop never closes the gap — even on a slow player', !everGained);
  check('smoked cop recedes into the smoke and despawns', despawnT != null);
}

// ── Barricade rows are immune (not chasing by sight) ──────────────────────
{
  const cs = new CopSystem();
  cs.stars = 5;
  cs.addF12Token('coal');
  const playerPos = 50000;
  const block = { ...pursuitCop(playerPos + 500), kind: 'barricade', speed: 200, baseSpeed: 200 };
  cs.cops.push(block);
  cs.useF12Token('coal', playerPos);
  cs.update(1 / 60, playerPos, MAX_SPEED * 0.75, 0);
  check('barricade cop immune to smoke (does not flee)', !block.fleeing);
}

// ── The cloud expires (~5 s) — a cop arriving late is not smoked ──────────
{
  const cs = new CopSystem();
  cs.addF12Token('coal');
  const playerPos = 100000;
  cs.useF12Token('coal', playerPos);
  const dt = 1 / 60;
  for (let t = 0; t < 6; t += dt) cs.update(dt, playerPos, 0, 0);   // let the cloud age out
  const late = pursuitCop(playerPos - 3000);                        // now IN the region…
  cs.cops.push(late);
  cs.update(dt, playerPos, MAX_SPEED * 0.75, 0);
  check('expired cloud no longer smokes a late arrival', !late.fleeing);
}

// ── A live cloud DOES smoke a cop that drives into it (touch check) ───────
{
  const cs = new CopSystem();
  cs.addF12Token('coal');
  const playerPos = 100000;
  cs.useF12Token('coal', playerPos);                 // nobody around at fire
  const dt = 1 / 60;
  cs.update(dt, playerPos, 0, 0);                    // cloud alive (~5 s life)
  const arrival = pursuitCop(playerPos - 3000);      // drives into the smoke
  cs.cops.push(arrival);
  cs.update(dt, playerPos, MAX_SPEED * 0.75, 0);
  check('live cloud smokes a late arrival (touch)', arrival.fleeing === true && arrival._fleeNoSwerve === true);
}

// ── 30 s spawn suppression after firing ───────────────────────────────────
{
  const cs = new CopSystem();
  cs.stars     = 2;
  cs.starTimer = 999;                 // hold the wanted level through the lull
  cs.addF12Token('coal');
  const playerSpeed = MAX_SPEED * 0.75;
  let pos = 100000;
  cs.cops.push(pursuitCop(pos - 3000));

  cs.useF12Token('coal', pos);
  check('coal arms >= 30 s spawn cooldown', cs._spawnCooldown >= 30);
  check('coal lull timer armed (guards encounter/barricade spawns too)', (cs._coalLull ?? 0) >= 30);

  cs._spawnCooldown = 1;              // a later system tries to shorten it…
  const dt = 1 / 60;
  let firstSpawnT = null;
  const initial = new Set(cs.cops);
  for (let t = 0; t < 120; t += dt) {
    pos += playerSpeed * dt;
    cs.update(dt, pos, playerSpeed, 0);
    if (firstSpawnT == null && cs.cops.some(c => !initial.has(c))) firstSpawnT = t;
  }
  check('no new cop spawns during the 30 s lull', firstSpawnT == null || firstSpawnT >= 29.9);
  check('pursuit resumes after the lull (stars persisted)', firstSpawnT != null && firstSpawnT < 120);
}

// ── GameScene guards: the flee pipeline (used by fireworks/donuts) intact ──
{
  const src = readFileSync(new URL('../src/scenes/GameScene.js', import.meta.url), 'utf8');
  check('GameScene collision loop skips fleeing cops', /if \(cop\.fleeing\) continue;/.test(src));
  check('GameScene renders the synthetic exit (depth clamp at FLEE_EXIT_HOLD_REL)',
        /Math\.max\(cop\.relativePos, FLEE_EXIT_HOLD_REL\)/.test(src));
  check('GameScene slides the exiting cruiser past the bottom edge (SCREEN_H push)',
        /proj\.sy \+ sink \* \(SCREEN_H/.test(src));
  check('exit constants sane (hold depth ahead of camera, span past rel 0)',
        FLEE_EXIT_HOLD_REL > 0 && FLEE_EXIT_HOLD_REL - FLEE_EXIT_SPAN < 0);
}

console.log(`coal.test: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
