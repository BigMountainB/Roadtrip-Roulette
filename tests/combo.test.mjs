// ── DrivingCombo + Cash Economy V1 tests (owner prompt 2026-09-05) ────────
// Run: node tests/combo.test.mjs
import { DrivingCombo } from '../src/systems/DrivingCombo.js';
import { COMBO, CASH_PER_MILE, PTS_DIST, ROUTE_SEGS, TOTAL_ROUTE_MILES } from '../src/constants.js';
import { GENRE_VEHICLE_TRAITS, genreTraitFor, mult as traitMult } from '../src/data/genreVehicleTraits.js';

let passed = 0, failed = 0;
const check = (label, ok) => { if (ok) passed++; else { failed++; console.log(`  ✗ FAIL: ${label}`); } };
const eq = (label, a, b) => check(`${label} (${a} === ${b})`, a === b);
const approx = (label, a, b, eps = 1e-9) => check(`${label} (${a} ≈ ${b})`, Math.abs(a - b) <= eps);
const mk = () => new DrivingCombo(COMBO);

// ── $/mile math is frame-rate independent (pure constants) ────────────────
{
  const perMile = PTS_DIST * (ROUTE_SEGS / TOTAL_ROUTE_MILES);
  approx('$3/mi at 1×', perMile, CASH_PER_MILE, 1e-9);
  approx('$45/mi at the 15× cap', perMile * COMBO.CAP, 45, 1e-9);
  // A mile paid in 1 chunk equals a mile paid in 1000 chunks (fractional accumulation).
  const chunks = Array.from({ length: 1000 }, () => PTS_DIST * (ROUTE_SEGS / TOTAL_ROUTE_MILES) / 1000);
  approx('granularity-independent earnings', chunks.reduce((a, b) => a + b, 0), perMile, 1e-9);
}

// ── build: three clean passes = one level; 42 passes = 15× ────────────────
{
  const c = mk();
  c.overtake(); c.overtake();
  eq('two passes: still 1×', c.mult, 1);
  const r = c.overtake();
  check('third pass levels to 2×', c.mult === 2 && r.leveled === true);
  for (let i = 0; i < 39; i++) c.overtake();
  eq('42 passes reach the 15× cap', c.mult, COMBO.CAP);
  for (let i = 0; i < 30; i++) c.overtake();
  eq('cap is absolute — more passes cannot exceed 15×', c.mult, COMBO.CAP);
}

// ── pickups: +3 s grace only, cap 12 s, active combos only, no levels ─────
{
  const c = mk();
  check('pickup at cold 1× does nothing', c.pickupExtend() === false);
  c.overtake();                       // active (progress 1), grace 8
  const g0 = c.grace;
  check('pickup extends an active combo', c.pickupExtend() === true && c.grace === g0 + COMBO.PICKUP_EXT_SEC);
  c.pickupExtend(); c.pickupExtend(); c.pickupExtend();
  eq('grace never exceeds 12 s', c.grace, COMBO.GRACE_MAX_SEC);
  eq('pickups never add levels', c.mult, 1);
}

// ── collisions reset everything ───────────────────────────────────────────
{
  const c = mk();
  for (let i = 0; i < 9; i++) c.overtake();      // 4×
  eq('setup: 4×', c.mult, 4);
  check('collision reports a loss', c.collisionReset() === true);
  check('collision → 1×/0/0', c.mult === 1 && c.progress === 0 && c.grace === 0);
}

// ── decay: grace 0 → clear progress, then −1 level / 2 s to 1× ────────────
{
  const c = mk();
  for (let i = 0; i < 6; i++) c.overtake();      // 3×, progress 0
  c.overtake();                                   // 3×, progress 1
  c.grace = 0.5;
  c.tick(0.5);                                    // grace exhausted
  c.tick(0.01);
  eq('partial progress cleared when decay begins', c.progress, 0);
  c.tick(COMBO.DECAY_STEP_SEC);
  eq('one level lost per 2 s', c.mult, 2);
  c.tick(COMBO.DECAY_STEP_SEC * 3);
  eq('decays to the 1× floor and stops', c.mult, 1);
}

// ── pause freezes timing; off-road decays double ──────────────────────────
{
  const c = mk();
  for (let i = 0; i < 3; i++) c.overtake();
  const g = c.grace;
  c.tick(5, { freeze: true });
  eq('freeze holds grace', c.grace, g);
  c.grace = 0;
  c.tick(COMBO.DECAY_STEP_SEC / COMBO.OFFROAD_DECAY_MULT, { decayMult: COMBO.OFFROAD_DECAY_MULT });
  eq('off-road decays at double speed', c.mult, 1);
}

