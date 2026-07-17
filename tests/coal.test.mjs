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
// Recede is TIME-driven (owner 2026-07-16): a smoked cop HANGS ON near player
// speed (~0.88×, "trying to keep up") but the diesel smoke swallows it — over
// COAL_FADE_SEC (~1.8 s) its alpha fades to 0 (_fleeFade 1→0) AND it slides
// down past the bottom edge (_fleeExit 0→1), then despawns. This works even
// when the player holds a steady lead OR is fully stopped (rel never changes),
// so there is never a mid-screen blink-out.
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

  // Simulate up to 8 s of chase at fixed player speed — a smoked cop HANGS
  // ON near player speed (never EXCEEDS it, never gains), and despawns via the
  // ~1.8 s smoke fade with its alpha at ~0 and its bottom-edge slide complete.
  let pos = playerPos;
  let minGapRear = Infinity, everGained = false, everOverSpeed = false;
  let prevGap = pos - rear.position;
  // Last observed fade/exit on the rear cop before removal — verifies it faded
  // out (_fleeFade→0) and slid off the bottom (_fleeExit→1), not a mid pop.
  let lastFadeRear = 1, lastExitRear = 0;
  let despawnT = null;
  const dt = 1 / 60;
  for (let t = 0; t < 8; t += dt) {
    pos += playerSpeed * dt;
    cs.update(dt, pos, playerSpeed, 0);
    if (cs.cops.includes(rear)) {
      const gap = pos - rear.position;
      if (gap < prevGap - 1e-6) everGained = true;   // cop closed the gap
      if (rear.speed > playerSpeed + 1e-6) everOverSpeed = true;
      minGapRear = Math.min(minGapRear, gap);
      prevGap = gap;
      lastFadeRear = rear._fleeFade ?? lastFadeRear;
      lastExitRear = rear._fleeExit ?? lastExitRear;
    }
    if (despawnT == null && !cs.cops.includes(rear) && !cs.cops.includes(alongside)) despawnT = t;
  }
  check('smoked cop never gained on the player', !everGained);
  check('smoked cop never exceeds player speed (hangs on ~0.88x)', !everOverSpeed);
  check('smoked cop never reached the player (no ram possible)', minGapRear >= 2500);
  check('smoked cops eventually despawned', despawnT != null);
  check('smoked cops despawned via the ~1.8s smoke fade', despawnT != null && despawnT < 2.5);
  // Time-driven removal: just before despawn the cop had faded (alpha→0) and
  // slid down past the bottom edge (_fleeExit→1) — "lost in the black".
  check('smoked cop faded out before removal (_fleeFade→0)', lastFadeRear <= 0.05);
  check('smoked cop slid off the bottom before removal (_fleeExit→1)', lastExitRear >= 0.95);
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

// ── Time-driven fade despawns even a "stalled" coal cop (no blink-out) ─────
// Player fully stopped: rel never changes.  The old positional recede would
// never remove the cop; the new smoke fade is TIME-driven, so over ~1.8 s the
// cop fades (alpha→0) and slides down past the bottom edge (_fleeExit→1), then
// despawns — mid-screen but fully faded + slid off, so there is no pop.
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
  let despawnT = null, lastFade = 1, lastExit = 0;
  for (let t = 0; t < 12; t += dt) {
    cs.update(dt, playerPos, 0, 0);               // player speed 0 → rel frozen
    if (cs.cops.includes(stalled)) {
      lastFade = stalled._fleeFade ?? lastFade;
      lastExit = stalled._fleeExit ?? lastExit;
    } else if (despawnT == null) despawnT = t;
  }
  check('stalled coal cop despawns on the ~1.8s fade (rel frozen)', despawnT != null && despawnT < 2.5);
  check('faded out before removal (_fleeFade→0)', lastFade <= 0.05);
  check('slid off the bottom before removal (_fleeExit→1)', lastExit >= 0.95);
  // Exit-slide constants still exported + sane (used by the forward renderer).
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
