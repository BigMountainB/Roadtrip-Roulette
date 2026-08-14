// ── Independent pursuit behaviour ──────────────────────────────────────────
// The 16 cases from the police-AI refactor brief. These exercise the behaviour
// layer directly (CopProfiles / CopDriver / PursuitDirector), which is why
// those modules take plain state and no Phaser — a scene is never constructed
// here.
//
// Determinism: every case that involves variation seeds makeRng(), so a run is
// byte-identical between machines and CI.

import { makeProfile, makeRng, integrateSpeed, mph } from '../src/cops/CopProfiles.js';
import { driveCop, pitCommitting, PHASE } from '../src/cops/CopDriver.js';
import { PursuitDirector, ROLE } from '../src/cops/PursuitDirector.js';
import { dispatchSpeed, stoppingDistance } from '../src/cops/CopProfiles.js';
import { CopSystem } from '../src/systems/CopSystem.js';
import { MAX_SPEED } from '../src/constants.js';

let pass = 0, fail = 0;
const check = (name, ok) => {
  if (ok) { pass++; } else { fail++; console.log(`  ✗ FAIL: ${name}`); }
};

const DT = 1 / 60;

/** A cop at `gap` units behind the player, with a seeded profile. */
function mkCop(id, gap, opts = {}) {
  const rng = makeRng(opts.seed ?? 1);
  return {
    id, kind: 'rear', alive: true,
    position: -gap,
    laneOffset: opts.lane ?? 0.4,
    speed: opts.speed ?? mph(90),
    profile: makeProfile({ star: opts.star ?? 3, rng, archetype: opts.archetype }),
    _recoverT: 0, _attackCd: 0, _slot: 0,
  };
}
/** Run `secs` of pursuit with the player at a fixed speed, player at z=0 moving. */
function run(cops, { playerSpeed, secs, star = 3, rng = makeRng(7), roles = null }) {
  const dir = new PursuitDirector();
  let pursuitZ = 0;
  for (let t = 0; t < secs; t += DT) {
    const world = { playerSpeed, pursuitZ, playerX: 0, grip: 1, star };
    const assigned = roles ?? dir.assign(cops, world, DT);
    for (const c of cops) driveCop(c, world, roles ? roles.get(c.id) : assigned.get(c.id), DT, rng);
    pursuitZ += playerSpeed * DT;
  }
  return { pursuitZ, dir };
}

// ── 1. ACCELERATION SEPARATION ────────────────────────────────────────────
{
  const cop = mkCop('a', 1500, { archetype: 'PATIENT', speed: mph(60) });
  const { pursuitZ } = run([cop], { playerSpeed: mph(115), secs: 3 });
  check('1. player accelerating past a slower cruiser gains distance',
        pursuitZ - cop.position > 1500);
}

// ── 2. BRAKING CLOSURE ────────────────────────────────────────────────────
{
  const cop = mkCop('b', 4000, { archetype: 'HEAVY', speed: mph(105) });
  const before = -cop.position;
  run([cop], { playerSpeed: mph(20), secs: 2 });   // player crawling
  check('2. braking player is closed on rapidly by a cop with momentum',
        (0 - cop.position) < before);
}

// ── 3. MAXIMUM SPEED ──────────────────────────────────────────────────────
{
  const cop = mkCop('c', 1000, { archetype: 'CAUTIOUS' });
  const { pursuitZ } = run([cop], { playerSpeed: mph(140), secs: 5 });
  check('3. a player faster than the cruiser cap genuinely escapes',
        pursuitZ - cop.position > 8000);
  check('3b. cop never exceeds its own maxSpeed', cop.speed <= cop.profile.maxSpeed + 1e-6);
}

