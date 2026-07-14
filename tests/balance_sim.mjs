// ── Mission-economy balance simulation (Ch. 8 Phase 7) ────────────────────
// Run: node tests/balance_sim.mjs
//
// Models plausible Seattle→Pullman runs and prints expected $ per run by
// income source, at each rep tier, for a mission-focused vs ignore-missions
// player — compared against the part-upgrade catalog prices.  Mission income
// uses the REAL offer generation + payout code (MissionSystem.js); sprite /
// distance income use the live constants (PTS_DIST, $10 pickups) with
// assumed collection behavior, since there's no playtest telemetry yet.
//
// Assumptions (flagged, not measured):
//   PICKUP_SPAWNS_PER_MI = 8, PICKUP_COLLECT_RATE = 0.45 (given), mult = 1
//   Mission player pulls into EVERY stop; ignore-missions player just drives.
//   Success rates: 0.9 plain, 0.75 per risky term (fragile/rush/quirk…).

import { MissionSystem } from '../src/systems/MissionSystem.js';
import { REST_STOPS, PTS_DIST, ROUTE_SEGS, TOTAL_ROUTE_MILES } from '../src/constants.js';

const RUNS = 500;
const ROUTE_MILES = REST_STOPS[REST_STOPS.length - 1].mileage - REST_STOPS[0].mileage; // 285
const DIST_PER_MI = PTS_DIST * (ROUTE_SEGS / TOTAL_ROUTE_MILES);   // ≈ $25/mi
const PICKUP_SPAWNS_PER_MI = 8, PICKUP_COLLECT_RATE = 0.45, PICKUP_VALUE = 10;

function fakeSave(rep) {
  const data = { missionRep: { ...rep } };
  return { get: (k, d) => (k in data ? data[k] : d), set: (k, v) => { data[k] = v; } };
}

// Success odds: each risky term multiplies the completion chance down.
const RISKY = ['fragile', 'perishable', 'illegal', 'rush', 'nervous', 'carsick',
               'fugitive', 'heat_escape', 'weather_run', 'no_chains'];
function successProb(m) {
  let p = 0.9;
  for (const t of RISKY) if (m.terms?.[t]) p *= 0.75 / 0.9 * 0.9; // 0.75 per risky term
  return p;
}

/** One mission-focused run at a fixed rep level: stop at every rest stop,
 *  greedily accept one offer per free type slot (prefer the highest payout
 *  whose target we will visit).  Returns expected mission $ (payout ×
 *  success prob, tips ignored). */
function missionRun(seed, rep) {
  const sys = new MissionSystem(fakeSave(rep));
  sys.resetRun(seed);
  let expected = 0, accepted = 0;
  const active = {};                              // type -> {payout, prob, targetMile}
  for (const rs of REST_STOPS) {
    // Arrivals: settle anything targeting this stop.
    for (const [type, a] of Object.entries(active)) {
      if (a.targetStopId === rs.id) { expected += a.payout * a.prob; delete active[type]; }
    }
    // New offers (heat/weather ctx: assume weather live; heat needs 2★,
    // model the mission player as hot ~25% of stop entries).
    const hot = (seed % 4) === 0;
    const offers = sys.offersForStop(rs.id, { stars: hot ? 2 : 0, weatherOk: true, windOk: true });
    const open = offers.filter(o => o.status === 'offered')
      .sort((a, b) => b.payout - a.payout);
    for (const o of open) {
      if (active[o.type]) continue;
      const m = sys.accept(o.id, rs.mileage, 100000);
      if (!m) continue;
      accepted++;
      active[o.type] = { payout: m.payout, prob: successProb(m), targetStopId: m.targetStopId };
    }
  }
  return { expected, accepted };
}

const TIERS = {
  Rookie: {},
  Known:  { delivery: 3, timed: 3, passenger: 3, heat: 3, weather: 3 },
  Legend: { delivery: 8, timed: 8, passenger: 8, heat: 8, weather: 8 },
};

const distance = Math.round(ROUTE_MILES * DIST_PER_MI);
const pickups  = Math.round(ROUTE_MILES * PICKUP_SPAWNS_PER_MI * PICKUP_COLLECT_RATE * PICKUP_VALUE);
const baseline = distance + pickups;

console.log(`route: ${ROUTE_MILES} mi · distance $${DIST_PER_MI.toFixed(2)}/mi = $${distance} · pickups (8/mi × 45% × $10) = $${pickups}`);
console.log(`ignore-missions player ≈ $${baseline}/run (mult 1; vice mult scales this up)\n`);
console.log('tier    | avg jobs | mission $ | total $/run | vs full catalog ($17,905)');
console.log('--------|----------|-----------|-------------|--------------------------');
for (const [name, rep] of Object.entries(TIERS)) {
  let sum = 0, jobs = 0;
  for (let s = 1; s <= RUNS; s++) { const r = missionRun(s, rep); sum += r.expected; jobs += r.accepted; }
  const avg = Math.round(sum / RUNS);
  const total = baseline + avg;
  console.log(`${name.padEnd(7)} | ${(jobs / RUNS).toFixed(1).padStart(8)} | ${('$' + avg).padStart(9)} | ${('$' + total).padStart(11)} | ${(17905 / total).toFixed(1)} runs to max everything`);
}
