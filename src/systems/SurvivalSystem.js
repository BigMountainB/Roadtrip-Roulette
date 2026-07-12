// ── Survival System ──────────────────────────────────────────────────────
//
// The road-trip survival model that replaces the drug/vice-effect system.
// Three bars (0–100) + a Nausea sub-state + hidden caffeine dependence.
// See "Road Trip Roulette Overview.md" Chapter 4 (Survival System Spec) for the design contract.
//
//   Tiredness  0 = fully alert   → 100 = asleep (crash)   rises over distance
//   Fullness   0 = starving      → 100 = stuffed          falls over distance
//   Hydration  0 = dehydrated    → 100 = fully hydrated   falls over distance
//   Bladder    0 = empty         → 100 = gotta go NOW     fills when you eat/drink;
//                                                          ONLY a restroom empties it
//
// This module is pure logic (no Phaser) so it's unit-testable.  GameScene
// drives it: call update(milesTravelled, ctx) each frame and applyItem(id)
// on pickup; read the tier getters to drive HUD + visual effects.

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

// Baseline per-mile drift.  Food + drinks drain fast now (~a top-up lasts a few
// miles) so the survival loop stays active; tiredness rises slowly.
const DRIFT = { tiredness: +0.7, fullness: -3.6, hydration: -4.0 };

// Diuretics (coffee/caffeine/energy) hydrate you now, but ~half of the hydration
// they add drains right back off over the next couple miles.  `diuretic` is a
// small POOL of hydration still to be clawed back (not an ongoing forever drain).
const DIURETIC_FRAC  = 0.5;   // fraction of a drink's hydration that's "borrowed"
const DIURETIC_DRAIN = 2.0;   // how fast the pool is clawed back (hydration/mile)
const DIURETIC_MAX   = 20;

// Item → { t, h, f } bar deltas.  Specials (diuretic/addiction/…) handled in
// applyItem.  Every BEVERAGE adds to hydration on the spot; diuretics claw it
// back over the following miles instead of subtracting immediately.
const ITEM_FX = {
  water:        { t:  -5, h: +16, f:  +5 },
  coldbrew:     { t: -18, h:  +8, f:  +6, diuretic: 2 },
  caffeine:     { t: -30, h:  +5, f:   0, addiction: true, diuretic: 3 },
  slushie:      { t: -10, h: +10, f:  +6 },
  gummies:      { t:  -6, h:   0, f:  +3, tripRoll: true },
  sushi:        { t:  +5, h:   0, f:  +6, badFishRoll: true },
  burrito:      { t: +20, h:   0, f: +12 },
  dramamine:    { t: +25, h:   0, f:   0, curesNausea: true },
  quadshot:     { t: null, h:  +5, f:  +6, clearTiredness: true, diuretic: 3 },   // t handled by clear
  rage:         { t:   0, h:  +6, f:  +6, diuretic: 1.5 },
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
    this.fullness  = 25;    // start at 25% — just clear of the negative zone
    this.hydration = 25;    // start at 25% — just clear of the negative zone
    this.bladder   = 0;     // fills as you eat/drink; only a restroom empties it
    this.diuretic  = 0;     // caffeine "pee it out" charge → faster hydration drain
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

    // Fullness + hydration drain toward empty/dry.  If a diuretic pool is
    // pending, claw back a bit of hydration each mile until it's spent.
    this.fullness  = clamp(this.fullness  + DRIFT.fullness  * dMi);
    this.hydration = clamp(this.hydration + DRIFT.hydration * dMi);
    if (this.diuretic > 0) {
      const d = Math.min(this.diuretic, DIURETIC_DRAIN * dMi);
      this.hydration = clamp(this.hydration - d);
      this.diuretic  = Math.max(0, this.diuretic - d);
    }

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

    // Eating AND drinking fill the bladder (scaled by how much they add);
    // caffeine/quad-shot are diuretics and fill it extra.  Only a restroom
    // empties it (see GameScene: buys.emptyBladder / bladder-burst pull-over).
    this.bladder = clamp(this.bladder + this._bladderGain(id, fx));
    // Diuretic: ~half of the hydration this drink added is "borrowed" and drains
    // back off over the next couple miles.
    if (fx.diuretic) this.diuretic = Math.min(DIURETIC_MAX, this.diuretic + Math.max(0, fx.h || 0) * DIURETIC_FRAC);

    if (fx.addiction) { this.caffeineDep = clamp(this.caffeineDep + CAFFEINE_DEP_GAIN); this.caffeineActive = CAFFEINE_ACTIVE_MI; }
    if (id === 'coldbrew') this.caffeineActive = CAFFEINE_ACTIVE_MI;   // satisfies withdrawal, no dependence
    if (fx.curesNausea) { this.nausea = 0; ev.curedNausea = true; }

    if (fx.badFishRoll && rng() < BAD_FISH_CHANCE) {
      this.bladder = clamp(Math.max(this.bladder, 90));   // bad fish → gotta go NOW
      this.nausea  = clamp(this.nausea + 40);
      ev.badFish = true;
    }
    if (fx.tripRoll && rng() < ODD_GUMMY_CHANCE) ev.oddGummy = true;

    return ev;
  }

  /** How much a consumed item fills the bladder: scaled by the drink/food it
   *  adds, plus a diuretic bump for caffeine and the quad-shot. */
  _bladderGain(id, fx = {}) {
    const posH = Math.max(0, fx.h || 0), posF = Math.max(0, fx.f || 0);
    let g = posH * 0.07 + posF * 0.06;
    if (fx.diuretic) g += 0.8;   // diuretics make you go more
    return g;
  }

  /** External bladder fill (e.g. encounter food/drink that bypasses applyItem).
   *  posHydration/posFullness are the positive amounts added to those bars. */
  fillBladderFrom(posHydration = 0, posFullness = 0) {
    this.bladder = clamp(this.bladder + Math.max(0, posHydration) * 0.07 + Math.max(0, posFullness) * 0.06);
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
    if (this.hydration < 25)  return 'dehydrated';
    return 'ok';
  }
  bladderTier() {
    if (this.bladder >= 90) return 'bursting';
    if (this.bladder >= 75) return 'full';
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
             bladder: this.bladder, diuretic: this.diuretic, nausea: this.nausea, caffeineDep: this.caffeineDep };
  }
  restore(s = {}) {
    if (!s) return;
    this.tiredness = s.tiredness ?? this.tiredness;
    this.fullness  = s.fullness  ?? this.fullness;
    this.hydration = s.hydration ?? this.hydration;
    this.bladder   = s.bladder   ?? this.bladder;
    this.diuretic  = s.diuretic  ?? this.diuretic;
    this.nausea    = s.nausea    ?? this.nausea;
    this.caffeineDep = s.caffeineDep ?? this.caffeineDep;
  }
}

export { ITEM_FX, BAD_FISH_CHANCE, ODD_GUMMY_CHANCE };