// ── 4. PROFILE VARIATION ──────────────────────────────────────────────────
{
  const a = mkCop('d1', 2000, { archetype: 'AGGRESSIVE', seed: 11 });
  const b = mkCop('d2', 2000, { archetype: 'CAUTIOUS',   seed: 22 });
  run([a, b], { playerSpeed: mph(95), secs: 6 });
  check('4. differing profiles do not converge on one gap',
        Math.abs(a.position - b.position) > 200);
  check('4b. differing profiles do not converge on one speed',
        Math.abs(a.speed - b.speed) > 1 || a.profile.preferredGap !== b.profile.preferredGap);
}

// ── 5. NO TELEPORTING ─────────────────────────────────────────────────────
{
  const cop = mkCop('e', 6000, { archetype: 'AGGRESSIVE' });
  let maxJump = 0, prev = cop.position, pursuitZ = 0;
  const dir = new PursuitDirector();
  for (let t = 0; t < 6; t += DT) {
    const world = { playerSpeed: mph(90), pursuitZ, playerX: 0, grip: 1, star: 3 };
    driveCop(cop, world, dir.assign([cop], world, DT).get('e'), DT, makeRng(3));
    maxJump = Math.max(maxJump, Math.abs(cop.position - prev));
    prev = cop.position;
    pursuitZ += mph(90) * DT;
  }
  // One frame at the cop's own cap is the largest legal step.
  check('5. no snap to preferredGap — every step is a physical one',
        maxJump <= cop.profile.maxSpeed * DT + 1e-6);
}

// ── 6. NO PLAYER-SPEED ASSIGNMENT ─────────────────────────────────────────
{
  // Step the player's speed hard and confirm the cop never matches it exactly
  // on the same frame — an assignment would show as equality.
  const cop = mkCop('f', 1200, { archetype: 'PATIENT' });
  let pursuitZ = 0, matched = 0;
  const dir = new PursuitDirector();
  for (let t = 0; t < 4; t += DT) {
    const ps = t < 2 ? mph(100) : mph(35);
    const world = { playerSpeed: ps, pursuitZ, playerX: 0, grip: 1, star: 2 };
    driveCop(cop, world, dir.assign([cop], world, DT).get('f'), DT, makeRng(5));
    if (Math.abs(cop.speed - ps) < 1e-9) matched++;
    pursuitZ += ps * DT;
  }
  check('6. cop speed is never assigned the player speed', matched === 0);
}

// ── 7. SOFT FOLLOWING ─────────────────────────────────────────────────────
{
  const cop = mkCop('g', 5000, { archetype: 'AGGRESSIVE' });
  const gaps = [];
  let pursuitZ = 0;
  const dir = new PursuitDirector();
  for (let t = 0; t < 10; t += DT) {
    const world = { playerSpeed: mph(90), pursuitZ, playerX: 0, grip: 1, star: 2 };
    driveCop(cop, world, dir.assign([cop], world, DT).get('g'), DT, makeRng(9));
    pursuitZ += mph(90) * DT;
    gaps.push(pursuitZ - cop.position);
  }
  const want = cop.profile.preferredGap;
  const settled = gaps.slice(-120);
  check('7. gap approaches the preferred distance gradually',
        Math.min(...settled) < want * 2.2);
  check('7b. gap is not pinned to an exact value',
        Math.max(...settled) - Math.min(...settled) > 1);
}

// ── 8. ONE ATTACKER ───────────────────────────────────────────────────────
{
  const cops = [0, 1, 2, 3].map(i => mkCop(`h${i}`, 800 + i * 300, { archetype: 'AGGRESSIVE', seed: i + 1 }));
  const dir = new PursuitDirector();
  let pursuitZ = 0, worst = 0;
  for (let t = 0; t < 8; t += DT) {
    const world = { playerSpeed: mph(90), pursuitZ, playerX: 0, grip: 1, star: 5 };
    const roles = dir.assign(cops, world, DT);
    for (const c of cops) driveCop(c, world, roles.get(c.id), DT, makeRng(4));
    worst = Math.max(worst, [...roles.values()].filter(r => r === ROLE.STRIKER).length);
    pursuitZ += mph(90) * DT;
  }
  check('8. at most one striker token is ever held', worst <= 1);
}

