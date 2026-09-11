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
    // REAR pursuers only — the anti-pass guards govern exactly that kind.
    // update() star-spawns at 3★ have a 45% roll for an ONCOMING cop, which
    // is ahead BY DESIGN (guard-exempt); sweeping it into `worst` made this
    // fail on spawn luck (~45% flake, pre-existing — surfaced 2026-08-03).
    for (const c of cs.cops) {
      if (c.kind !== 'rear') continue;
      worst = Math.max(worst, c.position - carZ);
    }
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
    // Rear pursuers only — see the same filter in runChase (oncoming
    // star-spawns are guard-exempt and ahead by design).
    for (const c of cs.cops) {
      if (c.kind !== 'rear') continue;
      worst = Math.max(worst, c.position - carZ);
    }
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

// ── PIT is unreachable at 1 star ─────────────────────────────────────────
// (Chase-realism pass, owner 2026-08-01: gate moved 4★ → 2★.  The 1★ tail
// never arms one; the 2★ boundary itself is covered at the bottom of the
// file alongside the other realism-pass checks.)
{
  const cs = new CopSystem();
  cs.stars = 1;
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
  check('1 star — PIT never arms', !cop._pitArmed);
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
  // Barricades held off: eyes-on decay pause (chase-realism pass) keeps
  // stars pinned at exactly 5.0, so the >= 5 barricade gate now FIRES in
  // this sim — and its 8-12 parked units would eat the pursuit cap and
  // block the onramp merge this test is about.
  cs._barricadeCooldown = 999;
  // 16 s, not 3: `stars` decays to 4.9998 on the first frame, so Math.floor
  // puts us in tier 4 whose onramp interval is 14 s.  A 3 s window never
  // reaches the first merge.
  // Measure token holds ACROSS the sim, not just the final frame — holds
  // expire after 15 s, so an end-state check at t=16 was one lane-timing
  // shift away from reading 0 while grants worked perfectly (bit by the
  // 2026-08-03 formation-lanes change).  Max-over-time is also the STRONGER
  // form of the pool check: the pool must never be exceeded on ANY frame.
  let maxHeld = 0;
  withRandom(0.5, () => {
    for (let t = 0; t < 16; t += 1 / 60) {
      cs.update(1 / 60, pp, MAX_SPEED * 0.5, 0); pp += MAX_SPEED * 0.5 / 60;
      const held = cs.cops.filter(c => c._overtakeToken).length;
      if (held > maxHeld) maxHeld = held;
    }
  });
  check('5 stars — at least one overtake token is granted', maxHeld >= 1);
  check('5 stars — never more tokens out than the pool (2)', maxHeld <= 2);
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
  // Decay only runs with NO pursuer in eyes-on range (chase-realism pass),
  // so this sim models a player who has already shaken the tail: strip any
  // cop update() spawns after each frame, keeping eyes-on false throughout.
  const step = () => { cs.update(1 / 60, pp, spd, 0); cs.cops.length = 0; pp += spd / 60; };
  for (let t = 0; t < 12; t += 1 / 60) step();
  check('still 2 stars after half a mile', cs.starDisplay === 2);

  for (let t = 12; t < 59; t += 1 / 60) step();
  check('still 2 stars just short of a full star of decay', cs.starDisplay === 2);

  for (let t = 59; t < 62; t += 1 / 60) step();
  check('drops to 1 only after a WHOLE star has decayed', cs.starDisplay === 1);
}

// ═══ Chase-realism pass (owner 2026-08-01) ══════════════════════════════
// 1★ is a tail: the cruiser holds station and never strikes.
{
  const cs = new CopSystem();
  cs.stars = 1;
  let pp = 100000;
  const spd = MAX_SPEED * (60 / 120);
  cs.cops = [pursuitCop(pp + PLAYER_VIRTUAL_Z - 1200)];
  let struck = false;
  for (let t = 0; t < 30; t += 1 / 60) {
    cs.update(1 / 60, pp, spd, 0);
    pp += spd / 60;
    if (cs.cops.some(c => c._lungeT > 0)) struck = true;
  }
  check('1 star — the tail NEVER lunges', !struck);
  check('1 star — the tail is still on station (not despawned)', cs.cops.length >= 1);
}

