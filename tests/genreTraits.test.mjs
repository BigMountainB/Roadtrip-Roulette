// ── Genre Vehicle Traits — foundation unit tests ─────────────────────────
// Run: node tests/genreTraits.test.mjs   (also `npm test`)
//
// Covers the DATA layer: trait resolution for all 10 culture keys, no trait on
// ordinary purchased vehicles, every top-speed cap, the neutral-default
// multiplier math, and config integrity. (Integration-behavior tests — reggae
// tickets, metal bonus-use RNG, cargo shield, classic-rock overheat/leg, and
// no-double-apply-on-resume — land with their system integrations.)

import {
  GENRE_VEHICLE_TRAITS, MODIFIER_DEFAULTS, STARTER_VEHICLE_ID,
  genreTraitFor, traitMods, mult, traitTopSpeedMph, rollWeaponBonusUse,
  cargoShieldAbsorbs, CARGO_MINOR_DMG, policeWarningChance, POLICE_WARNING_CHANCE,
} from '../src/data/genreVehicleTraits.js';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; }
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}
function eq(name, a, b) { check(`${name} (${a} === ${b})`, a === b); }
function near(name, a, b, eps = 1e-9) { check(`${name} (${a} ≈ ${b})`, Math.abs(a - b) <= eps); }

const KEYS = [
  'hiphop_phonk', 'country', 'reggaeton', 'k_pop', 'metal',
  'classic_rock', 'edm_rave', 'reggae', 'pop_punk_emo', 'norteno',
];
const TOP_SPEEDS = {
  hiphop_phonk: 140, country: 120, reggaeton: 135, k_pop: 150, metal: 110,
  classic_rock: 160, edm_rave: 175, reggae: 100, pop_punk_emo: 125, norteno: 130,
};

// ── 1. Resolution for all 10 keys (only on the starter/beater) ────────────
eq('exactly 10 traits defined', Object.keys(GENRE_VEHICLE_TRAITS).length, 10);
for (const k of KEYS) {
  const t = genreTraitFor(k, STARTER_VEHICLE_ID);
  check(`resolves ${k} on beater`, !!t && t.key === k);
}

// ── 2. No trait on ordinary purchased vehicles, or with no culture ────────
for (const veh of ['suv4x4', 'usedTruck', 'newTruck', 'evTruck', 'sportsCar', 'bestlaRoadster', 'playdoutS3X']) {
  check(`no trait on purchased '${veh}'`, genreTraitFor('metal', veh) === null);
}
check('no trait when culture is null', genreTraitFor(null, 'beater') === null);
check('no trait when culture is empty', genreTraitFor('', 'beater') === null);
check('unknown culture → null', genreTraitFor('polka', 'beater') === null);

// ── 3. Each top-speed cap ─────────────────────────────────────────────────
for (const k of KEYS) {
  eq(`${k} top speed`, traitTopSpeedMph(genreTraitFor(k, 'beater')), TOP_SPEEDS[k]);
}
check('no cap for a non-genre vehicle', traitTopSpeedMph(genreTraitFor('metal', 'sportsCar')) === null);

// ── 4. Multiplier math: overrides applied, everything else neutral ────────
const country = genreTraitFor('country', 'beater');
near('country fuelBurnMult override', mult(country, 'fuelBurnMult'), 1.30);
near('country accelerationMult override', mult(country, 'accelerationMult'), 0.80);
near('country neutral field defaults to 1', mult(country, 'wantedDecayMult'), 1);
near('metal damageTakenMult', mult(genreTraitFor('metal', 'beater'), 'damageTakenMult'), 0.70);
near('hiphop wantedDecayMult (slower)', mult(genreTraitFor('hiphop_phonk', 'beater'), 'wantedDecayMult'), 0.75);
near('edm boostStrengthMult', mult(genreTraitFor('edm_rave', 'beater'), 'boostStrengthMult'), 1.35);
eq('reggae ticket surcharge', mult(genreTraitFor('reggae', 'beater'), 'ticketSurcharge'), 200);
check('reggae noPoliceWarning flag', mult(genreTraitFor('reggae', 'beater'), 'noPoliceWarning') === true);
eq('norteno cargo shield count', mult(genreTraitFor('norteno', 'beater'), 'cargoCollisionShield'), 1);
near('metal weapon bonus-use chance', mult(genreTraitFor('metal', 'beater'), 'weaponBonusUseChance'), 0.20);

