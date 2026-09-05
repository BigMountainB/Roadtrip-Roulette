// ── Cash Economy V1 balance simulation (owner prompt 2026-09-05) ──────────
// Run: node tests/balance_sim.mjs
//
// Everything here uses LIVE values imported from the game (no stale $10
// pickups, no hardcoded catalog totals).  Lines marked [ASSUMED] are behavior
// assumptions awaiting playtest telemetry; everything else is [MEASURED]
// straight from the live constants/code.

import { MissionSystem, computePayout, MISSION_TIERS } from '../src/systems/MissionSystem.js';
import { REST_STOPS, PTS_DIST, ROUTE_SEGS, TOTAL_ROUTE_MILES, CASH_PER_MILE, COMBO,
         GIRL_PARTY_BONUS } from '../src/constants.js';
import { UPGRADE_CATALOG } from '../src/data/upgrades.js';
import { DAILY_BASE_REWARD, DAILY_REWARD_STEP, DAILY_WEEKLY_BONUS, rewardForAttempt } from '../src/systems/DailyChallenges.js';

const r0 = (n) => Math.round(n);
const money = (n) => `$${r0(n).toLocaleString()}`;

console.log('════ CASH ECONOMY V1 — balance simulation ════\n');

// ── Distance income [MEASURED] ────────────────────────────────────────────
const PER_MI = PTS_DIST * (ROUTE_SEGS / TOTAL_ROUTE_MILES);
console.log(`Distance income [MEASURED]: ${money(PER_MI)}/mi at 1× · ${money(PER_MI * COMBO.CAP)}/mi at the ${COMBO.CAP}× cap`);
console.log(`Route: ${TOTAL_ROUTE_MILES} mi → full-route distance income ${money(PER_MI * TOTAL_ROUTE_MILES)} at 1×, ${money(PER_MI * TOTAL_ROUTE_MILES * COMBO.CAP)} at cap\n`);

// ── Checkpoint projections at representative average combos [ASSUMED avg] ─
const CHECKPOINT_MILES = { 'Cle Elum': 84, 'Ellensburg': 107, 'Vantage': 132, 'Othello': 180, 'Pullman': 289 };
const AVG_COMBOS = [1.2, 2, 3.5, 6];
console.log('Cumulative distance income by checkpoint (average combo across the drive is [ASSUMED]):');
console.log('  checkpoint      ' + AVG_COMBOS.map(c => `@${c}×`.padStart(9)).join(''));
for (const [name, mi] of Object.entries(CHECKPOINT_MILES)) {
  console.log(`  ${name.padEnd(14)}` + AVG_COMBOS.map(c => money(PER_MI * mi * c).padStart(9)).join(''));
}

// ── Mission income distribution per tier [MEASURED offers, ASSUMED success]
console.log('\nMission payout distribution (live offer generation, 400 samples/tier):');
const TARGET = {
  Rookie: { lo: 100, hi: 250, ceil: 350 },
  Known:  { lo: 175, hi: 400, ceil: 600 },
  Legend: { lo: 300, hi: 650, ceil: 900 },
};
function fakeSave(rep) {
  const data = { missionRep: { ...rep } };
  return { get: (k, d) => (k in data ? data[k] : d), set: (k, v) => { data[k] = v; } };
}
const stopIds = REST_STOPS.map(rs => rs.id);
let bandsOk = true;
for (const tier of MISSION_TIERS) {
  const rep = tier.name === 'Rookie' ? {} : tier.name === 'Known'
    ? { passenger: 3, cargo: 3, weather: 3, heat: 3, timed: 3 }
    : { passenger: 9, cargo: 9, weather: 9, heat: 9, timed: 9 };
  // Split typical tier-length jobs from authored LONG-HAUL business chains
  // (priced per-mile over 100+ route miles — intentionally above the bands;
  // "do not flatten authored risk differences" per the economy prompt).
  const pays = [], longHaul = [];
  for (let i = 0; i < 40 && pays.length < 400; i++) {
    const m = new MissionSystem(fakeSave(rep));
    for (const sid of stopIds) {
      for (const o of (m.offersForStop(sid, { weatherOk: true }) ?? [])) {
        const total = o.payout + (o.tip ?? 0);
        ((o.routeMiles ?? 0) > tier.milesMax * 1.5 ? longHaul : pays).push(total);
      }
    }
  }
  pays.sort((a, b) => a - b);
  const q = (f) => pays[Math.min(pays.length - 1, Math.floor(f * pays.length))];
  const med = q(0.5), p10 = q(0.10), p90 = q(0.90), max = pays[pays.length - 1];
  const t = TARGET[tier.name];
  const inBand = med >= t.lo * 0.8 && med <= t.hi * 1.2 && max <= t.ceil * 1.25;
  bandsOk = bandsOk && inBand;
  console.log(`  ${tier.name.padEnd(7)} ×${tier.mult}  n=${pays.length}  p10 ${money(p10)}  median ${money(med)}  p90 ${money(p90)}  max ${money(max)}  target ${money(t.lo)}–${money(t.hi)} (ceil ~${money(t.ceil)})  ${inBand ? 'OK' : '⚠ OUT OF BAND'}`);
  if (longHaul.length) {
    longHaul.sort((a, b) => a - b);
    console.log(`           long-haul business chains (per-mile pricing, above-band by design): n=${longHaul.length}  ${money(longHaul[0])}–${money(longHaul[longHaul.length - 1])}`);
  }
}

// ── Operating costs [MEASURED constants] ──────────────────────────────────
const catalogTotal = Object.values(UPGRADE_CATALOG).flat().reduce((a, u) => a + (u.cost ?? 0), 0);
console.log(`\nOperating costs [MEASURED]:`);
console.log(`  Full upgrade catalog (dynamic): ${money(catalogTotal)} across ${Object.values(UPGRADE_CATALOG).flat().length} parts`);
console.log(`  Repairs: $30/missing HP (dealership) · $400 partial camp repair`);
console.log(`  Gas: $0.50/mi → full route ≈ ${money(0.5 * TOTAL_ROUTE_MILES)}`);

// ── Windfalls + bonuses [MEASURED] ────────────────────────────────────────
console.log(`\nWindfalls [MEASURED]:`);
console.log(`  Crush payoff: ${money(GIRL_PARTY_BONUS)}`);
console.log(`  Daily: first attempt ${money(rewardForAttempt(1))}, 2nd ${money(rewardForAttempt(2))}, floor $0 (step $${DAILY_REWARD_STEP}); weekly bonus ${money(DAILY_WEEKLY_BONUS)}`);
console.log(`  Completion bonus (% of ELIGIBLE run earnings): Easy 0% · Normal 25% · Hard 50%`);
const elig = (avgCombo, missions$) => PER_MI * TOTAL_ROUTE_MILES * avgCombo + missions$;
console.log(`  e.g. Normal full run @2× + $800 missions → eligible ${money(elig(2, 800))} → bonus ${money(elig(2, 800) * 0.25)}`);

console.log(`\nDistribution bands: ${bandsOk ? 'ALL WITHIN TARGET' : '⚠ SOME OUT OF BAND — see rows above'}`);
if (!bandsOk) process.exitCode = 1;