// …and at 2★ the same setup strikes on the ~15 s follow cadence
// (owner 2026-08-27: a 2★ tail rams every 15 seconds while it follows).
{
  const cs = new CopSystem();
  cs.stars = 2;
  let pp = 100000;
  const spd = MAX_SPEED * (60 / 120);
  cs.cops = [pursuitCop(pp + PLAYER_VIRTUAL_Z - 1200)];
  let firstStrikeAt = null;
  for (let t = 0; t < 25; t += 1 / 60) {
    cs.update(1 / 60, pp, spd, 0);
    pp += spd / 60;
    if (firstStrikeAt == null && cs.cops.some(c => c._lungeT > 0)) firstStrikeAt = t;
  }
  check('2 stars — a strike lands', firstStrikeAt != null);
  check('2 stars — but only after the ~15 s follow cadence',
        firstStrikeAt == null || firstStrikeAt >= 13);
}

// One striker at a time: two cops on station never lunge simultaneously.
{
  const cs = new CopSystem();
  cs.stars = 3;
  let pp = 100000;
  const spd = MAX_SPEED * (60 / 120);
  cs.cops = [pursuitCop(pp + PLAYER_VIRTUAL_Z - 1200, 0.3),
             pursuitCop(pp + PLAYER_VIRTUAL_Z - 1400, 0.6)];
  let maxSimultaneous = 0;
  for (let t = 0; t < 30; t += 1 / 60) {
    cs.update(1 / 60, pp, spd, 0);
    pp += spd / 60;
    maxSimultaneous = Math.max(maxSimultaneous,
      cs.cops.filter(c => c._lungeT > 0).length);
  }
  check('3 stars, two units — strikes happen', maxSimultaneous >= 1);
  check('3 stars, two units — never more than ONE striker at a time', maxSimultaneous <= 1);
}

// Backup call: witnessed 90+ mph at 1★ escalates to 2★ once, with cooldown.
{
  const cs = new CopSystem();
  cs.stars = 1;
  let pp = 100000;
  const fast = MAX_SPEED * (100 / 120);          // 100 mph — erratic
  cs.cops = [pursuitCop(pp + PLAYER_VIRTUAL_Z - 1200)];
  for (let t = 0; t < 4; t += 1 / 60) {
    cs.update(1 / 60, pp, fast, 0);
    pp += fast / 60;
    // keep the witness pinned on station so eyes-on stays true
    cs.cops[0].position = pp + PLAYER_VIRTUAL_Z - 1200;
  }
  check('backup call — witnessed 90+ mph escalates 1★ → 2★', cs.starDisplay === 2);
  check('backup call — reason surfaced for the HUD beat', !!cs.backupCalled);
  check('backup call — cooldown armed (no instant re-escalation)', cs._backupCd > 0);
}

// …but NOT without a witness: same speed, no cop in eyes-on range.
{
  const cs = new CopSystem();
  cs.stars = 1;
  let pp = 100000;
  const fast = MAX_SPEED * (100 / 120);
  for (let t = 0; t < 4; t += 1 / 60) {
    cs.update(1 / 60, pp, fast, 0);
    cs.cops.length = 0;                          // nobody ever gets eyes on
    pp += fast / 60;
  }
  check('no witness — 90+ mph alone never escalates', cs.starDisplay === 1);
}

// …and backup calls cap at 3★ (weapons stay the only path to 4-5★).
{
  const cs = new CopSystem();
  cs.stars = 3;
  let pp = 100000;
  const fast = MAX_SPEED * (100 / 120);
  cs.cops = [pursuitCop(pp + PLAYER_VIRTUAL_Z - 1200)];
  for (let t = 0; t < 4; t += 1 / 60) {
    cs.update(1 / 60, pp, fast, 0);
    pp += fast / 60;
    cs.cops[0].position = pp + PLAYER_VIRTUAL_Z - 1200;
  }
  check('backup calls cap at 3★', cs.starDisplay === 3);
}

