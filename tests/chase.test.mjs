// ── Police chase discipline — node CLI unit tests ─────────────────────────
// Run: node tests/chase.test.mjs   (also `npm test`)
//
// Covers the anti-pass rules from the police-chase spec (owner 2026-07-28):
// a pursuer may only get IN FRONT of the player at 4-5 stars.  Below that two
// guards enforce it — a speed ceiling scaled to the player, and a hard
// positional clamp applied after integration.
//
// The clamp is the one that matters.  A speed ceiling alone still lets a cop
// drift past whenever the player brakes harder than the cop can decelerate,
// which is the owner's exact repro: brake hard for a corner at 3 stars and a
// cruiser overruns you.  The headline case below reproduces that directly.

import { CopSystem } from '../src/systems/CopSystem.js';
import { MAX_SPEED, PLAYER_VIRTUAL_Z } from '../src/constants.js';

// Divert rolls and spawn placement use Math.random(), so probabilistic tests
// pin it rather than flaking ~10% of runs.  withRandom(v, fn) forces every
// roll inside `fn` to return v.
const _realRandom = Math.random;
function withRandom(v, fn) {
  Math.random = () => v;
  try { return fn(); } finally { Math.random = _realRandom; }
}

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

/** Run the sim and report the worst (largest) cop-minus-player depth seen. */
function runChase({ stars, playerSpeed, seconds = 2, copOffsets = [-4000, -1500, -600] }) {
  const cs = new CopSystem();
  cs.stars = stars;
  let playerPos = 100000;
  cs.cops = copOffsets.map(o => pursuitCop(playerPos + PLAYER_VIRTUAL_Z + o));

  const dt = 1 / 60;
  let worst = -Infinity;
  for (let t = 0; t < seconds; t += dt) {
    cs.update(dt, playerPos, playerSpeed, 0);
    playerPos += playerSpeed * dt;
    const carZ = playerPos + PLAYER_VIRTUAL_Z;
    for (const c of cs.cops) worst = Math.max(worst, c.position - carZ);
  }
  return { worst, cops: cs.cops };
}

// ── THE REPRO: 3 stars, player crawling at 20 mph for two seconds ─────────
// Cops start at full speed and the player is barely moving, so without the
// positional clamp every unit sails straight past.
{
  const slow = MAX_SPEED * (20 / 120);          // 20 mph in world units
  const { worst } = runChase({ stars: 3, playerSpeed: slow, seconds: 2 });
  check('3 stars, player at 20 mph — no cop ever exceeds the player depth', worst <= 0);
}

// Same at 1 and 2 stars.
for (const s of [1, 2]) {
  const slow = MAX_SPEED * (20 / 120);
  const { worst } = runChase({ stars: s, playerSpeed: slow, seconds: 2 });
  check(`${s} star(s), player at 20 mph — no cop gets in front`, worst <= 0);
}

// ── Hard braking from speed: the corner case ─────────────────────────────
// Player drops from full speed to a crawl mid-run; the clamp has to catch the
// overrun that the speed ceiling alone cannot.
{
  const cs = new CopSystem();
  cs.stars = 3;
  let playerPos = 100000;
  cs.cops = [-2000, -900].map(o => pursuitCop(playerPos + PLAYER_VIRTUAL_Z + o));
  const dt = 1 / 60;
  let worst = -Infinity;
  for (let t = 0; t < 3; t += dt) {
    const spd = t < 1 ? MAX_SPEED : MAX_SPEED * 0.08;   // slam the brakes at t=1s
    cs.update(dt, playerPos, spd, 0);
    playerPos += spd * dt;
    const carZ = playerPos + PLAYER_VIRTUAL_Z;
    for (const c of cs.cops) worst = Math.max(worst, c.position - carZ);
  }
  check('3 stars, hard brake from full speed — clamp catches the overrun', worst <= 0);
}

