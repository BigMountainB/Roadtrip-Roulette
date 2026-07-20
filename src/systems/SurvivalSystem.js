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
// Food/drink drain +15% (2026-07-14 playtest: bars stayed "too full" too long).
const DRIFT = { tiredness: +0.7, fullness: -4.14, hydration: -4.6 };

// Diuretics (coffee/caffeine/energy) hydrate you now, but ~half of the hydration
// they add drains right back off over the next couple miles.  `diuretic` is a
// small POOL of hydration still to be clawed back (not an ongoing forever drain).
const DIURETIC_FRAC  = 0.5;   // fraction of a drink's hydration that's "borrowed"
const DIURETIC_DRAIN = 2.0;   // how fast the pool is clawed back (hydration/mile)
const DIURETIC_MAX   = 20;

// Item → { t, h, f } bar deltas.  Specials (diuretic/addiction/…) handled in
// applyItem.  Every BEVERAGE adds to hydration on the spot; diuretics claw it
// back over the following miles instead of subtracting immediately.
// BITE-SIZED (2026-07-12): each road sprite is a bite/sip, not a meal.
// FILLING ×1.5 (2026-07-14 playtest): ×2.5 overshot ("too much"), reduced by
// 40% → 1.5× the original bite values.  Tiredness and diuretic unchanged.
// Bladder is filled by DIGESTION over the miles now (see update()), not on the
// bite — so these food/drink values indirectly drive the bladder pace.
export const ITEM_FX = {
  water:        { t:  -1, h: +4.5, f:    0 },
  energy:       { t:  -8, h: +1.5, f:    0, diuretic: 2.5 },   // energy shot: big Alertness jolt (owner 2026-07-17)
  coldbrew:     { t:  -4, h:   +3, f:    0, diuretic: 2 },
  caffeine:     { t:  -7, h: +1.5, f:    0, addiction: true, diuretic: 3 },
  slushie:      { t:  -2, h: +4.5, f:   +3 },
  gummies:      { t:  -1, h:    0, f:   +3, tripRoll: true },
  sushi:        { t:  +1, h:    0, f: +4.5, badFishRoll: true },
  burrito:      { t:  +3, h:    0, f:   +6 },
  dramamine:    { t:  +6, h:    0, f:    0, curesNausea: true },
  quadshot:     { t: null, h:  +3, f:   +3, clearTiredness: true, diuretic: 3 },   // t handled by clear
  rage:         { t:   0, h:  +3, f:   +3, diuretic: 1.5 },
};

const BAD_FISH_CHANCE   = 1 / 12;   // Sushi → bladder emergency
const ODD_GUMMY_CHANCE  = 1 / 20;   // Gummies → shroom trip
const CAFFEINE_DEP_GAIN  = 8;       // per Caffeine Pill
const CAFFEINE_DEP_ONSET = 15;      // withdrawal begins here (earlier than old alcohol)
const CAFFEINE_ACTIVE_MI = 12;      // a caffeine dose keeps withdrawal at bay this many miles

export class SurvivalSystem {
  constructor() { this.reset(); }

  reset() {
    this.tiredness = 25;    // Alertness starts at 75% (owner call 2026-07-14)
    this.fullness  = 25;    // start at 25% — just clear of the negative zone
    this.hydration = 25;    // start at 25% — just clear of the negative zone
    this.bladder   = 25;    // start at 25% (multiplier condition is <25, so an
                            // early restroom stop buys the 2nd multiplier)
    this.diuretic  = 0;     // caffeine "pee it out" charge → faster hydration drain
    this.foodFastPool = 0;  // post-restroom: existing food to burn off 70% faster
    this.nausea    = 0;
    this.caffeineDep    = 0;   // hidden dependence 0–100
    this.caffeineActive = 0;   // miles of caffeine still "in system"
    this._lastMile = null;   // null = sync on first update, no drain
  }