// Witnessed civilian collision = instant backup call.
{
  const cs = new CopSystem();
  cs.stars = 1;
  const pp = 100000;
  cs.cops = [pursuitCop(pp + PLAYER_VIRTUAL_Z - 1200)];
  cs.update(1 / 60, pp, MAX_SPEED * 0.5, 0);     // establishes eyes-on
  cs.reportErraticCollision();
  check('witnessed collision — instant +1★', cs.starDisplay === 2);
  cs.reportErraticCollision();                   // inside the cooldown
  check('second collision inside cooldown does not stack', cs.starDisplay === 2);
}

// ── Reaction lag (owner 2026-08-04) ─────────────────────────────────────
// "I can speed up or slow down and the cops don't lose or gain 1 ft."  A
// pursuer answers the throttle 1.5-4 s late, so the gap MUST move.
{
  const cs = new CopSystem();
  cs.stars = 1;                                   // a tail: no lunges to muddy it
  let pp = 100000;
  const cruise = MAX_SPEED * (60 / 120);
  const cop = pursuitCop(pp + PLAYER_VIRTUAL_Z - 1200);
  cop._reactSec = 3;                              // pin the lag; no RNG flake
  cs.cops = [cop];
  const gap = () => (pp + PLAYER_VIRTUAL_Z) - cop.position;
  // Settle on station at a steady 60 mph.
  for (let t = 0; t < 8; t += 1 / 60) { cs.update(1 / 60, pp, cruise, 0); pp += cruise / 60; }
  const settled = gap();
  // Now floor it — for the lag window the cop is still driving 60.
  const fast = MAX_SPEED * (110 / 120);
  for (let t = 0; t < 1.5; t += 1 / 60) { cs.update(1 / 60, pp, fast, 0); pp += fast / 60; }
  const opened = gap();
  check('reaction lag — flooring it OPENS the gap', opened > settled + 500);

  // …and braking lets the stale-fast cruiser surge back in.
  const slow = MAX_SPEED * (25 / 120);
  for (let t = 0; t < 1.5; t += 1 / 60) { cs.update(1 / 60, pp, slow, 0); pp += slow / 60; }
  check('reaction lag — braking lets it close back in', gap() < opened);
  check('reaction lag — but it still never passes the player', gap() >= 0);
}

// The lag is per-unit, so a pack doesn't react in lockstep.
{
  const cs = new CopSystem();
  cs.stars = 3;
  const pp = 100000;
  cs.cops = [pursuitCop(pp + PLAYER_VIRTUAL_Z - 1200),
             pursuitCop(pp + PLAYER_VIRTUAL_Z - 2400)];
  cs.update(1 / 60, pp, MAX_SPEED * 0.5, 0);
  const lags = cs.cops.map(c => c._reactSec);
  // Pack model (2026-08-27): base 1.4-2.2 s per pursuit, per-unit spread
  // ±0.25 s (floored at 0.8) — units always clearly behind the PLAYER,
  // only slightly out of step with EACH OTHER.
  check('reaction lag — every unit gets one, inside 1.0-2.6 s',
        lags.every(l => l >= 1.0 && l <= 2.6));
  check('reaction lag — units spread less than the unit jitter',
        Math.abs(lags[0] - lags[1]) <= 0.5 + 1e-9);
}

// PIT arming: reachable at 3★ (alongside, mid-lunge), never at 1-2★.
// Moved 2★ -> 3★ on 2026-08-22 (owner): two stars now gets light contact bumps
// only, three is where a cruiser actually tries to spin you. Tracks
// CopSystem.MIN_STARS_PIT — update both together.
for (const [s, expectArmed] of [[1, false], [2, false], [3, true]]) {
  const cs = new CopSystem();
  cs.stars = s;
  const pp = 100000;
  const spd = MAX_SPEED * 0.5;
  const cop = pursuitCop(pp + PLAYER_VIRTUAL_Z - 400, 0);   // alongside, in lane
  cop._lungeT = 2.5;                                        // mid-strike
  cs.cops = [cop];
  let p2 = pp;
  for (let t = 0; t < 1.2; t += 1 / 60) {
    cop._lungeT = 2.5;                                      // hold the strike open
    cs.update(1 / 60, p2, spd, 0);
    p2 += spd / 60;
    cop.position = p2 + PLAYER_VIRTUAL_Z - 400;             // pin alongside
  }
  check(`PIT arming at ${s}★ — ${expectArmed ? 'arms' : 'never arms'}`,
        !!cop._pitArmed === expectArmed);
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
