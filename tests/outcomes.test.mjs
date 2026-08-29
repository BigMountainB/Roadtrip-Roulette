// Ending-outcome calculator tests (src/data/endingOutcomes.js).
// The ending screens render RESTART/CONTINUE from these objects and apply
// the SAME objects, so these rules ARE the player-facing contract.
import { computeEndingOutcomes, summarizeDrive, fmtMoney, fmtMoneyDelta }
  from '../src/data/endingOutcomes.js';

let pass = 0, fail = 0;
const eq = (got, want, label) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++;
  else { fail++; console.log(`  ✗ ${label}\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`); }
};
const ok = (cond, label) => { if (cond) pass++; else { fail++; console.log(`  ✗ ${label}`); } };

const ROUTE = { routeUnits: 100000, totalRouteMiles: 100 };   // 1 mi = 1000 units
const SNAP = {
  cash: 13984, position: 0, locName: 'West Seattle',
  hp: 100, fuelMi: 75, stars: 0,
  viceLevels: { sushi: 0.4 }, f12Tokens: ['donut'], coalAmmo: 1,
};
const CP = { name: 'Bellevue', position: 8000 };

// ── Money formatting ─────────────────────────────────────────────────────
eq(fmtMoney(13984), '$13,984', 'fmtMoney commas');
eq(fmtMoney(0), '$0', 'fmtMoney zero');
eq(fmtMoney(-0.4), '$0', 'fmtMoney never prints -$0');
eq(fmtMoney(-6121), '-$6,121', 'fmtMoney negative');
eq(fmtMoneyDelta(1250), '+$1,250', 'delta positive');
eq(fmtMoneyDelta(-6121), '-$6,121', 'delta negative');
eq(fmtMoneyDelta(0), '+$0', 'delta zero reads as a (non-)gain, never a loss');

// ── Crash: lost money, both outcomes ─────────────────────────────────────
{
  const { restart, cont } = computeEndingOutcomes({
    cause: 'crash', finalCash: 7863, snap: SNAP, checkpoint: CP,
    baseVehicleHp: 25, ...ROUTE,
  });
  eq(restart.cash, 13984, 'crash restart restores drive-start cash');
  eq(restart.mi, 0, 'crash restart returns to drive-start mileage');
  eq(restart.loc, 'West Seattle', 'restart location from snapshot');
  eq(restart.hp, 100, 'restart HP from snapshot');
  eq(restart.fuelMi, 75, 'restart fuel from snapshot');
  ok(restart.snap === SNAP, 'restart carries the snapshot for verbatim apply');
  eq(cont.valid, true, 'continue valid with checkpoint');
  eq(cont.cash, 3931, 'crash continue halves remaining cash (engine rule)');
  eq(cont.fee, 3932, 'crash continue fee = the half that was lost');
  eq(cont.mi, 8, 'continue resumes at checkpoint mileage');
  eq(cont.loc, 'Bellevue', 'continue location from checkpoint');
  eq(cont.hp, 13, 'continue HP = 50% of base vehicle HP, rounded');
  eq(cont.note, 'Includes $3,932 recovery · HP 13', 'fee note format');
}

// ── Busted: bail already charged — continue keeps remaining cash ─────────
{
  const { cont } = computeEndingOutcomes({
    cause: 'busted', finalCash: 7863, snap: SNAP, checkpoint: CP,
    baseVehicleHp: 25, ...ROUTE,
  });
  eq(cont.cash, 7863, 'busted continue keeps post-bail cash as-is');
  eq(cont.fee, 0, 'busted continue has no additional fee');
  eq(cont.note, 'HP 13', 'busted note still shows recovery HP');
}

// ── Passed out uses the crash recovery rule ──────────────────────────────
{
  const { cont } = computeEndingOutcomes({
    cause: 'passed_out', finalCash: 101, snap: SNAP, checkpoint: CP,
    baseVehicleHp: 100, ...ROUTE,
  });
  eq(cont.cash, 50, 'passed_out continue halves cash (floor)');
  eq(cont.fee, 51, 'odd-dollar fee rounds against the player, matching floor');
  eq(cont.hp, 50, 'HP = 50% of base 100');
}