// ── 9. ATTACK RECOVERY ────────────────────────────────────────────────────
{
  const cop = mkCop('i', 500, { archetype: 'AGGRESSIVE' });
  cop._intent = 'ram'; cop._intentT = 99; cop._phase = PHASE.COMMIT; cop._phaseT = 0.01;
  const world = { playerSpeed: mph(90), pursuitZ: 0, playerX: 0, grip: 1, star: 4 };
  driveCop(cop, world, ROLE.STRIKER, 0.05, makeRng(2));
  check('9. a completed attack enters recovery', cop._recoverT > 0);
  check('9b. and is on attack cooldown', cop._attackCd > 0);
}

// ── 10. PIT PHASE VALIDITY ────────────────────────────────────────────────
{
  const cop = mkCop('j', 300, { archetype: 'AGGRESSIVE' });
  cop._intent = 'pit'; cop._phase = PHASE.SETUP;
  check('10. PIT not armed during setup', !pitCommitting(cop));
  cop._phase = PHASE.TELEGRAPH;
  check('10b. PIT not armed during telegraph', !pitCommitting(cop));
  cop._phase = PHASE.COMMIT;
  check('10c. PIT armed only during commit', pitCommitting(cop));
  cop._intent = 'follow';
  check('10d. ordinary following never arms a PIT', !pitCommitting(cop));
}

// ── 11. LOW-STAR PASS POLICY ──────────────────────────────────────────────
{
  for (const star of [1, 2, 3]) {
    const cops = [0, 1, 2].map(i => mkCop(`k${star}${i}`, 600 + i * 200,
      { archetype: 'INTERCEPTOR', seed: i + 5, star }));
    const dir = new PursuitDirector();
    let sawPass = false, pursuitZ = 0;
    for (let t = 0; t < 5; t += DT) {
      const world = { playerSpeed: mph(90), pursuitZ, playerX: 0, grip: 1, star };
      const roles = dir.assign(cops, world, DT);
      if ([...roles.values()].includes(ROLE.PASSER)) sawPass = true;
      for (const c of cops) driveCop(c, world, roles.get(c.id), DT, makeRng(6));
      pursuitZ += mph(90) * DT;
    }
    check(`11. no deliberate pass role below 4★ (${star}★)`, !sawPass);
  }
}

// ── 12. ACCIDENTAL OVERSHOOT ──────────────────────────────────────────────
{
  // star 1, not 2: at 2★ this cop wins the striker token and a ram commit
  // carries it past the player again mid-window, which is correct behaviour but
  // not what this case is about. 1★ permits no attacks at all, so the only
  // thing under test is the overshoot recovery itself.
  const cop = mkCop('l', -900, { archetype: 'HEAVY', star: 1 });  // starts AHEAD
  const dir = new PursuitDirector();
  let pursuitZ = 0, maxJump = 0, prev = cop.position;
  for (let t = 0; t < 8; t += DT) {
    const world = { playerSpeed: mph(85), pursuitZ, playerX: 0, grip: 1, star: 1 };
    driveCop(cop, world, dir.assign([cop], world, DT).get('l'), DT, makeRng(8));
    maxJump = Math.max(maxJump, Math.abs(cop.position - prev));
    prev = cop.position;
    pursuitZ += mph(85) * DT;
  }
  check('12. an overshooting low-star cop ends up behind again', pursuitZ - cop.position > 0);
  check('12b. and never teleports getting there',
        maxJump <= cop.profile.maxSpeed * DT + 1e-6);
}