// ── 4-5 stars: leading is ALLOWED, so the guards must not fire ───────────
// Asserting "a cop actually overtakes" would be testing the OVERTAKE
// behaviour, which doesn't exist yet (tokens are a later pass).  What's
// testable now is that a unit already in front is left alone at 4-5 stars —
// neither clamped back nor demoted, which is exactly what the guards do
// below 4.
// NOTE the mid-band star values (4.5 / 5.0).  `stars` is a decaying float and
// the AI gates on Math.floor(stars) to match the HUD, so setting exactly 4.0
// would drop to tier 3 within one frame of decay — which is a property of the
// star system, not of the guards.
{
  for (const s of [4.5, 5]) {
    const cs = new CopSystem();
    cs.stars = s;
    let playerPos = 100000;
    const cop = pursuitCop(playerPos + PLAYER_VIRTUAL_Z + 2500);
    cs.cops = [cop];
    const dt = 1 / 60, spd = MAX_SPEED * 0.5;
    for (let t = 0; t < 1; t += dt) {
      cs.update(dt, playerPos, spd, 0);
      playerPos += spd * dt;
    }
    const rel = cop.position - (playerPos + PLAYER_VIRTUAL_Z);
    check(`${Math.floor(s)} stars — a cop in front is not clamped back`, rel > 0 && !cop._demoting);
  }
}

// ── PIT is unreachable below 4 stars ─────────────────────────────────────
{
  const cs = new CopSystem();
  cs.stars = 3;
  const playerPos = 100000;
  const cop = pursuitCop(playerPos + PLAYER_VIRTUAL_Z - 300);
  cop.laneOffset = 0;
  cs.cops = [cop];
  let pp = playerPos;
  const dt3 = 1 / 60, sp3 = MAX_SPEED * 0.5;
  for (let t = 0; t < 2; t += dt3) {
    cs.update(dt3, pp, sp3, 0);
    pp += sp3 * dt3;                 // advance the player, or the cop runs off
    cop.position = pp + PLAYER_VIRTUAL_Z - 300;   // hold it alongside
  }
  check('3 stars — PIT never arms', !cop._pitArmed);
}
{
  const cs = new CopSystem();
  cs.stars = 5;
  const playerPos = 100000;
  const cop = pursuitCop(playerPos + PLAYER_VIRTUAL_Z - 300);
  cop.laneOffset = 0;
  cs.cops = [cop];
  let pp5 = playerPos;
  const dt5 = 1 / 60, sp5 = MAX_SPEED * 0.5;
  for (let t = 0; t < 2; t += dt5) {
    cs.update(dt5, pp5, sp5, 0);
    pp5 += sp5 * dt5;
    cop.position = pp5 + PLAYER_VIRTUAL_Z - 300;
  }
  check('5 stars — PIT still arms', !!cop._pitArmed);
}

// ── Demotion: a cop already in front must NOT be teleported behind ────────
// Drop from 5 stars to 3 with a unit 3000 units ahead; it has to fall back
// under its own braking, so its depth may only decrease gradually.
{
  const cs = new CopSystem();
  cs.stars = 5;
  let playerPos = 100000;
  const cop = pursuitCop(playerPos + PLAYER_VIRTUAL_Z + 3000);
  cs.cops = [cop];
  const dt = 1 / 60;
  const spd = MAX_SPEED * 0.5;
  cs.update(dt, playerPos, spd, 0);
  playerPos += spd * dt;

  cs.stars = 3;                                   // demotion happens here
  const before = cop.position - (playerPos + PLAYER_VIRTUAL_Z);
  cs.update(dt, playerPos, spd, 0);
  playerPos += spd * dt;
  const after = cop.position - (playerPos + PLAYER_VIRTUAL_Z);

  check('demotion — cop is not snapped behind the player in one frame',
        after > 0 && (before - after) < 1000);
  check('demotion — cop is losing ground to the player', after < before);

  // …and it does eventually end up behind, without ever jumping.
  let maxJump = 0, prev = after;
  for (let t = 0; t < 6; t += dt) {
    cs.update(dt, playerPos, spd, 0);
    playerPos += spd * dt;
    const rel = cop.position - (playerPos + PLAYER_VIRTUAL_Z);
    maxJump = Math.max(maxJump, Math.abs(prev - rel));
    prev = rel;
  }
  check('demotion — cop ends up behind the player', prev < 0);
  check('demotion — never teleports (no single-frame jump > 1000 units)', maxJump < 1000);
}


