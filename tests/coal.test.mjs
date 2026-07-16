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
// only a 6 s lifetime failsafe.

import { CopSystem } from '../src/systems/CopSystem.js';
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

// ── GameScene guards: fleeing cops excluded from collision / ram ─────────
{
  const src = readFileSync(new URL('../src/scenes/GameScene.js', import.meta.url), 'utf8');
  check('GameScene collision loop skips fleeing cops', /if \(cop\.fleeing\) continue;/.test(src));
}

console.log(`coal.test: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
