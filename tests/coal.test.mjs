// ── Rolling Coal ("coal" F12 weapon) — node CLI unit tests ────────────────
// Run: node tests/coal.test.mjs   (also `npm test`)
//
// TOUCH model (owner 2026-07-17): firing rolling coal no longer instantly
// affects anyone. It lays down a world-anchored SMOKE CLOUD region behind the
// car (backZ = playerPos - COAL_CLOUD_BACK … frontZ = playerPos + COAL_CLOUD_FRONT)
// that lives COAL_CLOUD_LIFE seconds. A cop is only affected once it DRIVES
// INTO the cloud, at which point its top speed is capped at 60 mph
// (COAL_SLOW_UNITS) for 30 s (COAL_SLOW_SEC) — it keeps chasing, just slow, so
// the player pulls away. Barricade rows (not chasing by sight) are immune.
// Firing still clears any in-progress arrest and arms the 30 s spawn lull.

import { CopSystem, FLEE_EXIT_HOLD_REL, FLEE_EXIT_SPAN } from '../src/systems/CopSystem.js';
import { MAX_SPEED } from '../src/constants.js';
import { readFileSync } from 'node:fs';

const COAL_SLOW_UNITS = MAX_SPEED * (60 / 120);   // 60 mph cap (mirrors CopSystem)

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

// ── Firing lays a cloud; only cops that TOUCH it get slowed ───────────────
{
  const cs = new CopSystem();
  cs.stars = 2;
  cs.addF12Token('coal');                       // grants 1 cloud
  const playerPos   = 100000;
  const playerSpeed = MAX_SPEED * 0.75;         // ~90 mph
  const rear      = pursuitCop(playerPos - 3000);   // in the cloud, behind
  const alongside = pursuitCop(playerPos + 800);    // in the +front slack band
  const farAhead  = pursuitCop(playerPos + 20000);  // way ahead, outside the cloud
  cs.cops.push(rear, alongside, farAhead);

  const res = cs.useF12Token('coal', playerPos);
  check('coal fire ok', res.ok === true);
  check('coal consumed a cloud', cs.coalAmmo === 0);
  check('coal does NOT instantly flee cops (hangs a cloud)', !rear.fleeing && !alongside.fleeing);
  check('arrest counters cleared on fire', cs.rearBumpCount === 0 && !cs.arrestPending);

  // One tick: cops inside the cloud region pick up the slow; far-ahead doesn't.
  cs.update(1 / 60, playerPos, playerSpeed, 0);
  check('rear pursuer touched the cloud (slowed)', (rear.coalSlowT ?? 0) > 0);
  check('alongside rammer touched too (front slack band)', (alongside.coalSlowT ?? 0) > 0);
  check('far-ahead cop untouched (outside the cloud)', !(farAhead.coalSlowT > 0));
  check('slowed cop capped at 60 mph', rear.speed <= COAL_SLOW_UNITS + 1e-6);
  check('untouched cop is NOT speed-capped', farAhead.speed > COAL_SLOW_UNITS);
}

// ── Coal caps at 3 (1 per pickup, same as every other weapon) ─────────────
{
  const capCs = new CopSystem();
  for (let i = 0; i < 6; i++) capCs.addF12Token('coal');   // way over cap
  check('coal 1 per pickup, caps at 3', capCs.coalAmmo === 3);
  check('coal canCarryMore false at cap', capCs.canCarryMore('coal') === false);
}

// ── The slow holds ~30 s and the player pulls away (no ram possible) ───────
{
  const cs = new CopSystem();
  cs.stars = 2;
  cs.addF12Token('coal');
  const playerSpeed = MAX_SPEED * 0.75;
  let pos = 100000;
  const rear = pursuitCop(pos - 2000);
  cs.cops.push(rear);
  cs.useF12Token('coal', pos);

  const dt = 1 / 60;
  let everOverCapWhileSlowed = false, everGained = false, despawnT = null;
  let prevGap = pos - rear.position;
  for (let t = 0; t < 40; t += dt) {
    pos += playerSpeed * dt;
    cs.update(dt, pos, playerSpeed, 0);
    if (cs.cops.includes(rear)) {
      if ((rear.coalSlowT ?? 0) > 0 && rear.speed > COAL_SLOW_UNITS + 1e-6) everOverCapWhileSlowed = true;
      const gap = pos - rear.position;
      if (gap < prevGap - 1e-6) everGained = true;   // cop closed the gap
      prevGap = gap;
    } else if (despawnT == null) despawnT = t;
  }
  check('slowed cop never exceeds 60 mph while the timer runs', !everOverCapWhileSlowed);
  check('player pulls away — cop never closes the gap', !everGained);
  check('slowed cop falls back and despawns', despawnT != null);
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
  check('barricade cop immune to smoke (not slowed)', !(block.coalSlowT > 0));
}

// ── The cloud expires (~5 s) — a cop arriving late is not slowed ──────────
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
  check('expired cloud no longer slows a late arrival', !(late.coalSlowT > 0));
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
