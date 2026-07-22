// ── Player-facing vehicle stats (translation layer) ──────────────────────
//
// Turns the raw physics numbers (grip 1.02, turnRate 0.88, heat 0.95…) into
// eight readable 0–5 bar stats for the garage/encounter UI.  This is a
// READ-ONLY view — it computes from vehicle base stats + accessories + damage
// + (future) part upgrades.  It does NOT change how the car drives; Prompt 5
// hooks these into handling later.
//
// getVehicleDisplayStats(vehicleId, saveState?) → {
//   grip: { bars, label, note }, steering: {...}, stability, braking,
//   durability, cooling, visibility, range
// }
//
// Bars are 0–5 integers mapped from fixed reference ranges so values are
// ABSOLUTE (a beater reads low, a roadster reads high) rather than relative.

import { VEHICLES } from '../constants.js';

const STAT_INFO = {
  grip:       'How well the car holds the road in rain, snow, dirt, and fast curves.',
  steering:   'How sharply the car responds to steering input.',
  stability:  'Resistance to fishtail, crosswind shove, and crash spin.',
  braking:    'How quickly the car slows and recovers control.',
  durability: 'How much damage the car can take before it wrecks.',
  cooling:    'Resistance to overheating on climbs, boost, and desert heat.',
  visibility: 'Headlights, wipers, and readability in fog / rain / night.',
  range:      'Distance on a full tank / charge before you need a stop.',
};

/** Map a raw value to a 0–5 bar count against a fixed reference range. */
function toBars(value, min, max) {
  if (max <= min) return 0;
  const t = (value - min) / (max - min);
  return Math.max(0, Math.min(5, Math.round(t * 5)));
}

/** Compute the eight display stats for a vehicle.
 *  saveState (optional): { accessories?, upgrades?, damageFrac? }
 *    accessories — per-vehicle map (bumper, nos, tractionTires…)
 *    upgrades    — reserved for the part-upgrade system (Prompt 3)
 *    damageFrac  — 0..1 current durability fraction (adds a condition note) */
export function getVehicleDisplayStats(vehicleId, saveState = {}) {
  const v = VEHICLES[vehicleId] ?? VEHICLES.beater;
  const acc = (saveState.accessories?.[vehicleId]) ?? {};
  // Aggregated part-upgrade deltas.  Caller passes the object from
  // UpgradeSystem.getUpgradeEffects(save, vehicleId); absent = no upgrades.
  const up = saveState.upgradeEffects ?? {};

  // Legacy accessory nudges (kept for old saves / NOS-era bumper+tires).  The
  // upgrade bridge in getUpgradeEffects avoids double-counting these.
  const gripBonus  = acc.tractionTires ? 0.06 : 0;
  const hpBonus    = acc.bumper ? 12 : 0;
  const visBonus   = (acc.rallyLights ? 1 : 0) + (acc.fogLights ? 1 : 0);

  const grip       = (v.grip ?? 1) + gripBonus + (up.grip ?? 0);
  const steering   = (v.turnRate ?? 1) + (up.steer ?? 0);
  const stability  = (v.stability ?? 1) + (up.stability ?? 0);
  const braking    = 0.55 * (v.grip ?? 1) + 0.45 * (v.stability ?? 1) + (up.braking ?? 0);
  const durability = (v.hp ?? 50) + hpBonus + (up.hp ?? 0);
  const cooling    = 1.45 - (v.heat ?? 1) + (up.cooling ?? 0); // lower heat → better cooling
  const range      = (v.rangeMi ?? 250) + (up.rangeMi ?? 0);
  const visUp      = up.visibility ?? 0;

  const stats = {
    grip:       toBars(grip,       0.58, 1.28),
    steering:   toBars(steering,   0.72, 1.20),
    stability:  toBars(stability,  0.82, 1.25),
    braking:    toBars(braking,    0.68, 1.22),
    durability: toBars(durability, 25,   100),
    cooling:    toBars(cooling,    0.05, 0.62),
    visibility: Math.min(5, 2 + visBonus + visUp),         // base 2 + light upgrades
    range:      toBars(range,      200,  520),
  };

  const out = {};
  for (const key of Object.keys(stats)) {
    out[key] = { bars: stats[key], label: STAT_INFO[key] ? key : key, note: STAT_INFO[key] };
  }

  // Condition note if damage was passed in — the *max* stats stay; this just
  // flags that the car isn't at full health right now.
  if (typeof saveState.damageFrac === 'number' && saveState.damageFrac < 0.999) {
    out._condition = `${Math.round(saveState.damageFrac * 100)}% intact`;
  }
  return out;
}

/** Render the stats as an ASCII bar block (for debug / console).  UI comes
 *  in the Garage build (Prompt 4). */
export function debugPrintVehicleStats(vehicleId, saveState = {}) {
  const s = getVehicleDisplayStats(vehicleId, saveState);
  const bar = (n) => '█'.repeat(n) + '░'.repeat(5 - n);
  const lines = [`${(VEHICLES[vehicleId] ?? VEHICLES.beater).label}`];
  for (const key of ['grip', 'steering', 'stability', 'braking', 'durability', 'cooling', 'visibility', 'range']) {
    lines.push(`  ${key.padEnd(11)} ${bar(s[key].bars)}`);
  }
  if (s._condition) lines.push(`  (${s._condition})`);
  return lines.join('\n');
}