// ── Earned money before failing ──────────────────────────────────────────
{
  const s = summarizeDrive({ startCash: 13984, finalCash: 15234 });
  eq(s.delta, 1250, 'earned delta positive');
  const s2 = summarizeDrive({ startCash: 13984, finalCash: 7863 });
  eq(s2.delta, -6121, 'lost delta negative');
  const s3 = summarizeDrive({ startCash: 0, finalCash: 0 });
  eq(s3.delta, 0, 'zero-zero drive');
}

// ── No checkpoint → continue invalid ─────────────────────────────────────
{
  const { cont } = computeEndingOutcomes({
    cause: 'crash', finalCash: 500, snap: SNAP, checkpoint: null,
    baseVehicleHp: 25, ...ROUTE,
  });
  eq(cont.valid, false, 'no checkpoint disables continue');
}

// ── No snapshot (legacy caller) → restart null, callers fall back ────────
{
  const { restart } = computeEndingOutcomes({
    cause: 'crash', finalCash: 500, snap: null, checkpoint: CP,
    baseVehicleHp: 25, ...ROUTE,
  });
  eq(restart, null, 'missing snapshot yields null restart outcome');
}

// ── Zero / negative-cash guards ──────────────────────────────────────────
{
  const { restart, cont } = computeEndingOutcomes({
    cause: 'crash', finalCash: 0, snap: { ...SNAP, cash: 0 }, checkpoint: CP,
    baseVehicleHp: 25, ...ROUTE,
  });
  eq(restart.cash, 0, 'zero start cash restores to zero');
  eq(cont.cash, 0, 'zero cash continue stays zero');
  eq(cont.fee, 0, 'no fee on zero cash');
  eq(cont.note, 'HP 13', 'no fee note when nothing was charged');
}

// ── Restart = run-start snapshot, VERBATIM (owner 2026-08-29) ────────────
// The snapshot taken at the start of every game (money + inventory + stats)
// is THE reset point: restart rewinds to it exactly — mid-run earnings AND
// mid-run purchases (upgrades) go away together, and no ending penalty
// (bail / half-cash) is layered on top.  Cash penalties bite only CONTINUE.
{
  // Earned money during the run, then crashed: restart resets to run-start
  // money regardless — the current wallet never leaks into the reset.
  const { restart } = computeEndingOutcomes({
    cause: 'crash', finalCash: 20500, snap: SNAP, checkpoint: CP,
    baseVehicleHp: 25, ...ROUTE,
  });
  eq(restart.cash, 13984, 'restart resets earnings back to run-start cash');
}
{
  // Busted: bail was charged before the screen — restart ignores it entirely
  // (snapshot cash), continue keeps the post-bail wallet.
  const { restart, cont } = computeEndingOutcomes({
    cause: 'busted', finalCash: 7863, snap: SNAP,
    checkpoint: CP, baseVehicleHp: 25, ...ROUTE,
  });
  eq(restart.cash, 13984, 'busted restart = run-start cash, bail not layered on');
  eq(cont.cash, 7863, 'busted continue still pays the bail');
}
{
  // Net spender (bought upgrades mid-run): the snapshot refunds the money
  // WITH the upgrades rolled back — snap carries the run-start maps that
  // _applyRestartOutcome writes over the save.
  const { restart } = computeEndingOutcomes({
    cause: 'crash', finalCash: 4000, snap: SNAP, checkpoint: CP,
    baseVehicleHp: 25, ...ROUTE,
  });
  eq(restart.cash, 13984, 'net-spender restart refunds to run-start cash');
  ok(restart.snap === SNAP, 'restart applies THE snapshot (upgrade maps included)');
}

// ── Determinism: computing twice yields identical outcomes (repeat
// restarts/continues can't drift, because apply == this same object) ─────
{
  const args = { cause: 'crash', finalCash: 7863, snap: SNAP, checkpoint: CP,
                 baseVehicleHp: 25, ...ROUTE };
  const a = computeEndingOutcomes(args);
  const b = computeEndingOutcomes(args);
  eq({ r: a.restart.cash, c: a.cont.cash }, { r: b.restart.cash, c: b.cont.cash },
     'outcomes are pure/deterministic');
}

console.log(`\noutcomes.test: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
