// ─────────────────────────────────────────────────────────────────────────
// Genre Vehicle Traits — data-driven gameplay identity for the 10 soundtrack-
// culture STARTER vehicles (the re-skinned beater). Each genre's starter drives
// differently: 2–3 strengths, 1–2 weaknesses, a unique top-speed cap, and a
// player-facing description.
//
// SCOPE: a trait applies ONLY when the player is driving the starter/beater
// (`vehicleId === 'beater'`) with a culture selected. Purchased non-culture
// vehicles (suv4x4, trucks, sportsCar, …) keep their normal VEHICLES stats and
// resolve to `null` here. The active trait is DERIVED (culture + vehicleId) —
// never duplicated into save data — so it can't drift or double-apply on
// resume/restart.
//
// ARCHITECTURE: every numeric effect is an explicit modifier field with a
// NEUTRAL default (1.0 for a multiplier, 0/false for a flag), read at the
// mechanic's consumption point via `traitMods()` / `mult()` — no descriptive
// text is ever parsed, and no base constant is mutated globally.
//
// Canonical culture keys (must match AssetManifest / AudioSystem):
//   hiphop_phonk · country · reggaeton · k_pop · metal
//   classic_rock · edm_rave · reggae · pop_punk_emo · norteno
// ─────────────────────────────────────────────────────────────────────────

/** The starter/beater vehicle id — the ONLY vehicle a genre trait rides on. */
export const STARTER_VEHICLE_ID = 'beater';

/** Every modifier field the integration points read, with its neutral default.
 *  A trait's `modifiers` object overrides only the fields it changes; anything
 *  it omits stays neutral. Keeping the full list here documents the contract
 *  and lets `mult()` fall back safely for older/partial trait objects. */
export const MODIFIER_DEFAULTS = Object.freeze({
  // ── Speed / handling / physics ──
  accelerationMult:          1,   // engine accel force
  steeringMult:              1,   // steering response
  brakingMult:               1,   // brake force (<1 ⇒ longer stopping distance)
  boostStrengthMult:         1,   // ACCEL-boost magnitude
  boostDurationMult:         1,   // ACCEL-boost duration
  // ── Hazards (snow / wind / rough road) ──
  hazardSteeringPenaltyMult: 1,   // snow+wind+rough steering penalty scale
  snowSteeringPenaltyMult:   1,   // snow-only steering penalty scale (stacks on hazard)
  hazardInstabilityMult:     1,   // snow/crosswind instability scale
  // ── Damage taken ──
  damageTakenMult:           1,   // ALL damage sources
  collisionDamageMult:       1,   // traffic/collision only (stacks on damageTaken)
  sceneryDamageMult:         1,   // scenery impacts only (stacks on damageTaken)
  policeDamageMult:          1,   // police contact only (stacks on damageTaken)
  // ── Economy / driving cash / bonus ──
  drivingCashMult:           1,   // flat driving-cash rate
  drivingCashHiSpeedMult:    1,   // extra cash multiplier above `hiSpeedCashMinMph`
  hiSpeedCashMinMph:         0,   // speed gate for drivingCashHiSpeedMult
  drivingBonusBuildMult:     1,   // how fast the driving bonus ramps
  drivingBonusGraceMult:     1,   // grace period before the bonus resets
  drivingBonusEarningsMult:  1,   // payout scale on the driving bonus
  lowHpBonusMult:            1,   // driving-bonus scale below `lowHpBonusHp`
  lowHpBonusHp:              0,   // HP gate for lowHpBonusMult
  lowSpeedFullEarnMinMph:    0,   // ≥ this speed earns the full 100-mph rate (reggae)
  // ── Fuel / repairs / upgrades ──
  fuelBurnMult:              1,   // fuel drained per distance
  fuelRangeMult:             1,   // tank range (applied to burn as 1/range)
  repairUpgradeCostMult:     1,   // repair + basic-upgrade prices
  // ── Police / wanted ──
  wantedDecayMult:           1,   // star-decay RATE (<1 ⇒ slower decay)
  ticketSurcharge:           0,   // extra $ added to every ticket
  noPoliceWarning:           false, // skip the warning, go straight to a stop
  firstViolationInstantStar: false, // first moving violation adds a star immediately
  // ── Survival bars / pickups ──
  survivalDrainMult:         1,   // food+drinks+alertness drain rate
  survivalDrainLoSpeedMult:  1,   // drain rate below 100 mph (stacks)
  survivalDrainBoostMult:    1,   // drinks+bladder drain rate WHILE boosting (stacks)
  drinkBenefitHiSpeedMult:   1,   // drink/caffeine benefit above `drinkBenefitHiSpeedMph`
  drinkBenefitHiSpeedMph:    110,
  caffeineBenefitMult:       1,   // caffeine Alertness gain
  caffeineCrashDelay:        false, // delay the post-caffeine crash
  overfillGainMult:          1,   // food/bladder gains ABOVE 75% fullness
  pickupRadiusMult:          1,   // roadside pickup collection radius
  // ── Missions / cargo ──
  passengerPayMult:          1,   // passenger fares
  timedPayMult:              1,   // timed jobs finished with time to spare
  cargoPayMult:              1,   // delivery/cargo payouts
  cargoCollisionShield:      0,   // # of minor collisions the cargo survives
  // ── F12 weapons ──
  weaponDurationMult:        1,   // F12 effect duration
  weaponBonusUseChance:      0,   // chance a weapon pickup grants +1 use
  // ── HP / engine ──
  maxHpMult:                 1,   // max HP scale
  ignoreFirstOverheatPerLeg: false, // shrug off the first overheat each route leg
});