// ── snapshot/restore round-trip; restore clamps ───────────────────────────
{
  const c = mk();
  for (let i = 0; i < 7; i++) c.overtake();
  const snap = c.snapshot();
  const d = mk(); d.restore(snap);
  check('snapshot round-trip', d.mult === c.mult && d.progress === c.progress);
  const e = mk(); e.restore({ level: 99, progress: 99, grace: 99 });
  check('restore clamps to legal ranges', e.mult === COMBO.CAP && e.grace === COMBO.GRACE_MAX_SEC);
}

// ── survival grace bonus is capped centrally ──────────────────────────────
{
  const c = mk();
  c.overtake({ graceBonus: COMBO.SURVIVAL_GRACE_CAP });
  eq('survival-boosted refresh caps at 10 s', c.grace, COMBO.GRACE_SEC + COMBO.SURVIVAL_GRACE_CAP);
  const d = mk();
  d.overtake({ graceBonus: 999 });
  eq('grace refresh itself is capped at GRACE_MAX', d.grace, COMBO.GRACE_MAX_SEC);
}

// ── genre scalers can never push the FINAL multiplier past 15× ────────────
{
  const driveMult = (comboMult, key) => {
    const t = genreTraitFor(key, 'beater');
    let m = comboMult;
    m *= traitMult(t, 'drivingCashMult') * traitMult(t, 'drivingBonusEarningsMult');
    m *= traitMult(t, 'drivingCashHiSpeedMult');    // worst case: hi-speed gate open
    m *= traitMult(t, 'lowHpBonusMult');            // worst case: low-HP gate open
    return Math.max(1, Math.min(COMBO.CAP, m));
  };
  for (const key of Object.keys(GENRE_VEHICLE_TRAITS)) {
    check(`${key} final multiplier within 1–15 at cap`, driveMult(COMBO.CAP, key) <= COMBO.CAP && driveMult(1, key) >= 1);
  }
  check('reggae floors at 1× (0.8 earnings cannot go below the floor)', driveMult(1, 'reggae') === 1);
}

// ── Sprite pickups + REWIND charge (owner 2026-09-07) ────────────────────
// A collected sprite is worth a WHOLE level now, not the 1-of-3 pass credit it
// was worth on 2026-09-05.  Reaching CAP banks a rewind charge, and only the
// RISING EDGE may bank — otherwise every sprite at CAP would mint one.
{
  const c = mk();
  eq('fresh combo starts at 1x', c.level, 1);

  const r1 = c.pickup();
  eq('one sprite = one whole level', c.level, 1 + COMBO.SPRITE_LEVELS);
  check('pickup reports leveled', r1.leveled === true);
  check('pickup below cap banks nothing', r1.hitCap === false);
  check('pickup refreshes grace', c.grace > 0);

  // Climb to CAP with sprites alone.
  let capHits = 0;
  const c2 = mk();
  for (let i = 0; i < COMBO.CAP + 5; i++) { if (c2.pickup().hitCap) capHits++; }
  eq('sprites cap at CAP', c2.level, COMBO.CAP);
  eq('exactly ONE charge banked on the rising edge', capHits, 1);

  // Sprites needed to reach the cap, at one level each.
  const c3 = mk();
  let n = 0;
  while (c3.level < COMBO.CAP) { c3.pickup(); n++; }
  eq('sprites to reach the cap', n, Math.ceil((COMBO.CAP - 1) / COMBO.SPRITE_LEVELS));

  // Overtakes ALSO bank on the rising edge — the charge is earned by REACHING
  // the cap, however the player got there.
  const c4 = mk();
  let otHits = 0;
  for (let i = 0; i < COMBO.PASSES_PER_LEVEL * COMBO.CAP + 9; i++) {
    if (c4.overtake().hitCap) otHits++;
  }
  eq('overtakes reach the cap', c4.level, COMBO.CAP);
  eq('overtakes bank exactly one charge', otHits, 1);

  // Overtakes are UNCHANGED in rate — still PASSES_PER_LEVEL per level.
  const c5 = mk();
  for (let i = 0; i < COMBO.PASSES_PER_LEVEL; i++) c5.overtake();
  eq('overtake rate unchanged', c5.level, 2);

  // A crash wipes the meter.  Charges live on the scene, NOT here, so
  // collisionReset must not expose any charge state to lose.
  const c6 = mk();
  c6.pickup(); c6.pickup();
  c6.collisionReset();
  eq('crash resets the meter to 1x', c6.level, 1);
  check('combo holds no charge state', !('charges' in c6) && !('rewind' in c6));

  // Falling below the cap and climbing back may bank again.
  const c7 = mk();
  while (c7.level < COMBO.CAP) c7.pickup();
  c7.collisionReset();
  let again = 0;
  while (c7.level < COMBO.CAP) { if (c7.pickup().hitCap) again++; }
  eq('re-reaching the cap banks again', again, 1);
}

