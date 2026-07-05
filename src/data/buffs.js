// ── Temporary run buffs (data) ───────────────────────────────────────────
//
// Encounter choices grant buffs (e.g. "buy chains", "wind-ready").  A buff is
// a per-RUN modifier (not persisted between runs).  Physics-relevant effects
// use the SAME delta keys as part upgrades (grip/steer/stability/topMph/
// snowGrip/rainGrip/…) so GameScene can merge upgrades + buffs through one
// path.  Flavor-only buffs carry just a label; special buffs (consumed on a
// specific event) are flagged with `special` and handled at their call site.

export const BUFF_EFFECTS = {
  snow_chains: {
    label: 'Snow Chains',
    effects: { snowGrip: +0.28, topMph: -4 },   // grippy in snow, slower on dry
  },
  wind_ready: {
    label: 'Wind-Ready',
    effects: { stability: +0.10 },               // shrugs off Vantage crosswind
  },
  warm: {
    label: 'Caffeinated',
    effects: {},                                 // flavor (already gave time/hp at the stop)
  },
  elk_ready: {
    label: 'Elk-Aware',
    effects: {},                                 // flavor + hazard reveal
  },
  tow_insurance: {
    label: 'Tow Insurance',
    special: 'cheaper_wreck',                    // consumed on a wreck (halves the loss)
    effects: {},
  },
};

/** Merge the physics deltas of a set of active buff ids into one object. */
export function aggregateBuffEffects(buffIds = []) {
  const out = {};
  for (const id of buffIds) {
    const fx = BUFF_EFFECTS[id]?.effects;
    if (!fx) continue;
    for (const [k, v] of Object.entries(fx)) {
      if (typeof v === 'number') out[k] = (out[k] ?? 0) + v;
    }
  }
  return out;
}

/** Does the active buff set include a given `special` behavior? */
export function hasSpecialBuff(buffIds = [], special) {
  return buffIds.some(id => BUFF_EFFECTS[id]?.special === special);
}
