// ── Survival System ──────────────────────────────────────────────────────
//
// The road-trip survival model that replaces the drug/vice-effect system.
// Three bars (0–100) + a Nausea sub-state + hidden caffeine dependence.
// See SURVIVAL_SYSTEM_SPEC.md for the design contract.
//
//   Tiredness  0 = fully alert   → 100 = asleep (crash)   rises over distance
//   Fullness   0 = starving      → 100 = stuffed          falls over distance
//   Hydration  0 = dehydrated    → 100 = bursting bladder falls over distance
//
// This module is pure logic (no Phaser) so it's unit-testable.  GameScene
// drives it: call update(milesTravelled, ctx) each frame and applyItem(id)
// on pickup; read the tier getters to drive HUD + visual effects.

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

// Baseline per-mile drift (tuned so an untended run survives ~90–110 mi and
// you top up every ~35–40 mi — a real threat over 293 mi, not constant chores).
const DRIFT = { tiredness: +0.7, fullness: -0.9, hydration: -1.0 };

// Item → { t, h, f } bar deltas (per spec §3).  Specials handled in applyItem.
const ITEM_FX = {
  water:        { t:  -5, h: +25, f:  +7 },
  coldbrew:     { t: -18, h:  -8, f: +10 },
  caffeine:     { t: -30, h: -12, f:   0, addiction: true },
  slushie:      { t: -10, h: +15, f: +10 },
  gummies:      { t:  -6, h:   0, f:  +4, tripRoll: true },
  sushi:        { t:  +5, h:   0, f: +10, badFishRoll: true },
  burrito:      { t: +20, h:   0, f: +20 },
  dramamine:    { t: +25, h:   0, f:   0, curesNausea: true },
  quadshot:     { t: null, h: -15, f: +10, clearTiredness: true },   // t handled by clear
  rage:         { t:   0, h: +10, f: +10 },
};

const BAD_FISH_CHANCE   = 1 / 12;   // Sushi → bladder emergency
const ODD_GUMMY_CHANCE  = 1 / 20;   // Gummies → shroom trip
const CAFFEINE_DEP_GAIN  = 8;       // per Caffeine Pill
const CAFFEINE_DEP_ONSET = 15;      // withdrawal begins here (earlier than old alcohol)
const CAFFEINE_ACTIVE_MI = 12;      // a caffeine dose keeps withdrawal at bay this many miles

export class SurvivalSystem {
  constructor() { this.reset(); }

  reset() {
    this.tiredness = 0;
    this.fullness  = 0;     // start empty — fill up on the road
    this.hydration = 0;     // start empty — fill up on the road
    this.nausea    = 0;
    this.caffeineDep    = 0;   // hidden dependence 0–100
    this.caffeineActive = 0;   // miles of caffeine still "in system"
    this._lastMile = 0;
  }

  // ── Per-frame advance, driven by distance travelled (miles). ────────────
  // ctx: { curvature?: 0–1 (road bendiness), monotony?: 0–1 (empty straight) }
  update(mile, ctx = {}) {
    const dMi = Math.max(0, (mile ?? 0) - (this._lastMile ?? 0));
    this._lastMile = mile ?? 0;
    if (dMi <= 0) return;

    // Fullness + hydration simply drain toward empty/dry.
    this.fullness  = clamp(this.fullness  + DRIFT.fullness  * dMi);
    this.hydration = clamp(this.hydration + DRIFT.hydration * dMi);

    // Caffeine wears off with distance; dependence slowly decays.
    this.caffeineActive = Math.max(0, this.caffeineActive - dMi);
    this.caffeineDep    = clamp(this.caffeineDep - 1.0 * dMi);

    // Tiredness rises, accelerated by dehydration, being stuffed, and caffeine
    // withdrawal (multipliers stack).
    let mult = 1;
    if (this.hydration < 25) mult *= 1.5;                       // dehydrated
    if (this.fullness  > 75) mult *= 1 + 0.4 * ((this.fullness - 75) / 25); // food coma ramp
    if (this.inWithdrawal()) mult *= 1.25;
    this.tiredness = clamp(this.tiredness + DRIFT.tiredness * dMi * mult);

    // Nausea: winding road induces motion sickness; empty road lets it settle.
    const curve = ctx.curvature ?? 0;
    if (curve > 0.15) this.nausea = clamp(this.nausea + curve * 6 * dMi);
    else              this.nausea = clamp(this.nausea - 4 * dMi);
  }

  // ── Consume an item.  Returns an events object the caller can react to
  //    (popups / visuals): { badFish?, oddGummy?, asleep? }. ──────────────
  applyItem(id, rng = Math.random) {
    const fx = ITEM_FX[id];
    if (!fx) return {};
    const ev = {};

    if (fx.clearTiredness) this.tiredness = 0;
    else if (typeof fx.t === 'number') this.tiredness = clamp(this.tiredness + fx.t);
    if (typeof fx.h === 'number') this.hydration = clamp(this.hydration + fx.h);
    if (typeof fx.f === 'number') this.fullness  = clamp(this.fullness  + fx.f);

    if (fx.addiction) { this.caffeineDep = clamp(this.caffeineDep + CAFFEINE_DEP_GAIN); this.caffeineActive = CAFFEINE_ACTIVE_MI; }
    if (id === 'coldbrew') this.caffeineActive = CAFFEINE_ACTIVE_MI;   // satisfies withdrawal, no dependence
    if (fx.curesNausea) { this.nausea = 0; ev.curedNausea = true; }

    if (fx.badFishRoll && rng() < BAD_FISH_CHANCE) {
      this.hydration = clamp(Math.max(this.hydration, 90));   // bladder emergency
      this.nausea    = clamp(this.nausea + 40);
      ev.badFish = true;
    }
    if (fx.tripRoll && rng() < ODD_GUMMY_CHANCE) ev.oddGummy = true;

    return ev;
  }

  // ── Tier getters (drive HUD + effects; thresholds per spec §2) ──────────
  tirednessTier() {
    const t = this.tiredness;
    if (t >= 95) return 'asleep';
    if (t >= 85) return 'microsleep';
    if (t >= 70) return 'hypnosis';
    if (t >= 50) return 'drowsy';
    return 'alert';
  }
  hydrationTier() {
    if (this.hydration >= 90) return 'bursting';
    if (this.hydration >= 75) return 'bladder';
    if (this.hydration < 25)  return 'dehydrated';
    return 'ok';
  }
  fullnessTier() {
    if (this.fullness > 75) return 'coma';
    if (this.fullness < 25) return 'starving';
    return 'ok';
  }
  inWithdrawal() { return this.caffeineDep > CAFFEINE_DEP_ONSET && this.caffeineActive <= 0; }
  isNauseous()   { return this.nausea > 30; }
  isAsleep()     { return this.tiredness >= 100; }

  /** Snapshot for save/HUD. */
  snapshot() {
    return { tiredness: this.tiredness, fullness: this.fullness, hydration: this.hydration,
             nausea: this.nausea, caffeineDep: this.caffeineDep };
  }
  restore(s = {}) {
    if (!s) return;
    this.tiredness = s.tiredness ?? this.tiredness;
    this.fullness  = s.fullness  ?? this.fullness;
    this.hydration = s.hydration ?? this.hydration;
    this.nausea    = s.nausea    ?? this.nausea;
    this.caffeineDep = s.caffeineDep ?? this.caffeineDep;
  }
}

export { ITEM_FX, BAD_FISH_CHANCE, ODD_GUMMY_CHANCE };