  // ── Per-frame advance, driven by distance travelled (miles). ────────────
  // ctx: { curvature?: 0–1 (road bendiness), monotony?: 0–1 (empty straight) }
  update(mile, ctx = {}) {
    // First update after a reset/restore just SYNCS the mile tracker (no
    // drain) — restore() never carried _lastMile, so resuming at mile N
    // charged N miles of drain in one frame (bars slammed to 0 leaving a
    // rest stop).  The 0.5-mi cap keeps route-map warps/checkpoint jumps
    // from doing the same.
    const dMi = this._lastMile == null ? 0
      : Math.min(0.5, Math.max(0, (mile ?? 0) - this._lastMile));
    this._lastMile = mile ?? 0;
    if (dMi <= 0) return;

    // Genre-vehicle survival-drain modifier (owner 2026-07-19): scales the RATE
    // of food/drink/alertness change this frame. GameScene folds the general,
    // low-speed and while-boosting mults into ctx.drainMul; neutral (×1) else.
    const drainMul = ctx.drainMul ?? 1;

    // Fullness + hydration drain toward empty/dry.  Inside the 25–75 sweet
    // zone they drain 25% FASTER (2026-07-15: the multiplier window shouldn't
    // be a resting state), slower again above 75 / below 25.  If a diuretic
    // pool is pending, claw back a bit of hydration each mile until it's spent.
    const zone = (v) => (v > 25 && v < 75) ? 1.25 : 1.0;
    const _fBefore = this.fullness, _hBefore = this.hydration;   // for bladder-from-digestion
    const _fDrain = DRIFT.fullness * zone(this.fullness) * dMi * drainMul;   // this frame's normal food drain (negative)
    this.fullness  = clamp(this.fullness  + _fDrain);
    // Post-restroom fast-digest: the food you HAD when you used the restroom
    // burns off 70% faster, and that boost DIMINISHES as the pool empties. New
    // food eaten during the window isn't added to the pool, so it drains at the
    // normal rate (owner 2026-07-17). See boostFoodDrain().
    if (this.foodFastPool > 0) {
      const extra = Math.min(this.foodFastPool, Math.abs(_fDrain) * 0.7);
      this.fullness    = clamp(this.fullness - extra);
      this.foodFastPool -= extra;
    }
    this.hydration = clamp(this.hydration + DRIFT.hydration * zone(this.hydration) * dMi * drainMul);
    if (this.diuretic > 0) {
      const d = Math.min(this.diuretic, DIURETIC_DRAIN * dMi);
      this.hydration = clamp(this.hydration - d);
      this.diuretic  = Math.max(0, this.diuretic - d);
    }

    // Bladder fills as food + drink DIGEST (owner 2026-07-19): +40% of the
    // food-bar drop and +20% of the drink-bar drop this frame — digestion, not
    // the act of eating/drinking, is what fills you. Only a restroom empties it.
    const _foodDrop  = Math.max(0, _fBefore - this.fullness);
    const _drinkDrop = Math.max(0, _hBefore - this.hydration);
    this.bladder = clamp(this.bladder + 0.40 * _foodDrop + 0.20 * _drinkDrop);

    // Caffeine wears off with distance; dependence slowly decays.
    this.caffeineActive = Math.max(0, this.caffeineActive - dMi);
    this.caffeineDep    = clamp(this.caffeineDep - 1.0 * dMi);

    // Tiredness rises, accelerated by dehydration, being stuffed, and caffeine
    // withdrawal (multipliers stack).
    let mult = 1;
    if (this.hydration < 25) mult *= 1.5;                       // dehydrated
    if (this.fullness  > 75) mult *= 1 + 0.4 * ((this.fullness - 75) / 25); // food coma ramp
    if (this.inWithdrawal()) mult *= 1.25;
    this.tiredness = clamp(this.tiredness + DRIFT.tiredness * dMi * mult * drainMul);

    // Nausea: winding road induces motion sickness; empty road lets it settle.
    const curve = ctx.curvature ?? 0;
    if (curve > 0.15) this.nausea = clamp(this.nausea + curve * 6 * dMi);
    else              this.nausea = clamp(this.nausea - 4 * dMi);
  }

  // ── Consume an item.  Returns an events object the caller can react to
  //    (popups / visuals): { badFish?, oddGummy?, asleep? }. ──────────────
  applyItem(id, rng = Math.random, mods = {}) {
    const fx = ITEM_FX[id];
    if (!fx) return {};
    const ev = {};
    // Genre-vehicle survival BENEFIT mods (owner 2026-07-19), passed by GameScene:
    //   overfillMult — reggae: food/bladder gains ABOVE 75% halved.
    //   caffeineMult — edm: caffeine Alertness kick boosted.
    const _overMult = mods.overfillMult ?? 1;
    const _caffMult = mods.caffeineMult ?? 1;

    if (fx.clearTiredness) this.tiredness = 0;
    else if (typeof fx.t === 'number') {
      // Caffeine's Alertness kick is a NEGATIVE tiredness delta — boost it.
      const _tGain = (fx.t < 0 && fx.addiction) ? fx.t * _caffMult : fx.t;
      this.tiredness = clamp(this.tiredness + _tGain);
    }
    if (typeof fx.h === 'number') this.hydration = clamp(this.hydration + fx.h * (mods.drinkMult ?? 1));
    if (typeof fx.f === 'number') {
      const _fGain = (this.fullness > 75) ? fx.f * _overMult : fx.f;   // over-fill penalty
      this.fullness = clamp(this.fullness + _fGain);
    }

    // Bladder is no longer filled at the moment of eating/drinking — it fills as
    // food + drinks DIGEST over the miles (see update(): +40% food-drop / +20%
    // drink-drop). Only a restroom empties it.
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

  /** External bladder fill (e.g. encounter food/drink that bypasses applyItem).
   *  posHydration/posFullness are the positive amounts added to those bars. */
  fillBladderFrom(posHydration = 0, posFullness = 0) {
    this.bladder = clamp(this.bladder + Math.max(0, posHydration) * 0.0467 + Math.max(0, posFullness) * 0.04);
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
  /** A restroom break kicks digestion into high gear: the food you're carrying
   *  RIGHT NOW burns off 70% faster until this pool empties. New food eaten
   *  after doesn't join the pool, so it drains normally (owner 2026-07-17). */
  boostFoodDrain() { this.foodFastPool = this.fullness; }
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
             bladder: this.bladder, diuretic: this.diuretic, nausea: this.nausea, caffeineDep: this.caffeineDep,
             foodFastPool: this.foodFastPool };
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
    this.foodFastPool = s.foodFastPool ?? this.foodFastPool;
    this._lastMile = null;   // re-sync on the next update — never back-charge miles
  }
}

export { BAD_FISH_CHANCE, ODD_GUMMY_CHANCE };