// ═══ PASS 2 — deployables as world-space entities ═══════════════════════

// A donut must reach a cop that is IN FRONT of the player.  This is the whole
// bug: the old band filter (rel < 3000) could never see a blocker.
{
  const cs = new CopSystem();
  cs.stars = 5;                                  // blockers only exist at 4-5
  const playerPos = 100000;
  const blocker = pursuitCop(playerPos + PLAYER_VIRTUAL_Z + 8000);  // 8 CL AHEAD
  cs.cops = [blocker];
  cs.addF12Token('paint_bomb');
  cs.useF12Token('paint_bomb', playerPos);
  // Divert chance at 5 stars is 0.3, so drive several frames and allow the roll.
  let diverted = false;
  for (let t = 0; t < 2 && !diverted; t += 1 / 60) {
    cs.update(1 / 60, playerPos, MAX_SPEED * 0.5, 0);
    diverted = !!blocker.fleeing;
  }
  check('donut reaches a cop IN FRONT of the player', cs.deployables.donuts.length > 0);
  // Geometry, not drift: the box must SEE a unit sitting 8 CL in front.  The
  // old band filter (rel < 3000) could not, which is the reported bug.
  check('a blocking cop is a legal donut target (radius, not band)',
        !!cs.deployables.donutNear(playerPos + PLAYER_VIRTUAL_Z + 8000));
}

// Donut immunity stops a stack of boxes chain-disabling one unit.
{
  const cs = new CopSystem();
  cs.stars = 1;                                   // 0.9 divert chance
  const playerPos = 100000;
  const cop = pursuitCop(playerPos + PLAYER_VIRTUAL_Z - 2000);
  cs.cops = [cop];
  cs.addF12Token('paint_bomb');
  withRandom(0, () => {                       // 0 < 0.9 => always diverts
    cs.useF12Token('paint_bomb', playerPos);
    for (let t = 0; t < 0.5; t += 1 / 60) cs.update(1 / 60, playerPos, MAX_SPEED * 0.3, 0);
  });
  check('donut divert sets a per-unit immunity window', (cop._donutImmune ?? 0) > 0);
}

// Coal lays a puff trail rather than one rigid box.
{
  const cs = new CopSystem();
  cs.stars = 2;
  const playerPos = 100000;
  cs.cops = [];
  cs.addF12Token('coal');
  cs.useF12Token('coal', playerPos);
  let pp = playerPos;
  for (let t = 0; t < 0.5; t += 1 / 60) { cs.update(1 / 60, pp, MAX_SPEED * 0.5, 0); pp += MAX_SPEED * 0.5 / 60; }
  check('coal emits a trail of puff colliders', cs.deployables.puffs.length > 1);
}

// ═══ PASS 3 — tokens, reinforcements, forward counter ═══════════════════

// No tokens below 4 stars — that is what makes the guards absolute.
{
  const cs = new CopSystem();
  cs.stars = 3;
  const playerPos = 100000;
  cs.cops = [pursuitCop(playerPos + PLAYER_VIRTUAL_Z - 3000)];
  for (let t = 0; t < 2; t += 1 / 60) cs.update(1 / 60, playerPos, MAX_SPEED * 0.5, 0);
  check('3 stars — no overtake token is ever granted', !cs.cops.some(c => c._overtakeToken));
}

// At 5 stars a close unit can get one, and the pool is respected.
{
  const cs = new CopSystem();
  cs.stars = 5;
  let pp = 100000;
  cs.cops = [-3000, -5000, -7000].map(o => pursuitCop(pp + PLAYER_VIRTUAL_Z + o));
  const before = cs.cops.length;
  // 16 s, not 3: `stars` decays to 4.9998 on the first frame, so Math.floor
  // puts us in tier 4 whose onramp interval is 14 s.  A 3 s window never
  // reaches the first merge.
  withRandom(0.5, () => {
    for (let t = 0; t < 16; t += 1 / 60) { cs.update(1 / 60, pp, MAX_SPEED * 0.5, 0); pp += MAX_SPEED * 0.5 / 60; }
  });
  const held = cs.cops.filter(c => c._overtakeToken).length;
  check('5 stars — at least one overtake token is granted', held >= 1);
  check('5 stars — never more tokens out than the pool (2)', held <= 2);
  check('5 stars — onramp reinforcements merge in ahead',
        cs.cops.length > before && cs.cops.some(c => c._fromOnramp));
}