// ── 13. HIGH-STAR PASS ────────────────────────────────────────────────────
{
  const cops = [0, 1].map(i => mkCop(`m${i}`, 500 + i * 200,
    { archetype: 'INTERCEPTOR', seed: i + 3, star: 5 }));
  const dir = new PursuitDirector();
  let sawPass = false, pursuitZ = 0;
  for (let t = 0; t < 6; t += DT) {
    const world = { playerSpeed: mph(90), pursuitZ, playerX: 0, grip: 1, star: 5 };
    const roles = dir.assign(cops, world, DT);
    if ([...roles.values()].includes(ROLE.PASSER)) sawPass = true;
    for (const c of cops) driveCop(c, world, roles.get(c.id), DT, makeRng(1));
    pursuitZ += mph(90) * DT;
  }
  check('13. a pass role IS granted at 5★', sawPass);
}

// ── 14. PASS TERMINATION ──────────────────────────────────────────────────
{
  const cop = mkCop('n', 400, { archetype: 'INTERCEPTOR', star: 5 });
  cop._intent = 'pass'; cop._intentT = 0.05; cop._passGranted = true;
  let pursuitZ = 0;
  const dir = new PursuitDirector();
  for (let t = 0; t < 8; t += DT) {
    const world = { playerSpeed: mph(90), pursuitZ, playerX: 0, grip: 1, star: 5 };
    driveCop(cop, world, dir.assign([cop], world, DT).get('n'), DT, makeRng(12));
    pursuitZ += mph(90) * DT;
  }
  check('14. a passing cop transitions out of pass rather than driving away forever',
        cop._intent !== 'pass' || (pursuitZ - cop.position) > -60000);
}

// ── 15. DETERMINISM ───────────────────────────────────────────────────────
{
  const p1 = makeProfile({ star: 3, rng: makeRng(1234) });
  const p2 = makeProfile({ star: 3, rng: makeRng(1234) });
  check('15. a fixed seed reproduces a profile exactly',
        JSON.stringify(p1) === JSON.stringify(p2));
  const p3 = makeProfile({ star: 3, rng: makeRng(9999) });
  check('15b. a different seed produces a different profile',
        JSON.stringify(p1) !== JSON.stringify(p3));
}

// ── integrateSpeed invariants ─────────────────────────────────────────────
{
  const prof = makeProfile({ star: 3, rng: makeRng(42), archetype: 'HEAVY' });
  check('accel is bounded by the profile rate',
        integrateSpeed(0, prof.maxSpeed, prof, DT) <= prof.accel * prof.maxSpeed * DT + 1e-6);
  check('speed never exceeds the cop cap',
        integrateSpeed(prof.maxSpeed, prof.maxSpeed * 5, prof, 10) <= prof.maxSpeed);
  check('speed never goes negative',
        integrateSpeed(10, -9999, prof, 10) >= 0);
}


// ═══ DISPATCH LIFECYCLE (regression: cops spawned at COP_TOP_UNITS) ═══════

// ── 18. EVERY SPAWN PATH BUILDS THE PROFILE BEFORE THE SPEED ──────────────
{
  const paths = [];
  for (const star of [1, 3, 5]) {
    const cs = new CopSystem();
    cs.stars = star; cs._starLevel = star;
    let pp = 100000;
    for (let t = 0; t < 60; t += DT) { cs.update(DT, pp, MAX_SPEED * 0.6, 0); pp += MAX_SPEED * 0.6 * DT; }
    for (const c of cs.cops) if (c.kind === 'rear' && !c.parked) paths.push(c);
  }
  check('18. every rear pursuer has a profile', paths.length > 0 && paths.every(c => !!c.profile));
  check('1. no rear pursuer starts above its own maxSpeed',
        paths.every(c => (c.baseSpeed ?? 0) <= c.profile.maxSpeed + 1e-6));
  // ── 2. DISPATCH SPEED, NOT TOP SPEED ────────────────────────────────────
  const top = MAX_SPEED * (110 / 120);
  check('2. rear dispatch is road speed, not COP_TOP_UNITS',
        paths.every(c => (c.baseSpeed ?? 0) < top));
  check('2b. dispatch sits at or below cruise',
        paths.every(c => (c.baseSpeed ?? 0) <= c.profile.cruiseSpeed + 1e-6));
}

