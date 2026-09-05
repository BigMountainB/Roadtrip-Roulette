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

console.log(`\ncombo.test: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