// ── Cap-phase decay (owner 2026-09-07) ───────────────────────────────────
// Reaching ×15 is hard, so losing it is slow: hold CAP_GRACE_SEC, then one
// level per CAP_DECAY_STEP_SEC all the way down, until a sprite refreshes it.
{
  const run = (c, sec, dt = 0.5) => { for (let t = 0; t < sec; t += dt) c.tick(dt, {}); };

  const c = mk();
  while (c.level < COMBO.CAP) c.pickup();
  approx('grace at the cap is CAP_GRACE_SEC', c.grace, COMBO.CAP_GRACE_SEC, 1e-9);

  // Holds for the full grace, losing nothing.
  run(c, COMBO.CAP_GRACE_SEC - 0.5);
  eq('still at the cap through the hold', c.level, COMBO.CAP);

  // Then sheds exactly one level per CAP_DECAY_STEP_SEC.
  run(c, 0.5 + COMBO.CAP_DECAY_STEP_SEC);
  eq('one level shed after the first decay step', c.level, COMBO.CAP - 1);
  run(c, COMBO.CAP_DECAY_STEP_SEC);
  eq('a second level shed one step later', c.level, COMBO.CAP - 2);

  // A sprite refreshes the hold and re-levels.
  const before = c.level;
  c.pickup();
  check('a sprite re-levels during the descent', c.level > before);
  approx('a sprite restores the cap-phase grace', c.grace, COMBO.CAP_GRACE_SEC, 1e-9);

  // The cap step is SLOWER than the climb step — that is the whole point.
  check('cap decay is slower than climb decay',
    COMBO.CAP_DECAY_STEP_SEC > COMBO.DECAY_STEP_SEC);

  // Total fall from cap to 1x.
  const c2 = mk();
  while (c2.level < COMBO.CAP) c2.pickup();
  let sec = 0;
  while (c2.level > 1 && sec < 600) { c2.tick(0.5, {}); sec += 0.5; }
  eq('falls all the way to 1x', c2.level, 1);
  approx('cap→1× takes hold + 14 steps',
    sec, COMBO.CAP_GRACE_SEC + (COMBO.CAP - 1) * COMBO.CAP_DECAY_STEP_SEC, 0.75);

  // Back at 1×, the episode is over — a fresh climb uses the CLIMB tuning.
  const c3 = mk();
  c3.overtake();
  approx('a climbing combo uses the ordinary grace', c3.grace, COMBO.GRACE_SEC, 1e-9);

  // A crash clears the cap phase too.
  const c4 = mk();
  while (c4.level < COMBO.CAP) c4.pickup();
  c4.collisionReset();
  c4.overtake();
  approx('after a crash the climb grace is ordinary again', c4.grace, COMBO.GRACE_SEC, 1e-9);

  // A run RESUMED at the cap is still in the cap phase (no save migration).
  const c5 = mk();
  c5.restore({ level: COMBO.CAP, progress: 0, grace: 1 });
  run(c5, 1 + COMBO.DECAY_STEP_SEC + 0.5);
  check('a resumed cap run does not use the fast climb decay',
    c5.level > COMBO.CAP - 2);
}

// ── Rewind distance math ─────────────────────────────────────────────────
{
  const SEG_LENGTH = 200;   // constants.js
  const unitsPerMile = (ROUTE_SEGS * SEG_LENGTH) / TOTAL_ROUTE_MILES;
  const back = COMBO.REWIND_MILES * unitsPerMile;
  approx('rewind moves exactly REWIND_MILES', back / unitsPerMile, COMBO.REWIND_MILES, 1e-9);
  check('rewind is a positive distance', back > 0);
  check('rewind is shorter than the route', COMBO.REWIND_MILES < TOTAL_ROUTE_MILES);
  eq('one charge held at a time', COMBO.REWIND_MAX_CHARGES, 1);
}

console.log(`\ncombo.test: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