export const GENRE_VEHICLE_TRAITS = {
  hiphop_phonk: {
    key: 'hiphop_phonk',
    vehicleName: 'VIP Sedan',
    topSpeedMph: 140,
    strengths: [
      'Reaches top speed 20% faster',
      'Driving-bonus grace period lasts 50% longer',
      'Wanted stars decay 25% slower',
    ],
    weaknesses: [
      'Snow, wind & rough-road steering penalties 25% stronger',
    ],
    modifiers: {
      accelerationMult:          1.20,
      drivingBonusGraceMult:     1.50,
      wantedDecayMult:           0.75,
      hazardSteeringPenaltyMult: 1.25,
    },
  },

  country: {
    key: 'country',
    vehicleName: 'Mud Truck',
    topSpeedMph: 120,
    strengths: [
      'Traffic, scenery & weather damage −25%',
      'Snow & crosswind steering penalty −50%',
    ],
    weaknesses: [
      'Fuel consumption +30%',
      'Accel & steering −20%; bonus builds 20% slower',
    ],
    modifiers: {
      damageTakenMult:           0.75,
      hazardSteeringPenaltyMult: 0.50,
      fuelBurnMult:              1.30,
      accelerationMult:          0.80,
      steeringMult:              0.80,
      drivingBonusBuildMult:     0.80,
    },
  },

  reggaeton: {
    key: 'reggaeton',
    vehicleName: 'Lowrider',
    topSpeedMph: 135,
    strengths: [
      'Passenger fares +30%',
      'Drinks & caffeine +25% above 110 mph',
    ],
    weaknesses: [
      'First moving violation = instant wanted star',
      'Collision damage +20%; snow steering penalty +25%',
    ],
    modifiers: {
      passengerPayMult:          1.30,
      drinkBenefitHiSpeedMult:   1.25,
      drinkBenefitHiSpeedMph:    110,
      firstViolationInstantStar: true,
      collisionDamageMult:       1.20,
      snowSteeringPenaltyMult:   1.25,
    },
  },

  k_pop: {
    key: 'k_pop',
    vehicleName: 'Idol EV',
    topSpeedMph: 150,
    strengths: [
      'Roadside pickup radius +30%',
      'On-time bonus +25% on timed jobs',
    ],
    weaknesses: [
      'Collision damage +25%',
      'Food, Drinks & Alertness drain +20%',
    ],
    modifiers: {
      pickupRadiusMult:    1.30,
      timedPayMult:        1.25,
      collisionDamageMult: 1.25,
      survivalDrainMult:   1.20,
    },
  },

  metal: {
    key: 'metal',
    vehicleName: 'War Van',
    topSpeedMph: 110,
    strengths: [
      'Collision & police damage −30%',
      'Weapons last +25%; 20% chance of a bonus use',
    ],
    weaknesses: [
      'Accel, braking & steering −20%',
      'Fuel consumption +35%',
    ],
    modifiers: {
      damageTakenMult:      0.70,
      weaponDurationMult:   1.25,
      weaponBonusUseChance: 0.20,
      accelerationMult:     0.80,
      brakingMult:          0.80,
      steeringMult:         0.80,
      fuelBurnMult:         1.35,
    },
  },

  classic_rock: {
    key: 'classic_rock',
    vehicleName: 'Muscle Car',
    topSpeedMph: 160,
    strengths: [
      'Driving cash above 120 mph +30%',
      'Shrugs off the first overheat each leg',
    ],
    weaknesses: [
      'Braking distance +25%',
      'Snow & crosswind instability +30%',
    ],
    modifiers: {
      drivingCashHiSpeedMult:    1.30,
      hiSpeedCashMinMph:         120,
      ignoreFirstOverheatPerLeg: true,
      brakingMult:               0.80,
      hazardInstabilityMult:     1.30,
    },
  },

  edm_rave: {
    key: 'edm_rave',
    vehicleName: 'Laser Supercar',
    topSpeedMph: 175,
    strengths: [
      'ACCEL boost +35% & 25% longer',
      'Caffeine +35% Alertness, delayed crash',
    ],
    weaknesses: [
      'Collision damage +35%',
      'Drinks & Bladder drain +25% while boosting',
    ],
    modifiers: {
      boostStrengthMult:     1.35,
      boostDurationMult:     1.25,
      caffeineBenefitMult:   1.35,
      caffeineCrashDelay:    true,
      collisionDamageMult:   1.35,
      survivalDrainBoostMult: 1.25,
    },
  },

  reggae: {
    key: 'reggae',
    vehicleName: 'Easy-Rider Van',
    topSpeedMph: 100,
    strengths: [
      '70–99 mph earns the full 100-mph rate',
      'Alertness, Food & Bladder drain −25% below 100 mph',
    ],
    weaknesses: [
      'No police warnings; every ticket +$200',
      'Over-75% Food/Bladder gains halved; bonus ×0.80',
    ],
    // Dark satire about profiling attached to a FICTIONAL vehicle trait — not a
    // claim about real people.
    modifiers: {
      lowSpeedFullEarnMinMph:   70,
      survivalDrainLoSpeedMult:  0.75,
      noPoliceWarning:           true,
      ticketSurcharge:           200,
      overfillGainMult:          0.50,
      drivingBonusEarningsMult:  0.80,
    },
  },

  pop_punk_emo: {
    key: 'pop_punk_emo',
    vehicleName: 'Tour Hatchback',
    topSpeedMph: 125,
    strengths: [
      'Repairs & basic upgrades −25%',
      'Driving bonus +50% below 25 HP',
    ],
    weaknesses: [
      'Max HP −15%; scenery impacts +20% damage',
      'Acceleration & fuel range −15%',
    ],
    modifiers: {
      repairUpgradeCostMult: 0.75,
      lowHpBonusMult:        1.50,
      lowHpBonusHp:          25,
      maxHpMult:             0.85,
      sceneryDamageMult:     1.20,
      accelerationMult:      0.85,
      fuelRangeMult:         0.85,
    },
  },

  norteno: {
    key: 'norteno',
    vehicleName: 'Custom Pickup',
    topSpeedMph: 130,
    strengths: [
      'Delivery/cargo missions pay +25%',
      'Cargo survives one minor collision',
      'Fuel range +30%',
    ],
    weaknesses: [
      'Snow/rough-road instability +25%; steering & braking −15%',
    ],
    modifiers: {
      cargoPayMult:          1.25,
      cargoCollisionShield:  1,
      fuelRangeMult:         1.30,
      hazardInstabilityMult: 1.25,
      steeringMult:          0.85,
      brakingMult:           0.85,
    },
  },
};