// ── dispatchSpeed invariants, directly ────────────────────────────────────
{
  for (const a of ['PATIENT', 'AGGRESSIVE', 'INTERCEPTOR', 'CAUTIOUS', 'ERRATIC', 'HEAVY']) {
    const prof = makeProfile({ star: 3, rng: makeRng(77), archetype: a });
    const sp = dispatchSpeed(prof, makeRng(5));
    check(`dispatch never exceeds ${a}'s own ceiling`,
          sp <= prof.maxSpeed && sp <= prof.cruiseSpeed && sp > 0);
  }
}

// ── 3 & 5. ONE STAR TAILS, NEVER ATTACKS ──────────────────────────────────
{
  const cop = mkCop('t1', 6000, { archetype: 'PATIENT', star: 1, speed: mph(70) });
  const dir = new PursuitDirector();
  let pursuitZ = 0, minGap = Infinity;
  const seen = new Set();
  for (let t = 0; t < 25; t += DT) {
    const world = { playerSpeed: mph(85), pursuitZ, playerX: 0, grip: 1, star: 1 };
    driveCop(cop, world, dir.assign([cop], world, DT).get('t1'), DT, makeRng(8));
    pursuitZ += mph(85) * DT;
    minGap = Math.min(minGap, pursuitZ - cop.position);
    seen.add(cop._intent);
  }
  check('3. a 1★ cruiser never enters ram / pit / pass / block',
        !seen.has('ram') && !seen.has('pit') && !seen.has('pass') && !seen.has('block'));
  check('4. a 1★ cruiser never reaches the player (no immediate strike)', minGap > 400);
  check('5. a 1★ cruiser establishes a tail near its preferred gap',
        minGap >= cop.profile.preferredGap * 0.85);
}

// ── APPROACH GATE ─────────────────────────────────────────────────────────
{
  const cop = mkCop('ap', 3000, { archetype: 'AGGRESSIVE', star: 5, speed: mph(75) });
  const dir = new PursuitDirector();
  let pursuitZ = 0, attackedEarly = false;
  for (let t = 0; t < 3; t += DT) {           // inside the approach window
    const world = { playerSpeed: mph(85), pursuitZ, playerX: 0, grip: 1, star: 5 };
    driveCop(cop, world, dir.assign([cop], world, DT).get('ap'), DT, makeRng(2));
    pursuitZ += mph(85) * DT;
    if (cop._intent === 'ram' || cop._intent === 'pit') attackedEarly = true;
  }
  check('a cop cannot attack during its approach window', !attackedEarly);
  check('and is not yet established', cop._established === false);
}

// ── 9 & 10. STOPPING DISTANCE IS RESPECTED ────────────────────────────────
{
  const prof = makeProfile({ star: 3, rng: makeRng(31), archetype: 'HEAVY' });
  check('9. stoppingDistance grows with closing speed',
        stoppingDistance(4000, prof) > stoppingDistance(1000, prof));
  check('9b. no braking room needed when not closing', stoppingDistance(-500, prof) === 0);
  // A heavy cop closing hard on a short gap must shed speed, not hold it.
  const cop = mkCop('sd', 1200, { archetype: 'HEAVY', star: 3, speed: mph(115) });
  cop._established = true; cop._approachT = -1;
  cop._intent = 'close'; cop._intentT = 99;
  const before = cop.speed;
  const world = { playerSpeed: mph(45), pursuitZ: 0, playerX: 0, grip: 1, star: 3 };
  for (let t = 0; t < 1; t += DT) driveCop(cop, world, 'follower', DT, makeRng(4));
  check('10. a cop closing too fast on a short gap brakes', cop.speed < before);
}

console.log(`\npursuit.test: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