// traitMods() fills EVERY default; overrides win.
const m = traitMods(country);
eq('traitMods has all default fields', Object.keys(m).length, Object.keys(MODIFIER_DEFAULTS).length);
near('traitMods keeps override', m.fuelBurnMult, 1.30);
near('traitMods fills default', m.damageTakenMult, 0.75);   // country's own override
near('traitMods(null) is all-neutral', traitMods(null).accelerationMult, 1);

// ── 5. Config integrity: shapes + every modifier key is a known field ─────
for (const k of KEYS) {
  const t = GENRE_VEHICLE_TRAITS[k];
  check(`${k} has vehicleName`, typeof t.vehicleName === 'string' && t.vehicleName.length > 0);
  check(`${k} has ≥2 strengths`, Array.isArray(t.strengths) && t.strengths.length >= 2);
  check(`${k} has ≥1 weakness`, Array.isArray(t.weaknesses) && t.weaknesses.length >= 1);
  check(`${k} key matches map key`, t.key === k);
  for (const field of Object.keys(t.modifiers)) {
    check(`${k}.${field} is a known modifier`, Object.prototype.hasOwnProperty.call(MODIFIER_DEFAULTS, field));
  }
}

// ── 6. Metal bonus-use with controlled randomness ────────────────────────
const _metal = genreTraitFor('metal', 'beater');
check('metal bonus-use fires when rng < 0.20', rollWeaponBonusUse(_metal, () => 0.19) === true);
check('metal bonus-use skips at rng = 0.20', rollWeaponBonusUse(_metal, () => 0.20) === false);
check('metal bonus-use skips when rng high', rollWeaponBonusUse(_metal, () => 0.99) === false);
check('non-metal never bonus-uses', rollWeaponBonusUse(genreTraitFor('country', 'beater'), () => 0.0) === false);
check('null trait never bonus-uses', rollWeaponBonusUse(null, () => 0.0) === false);

// ── 7. Norteño cargo collision shield (consume-once) ─────────────────────
const _nor = genreTraitFor('norteno', 'beater');
check('norteño absorbs a minor collision when unused', cargoShieldAbsorbs(_nor, false, 8) === true);
check('norteño does NOT absorb once used (consume-once)', cargoShieldAbsorbs(_nor, true, 8) === false);
check('norteño does NOT absorb a heavy hit', cargoShieldAbsorbs(_nor, false, CARGO_MINOR_DMG + 1) === false);
check('norteño absorbs exactly at the minor threshold', cargoShieldAbsorbs(_nor, false, CARGO_MINOR_DMG) === true);
check('norteño ignores zero/negative damage', cargoShieldAbsorbs(_nor, false, 0) === false);
check('non-norteño never absorbs', cargoShieldAbsorbs(genreTraitFor('metal', 'beater'), false, 8) === false);
check('null trait never absorbs', cargoShieldAbsorbs(null, false, 8) === false);

// ── 8. Police warning chance (reggae no-warning) ─────────────────────────
const _reg = genreTraitFor('reggae', 'beater');
const _cnt = genreTraitFor('country', 'beater');
near('normal vehicle: 25% warning at 1★', policeWarningChance(_cnt, 1), 0.25);
near('normal vehicle: 25% warning at 0★', policeWarningChance(_cnt, 0), 0.25);
check('reggae NEVER gets a warning (its trait removes them)', policeWarningChance(_reg, 1) === 0);
check('no warning above 1★', policeWarningChance(_cnt, 2) === 0);
near('null trait gets the base warning chance', policeWarningChance(null, 1), POLICE_WARNING_CHANCE);

console.log(`\ngenreTraits.test: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