/** Resolve the ACTIVE genre trait, or null.
 *  A trait applies only when driving the STARTER (`beater`) with a culture set.
 *  Pure/derived — safe to call every frame; never writes to save state. */
export function genreTraitFor(genre, vehicleId) {
  if (vehicleId !== STARTER_VEHICLE_ID) return null;
  if (!genre) return null;
  return GENRE_VEHICLE_TRAITS[genre] ?? null;
}

/** The full modifier set for a trait, filled in with neutral defaults for every
 *  field it doesn't override. Accepts a trait object OR null (→ all-neutral). */
export function traitMods(trait) {
  return { ...MODIFIER_DEFAULTS, ...(trait?.modifiers ?? {}) };
}

/** Read ONE modifier field for a trait (or null) with its neutral default. */
export function mult(trait, field) {
  const v = trait?.modifiers?.[field];
  if (v === undefined) return MODIFIER_DEFAULTS[field];
  return v;
}

/** Player-facing top-speed cap in MPH for the active trait, or null when a
 *  non-genre vehicle should use its own VEHICLES.topMph. */
export function traitTopSpeedMph(trait) {
  return trait?.topSpeedMph ?? null;
}

/** Metal War Van: roll whether a weapon pickup grants a BONUS use.
 *  Pure + rng-injectable so it's unit-testable with controlled randomness. */
export function rollWeaponBonusUse(trait, rng = Math.random) {
  return rng() < mult(trait, 'weaponBonusUseChance');
}

/** Damage below this counts as a "minor" collision for the Norteño cargo shield. */
export const CARGO_MINOR_DMG = 12;

/** Norteño Custom Pickup: does this collision get ABSORBED by the cargo shield?
 *  Cargo survives ONE minor collision per run — pure/testable, the caller owns
 *  the `alreadyUsed` flag (reset on scene restart so it can't double-apply). */
export function cargoShieldAbsorbs(trait, alreadyUsed, damageAmount, minorThreshold = CARGO_MINOR_DMG) {
  return !alreadyUsed && mult(trait, 'cargoCollisionShield') > 0 && damageAmount > 0 && damageAmount <= minorThreshold;
}