// Forward counter: 1.2s of throttle on a blocker's bumper spins it out.
{
  const cs = new CopSystem();
  cs.stars = 5;
  const playerPos = 100000;
  const blocker = pursuitCop(playerPos + PLAYER_VIRTUAL_Z + 900);   // on the bumper
  cs.cops = [blocker];
  let res = { spun: null, hp: 0 };
  for (let t = 0; t < 1.5; t += 1 / 60) {
    blocker.position = playerPos + PLAYER_VIRTUAL_Z + 900;          // hold contact
    const r = cs.tickPushThrough(1 / 60, playerPos, MAX_SPEED, true);
    if (r.spun) res = r;
  }
  check('forward counter spins out a blocker after ~1.2s', !!res.spun);
  check('forward counter costs the player HP', res.hp > 0);
}

// …and it does nothing below 4 stars, or without the throttle.
{
  const cs = new CopSystem();
  cs.stars = 3;
  const playerPos = 100000;
  const cop = pursuitCop(playerPos + PLAYER_VIRTUAL_Z + 900);
  cs.cops = [cop];
  let spun = null;
  for (let t = 0; t < 2; t += 1 / 60) {
    cop.position = playerPos + PLAYER_VIRTUAL_Z + 900;
    const r = cs.tickPushThrough(1 / 60, playerPos, MAX_SPEED, true);
    if (r.spun) spun = r.spun;
  }
  check('3 stars — forward counter is unavailable', !spun);
}
{
  const cs = new CopSystem();
  cs.stars = 5;
  const playerPos = 100000;
  const cop = pursuitCop(playerPos + PLAYER_VIRTUAL_Z + 900);
  cs.cops = [cop];
  let spun = null;
  for (let t = 0; t < 2; t += 1 / 60) {
    cop.position = playerPos + PLAYER_VIRTUAL_Z + 900;
    const r = cs.tickPushThrough(1 / 60, playerPos, MAX_SPEED, false);  // no throttle
    if (r.spun) spun = r.spun;
  }
  check('no throttle — forward counter does not fire', !spun);
}

// ═══ Wanted-level display latch ═════════════════════════════════════════
// Owner report 2026-07-29: "custom game with two police stars, half a mile in
// I'm down to one".  Cause was Math.floor over a continuously decaying float —
// 2.0 becomes 1.9997 in one frame, so the HUD dropped instantly.
{
  const cs = new CopSystem();
  cs.stars = 2;
  check('2 stars shows 2 immediately', cs.starDisplay === 2);

  let pp = 100000;
  const spd = MAX_SPEED * (60 / 120);          // 60 mph
  for (let t = 0; t < 12; t += 1 / 60) { cs.update(1 / 60, pp, spd, 0); pp += spd / 60; }
  check('still 2 stars after half a mile', cs.starDisplay === 2);

  for (let t = 12; t < 59; t += 1 / 60) { cs.update(1 / 60, pp, spd, 0); pp += spd / 60; }
  check('still 2 stars just short of a full star of decay', cs.starDisplay === 2);

  for (let t = 59; t < 62; t += 1 / 60) { cs.update(1 / 60, pp, spd, 0); pp += spd / 60; }
  check('drops to 1 only after a WHOLE star has decayed', cs.starDisplay === 1);
}

// The original bug the floor was introduced to fix must stay fixed: a partial
// heat tick above a level must NOT show a star that hasn't been earned.
{
  const cs = new CopSystem();
  cs.stars = 1;
  check('1.0 stars shows 1', cs.starDisplay === 1);
  cs.stars = 1.4;                                 // partial heat toward 2
  check('partial heat does not show an unearned star', cs.starDisplay === 1);
  cs.stars = 2.0;
  check('a fully earned star does show', cs.starDisplay === 2);
}

console.log(`\nchase.test: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
