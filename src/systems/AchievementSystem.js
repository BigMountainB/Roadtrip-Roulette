// AchievementSystem — registry of achievement definitions + per-run
// progress tracking + persistent earned-set (highest tier per ID) saved
// to localStorage via SaveSystem.
//
// Each achievement has Bronze / Silver / Gold tiers tied to the
// difficulty earned on (Easy = bronze, Normal = silver, Hard = gold).
// Highest tier wins — re-earning on Normal upgrades a Bronze to Silver.
//
// Awarding pattern:
//   AchievementSystem.award('lifted', context)  → fires toast + persists
//   AchievementSystem.firstPickup(viceId)       → convenience for "first hit"
//   Run-state hooks (notePickupTotals, noteCleanRun, etc.) are called
//   from GameScene's update / event handlers.
//
// Toast UI lives in GameScene._showAchievementToast(def, tier) — this
// module just emits a callback.

import { Difficulty } from './Difficulty.js';
import { VICES } from '../constants.js';

// Per-vice "first-hit" achievements — fire on the first pickup of each
// vice.  `desc` reveals the mechanic and is REVEALED only after the
// vice is earned (collected).  `unlockHint` is shown before earning so
// the player knows how to find the vice in the first place.
const VICE_INFO = {
  [VICES.SUSHI]: {
    id:    'liquid_courage',
    label: 'RAW DEAL',
    icon:  '🍣',
    unlockHint: 'Available from the start — grab gas-station sushi off the road.',
    desc:  '7% per plate. Builds queasy double-vision & swerves. Lowers each other consumable bar above 45% by 5% per pickup. At 100%, sideswipes/corner clips sometimes don\'t damage you.',
  },
  [VICES.BURRITO]: {
    id:    'lifted',
    label: 'FOOD BABY',
    icon:  '🌯',
    unlockHint: 'Available from the start — grab a burrito off the road.',
    desc:  '12.5% per bite. Tolerance kicks in at 60%, plus the food-coma haze and no slow-driving penalty. Hold 100% for 10 mi → The Itis.',
  },
  [VICES.ENERGY]: {
    id:    'white_line_fever',
    label: 'WIRED',
    icon:  '⚡',
    unlockHint: 'Stay woozy (sushi > 30%) for 30 seconds total to unlock the energy stand.',
    desc:  '10% per shot. +4 mph top speed each pickup. Burns 7% off your sushi buzz. Jitter out at 100% — don\'t grab another at 90%+.',
  },
  [VICES.GUMMIES]: {
    id:    'tripping',
    label: 'SUGAR RUSH',
    icon:  '🍬',
    unlockHint: 'Be woozy AND stuffed at the same time (sushi & burrito both ≥ 30%).',
    desc:  '20% per handful. +8% saturation each hit. At 45% NPC traffic pulses in sync (±10 mph). At 65% a rainbow appears.',
  },
  [VICES.HOTDOG]: {
    id:    'acid_trip',
    label: 'MYSTERY MEAT',
    icon:  '🌭',
    unlockHint: 'Push your gummies bar past 50% to unlock the mystery-meat cart.',
    desc:  '25% per dog. +8% brightness each hit. At 60% your speedo caps at 60 mph but you keep gaining miles. At 90%+ B&W + 1.25× distance.',
  },
  [VICES.COMBO]: {
    id:    'nodding_off',
    label: 'VALUE MEAL COMA',
    icon:  '🍟',
    unlockHint: 'Drive at least 20% of the route (~mile 60) to find a combo meal.',
    desc:  '30% per combo. Tunnel vision deepens with each hit. At 15%+ every crash deducts 2 fewer HP.',
  },
  [VICES.COLDBREW]: {
    id:    'pill_mill',
    label: 'COLD BREW',
    icon:  '🥤',
    unlockHint: 'Crash into 50 NPC cars total — you\'ll need the caffeine after that.',
    desc:  '8.5% per bottle. Each pickup multiplies every consumable bar by 0.9. ±7 mph per pickup on NPC traffic (slows oncoming, speeds same-direction).',
  },
  [VICES.COMA]: {
    id:    'deaths_door',
    label: 'FOOD COMA',
    icon:  '😵',
    unlockHint: 'Push your combo bar past 50% to find the all-you-can-eat.',
    desc:  '55% per plate — two and you pass out cold. At 25%+ you phase through cars (no damage), but capped at 30% top speed.',
  },
  [VICES.SLUSHIE]: {
    id:    'k_hole',
    label: 'BRAIN FREEZE',
    icon:  '🧊',
    unlockHint: 'Push your hotdog bar past 40% to unlock the slushie machine.',
    desc:  '10% per cup. At 40%+ the camera tilts 5° per pickup. At 82%+ TV static buries the road.',
  },
  [VICES.CAFFEINE]: {
    id:    'tweaker',
    label: 'THE SHAKES',
    icon:  '☕',
    unlockHint: 'Peak your energy at 40%+, then come down to 0 and stay clean for 30 seconds.',
    desc:  '10% per pickup. +4 mph top speed each pickup, but +1 extra HP damage on every collision. Risk vs reward.',
  },
};

// Run-tracking achievements (the broader set — fire from event hooks).
const RUN_DEFS = {
  stone_cold_sober:  { label: 'CLEAN EATING',      icon: '🥗', desc: 'Finish a Pullman run without picking up any consumable.' },
  crystal_clean:     { label: 'CRYSTAL CLEAN',     icon: '✨', desc: 'Finish without ever raising a wanted star.' },
  iron_bladder:      { label: 'IRON BLADDER',      icon: '🚽', desc: 'Finish without using any rest stop.' },
  five_star_survivor:{ label: '5★ SURVIVOR',       icon: '⭐', desc: 'Hit 5★ wanted, then escape (stars decay back to 0).' },
  untouchable_1m:    { label: 'UNTOUCHABLE 1m',    icon: '🛡',  desc: '60 seconds straight, zero damage.' },
  untouchable_2m:    { label: 'UNTOUCHABLE 2m',    icon: '🛡',  desc: '120 seconds straight, zero damage.' },
  untouchable_3m:    { label: 'UNTOUCHABLE 3m',    icon: '🛡',  desc: '180 seconds straight, zero damage.' },
  untouchable_5m:    { label: 'UNTOUCHABLE 5m',    icon: '🛡',  desc: '300 seconds straight, zero damage.' },
  untouchable_run:   { label: 'UNTOUCHABLE',       icon: '🏆', desc: 'Finish a Pullman run without taking any damage.' },
  connoisseur:       { label: 'CONNOISSEUR',       icon: '🎩', desc: 'Trigger every named consumable combo in a single run.' },
  snowblind:         { label: 'SNOWBLIND',         icon: '❄️', desc: 'Cross Snoqualmie Pass during snow without crashing.  Normal+ only.' },
  permastoned:       { label: 'THE ITIS',          icon: '😴', desc: 'Hold the burrito bar at 100% for 10 in-game miles.' },
  trifecta:          { label: 'TRIFECTA',          icon: '🏅', desc: 'Pullman finish with Clean Eating + Crystal Clean + Iron Bladder.' },
  full_tank:         { label: 'STUFFED',           icon: '🍽',  desc: 'Bar one consumable to 99% without passing out.' },
  // Maxed-out family — one per pass-out-capable consumable.  Fires when the
  // bar reaches exactly 100% without the player passing out (which now only
  // happens on overflow past 100%).
  maxed_cocaine:     { label: 'MAXED ENERGY',      icon: '⚡', desc: 'Hit 99% energy shot without jittering out.' },
  maxed_heroin:      { label: 'MAXED COMBO',       icon: '🍟', desc: 'Hit 99% combo meal without passing out.' },
  maxed_rx:          { label: 'MAXED COLD BREW',   icon: '🥤', desc: 'Hit 99% cold brew without passing out.' },
  maxed_fentanyl:    { label: 'MAXED FOOD COMA',   icon: '😵', desc: 'Hit 99% food coma without passing out.' },
  maxed_ketamine:    { label: 'MAXED SLUSHIE',     icon: '🧊', desc: 'Hit 99% slushie without passing out.' },
  maxed_meth:        { label: 'MAXED CAFFEINE',    icon: '☕', desc: 'Hit 99% caffeine pills without passing out.' },
};

// Tier ordering — higher index = better.  Difficulty mode → tier id.
const TIER_BY_MODE = { easy: 'bronze', normal: 'silver', hard: 'gold' };
const TIER_RANK    = { bronze: 1, silver: 2, gold: 3 };
const TIER_COLOR   = { bronze: 0xCD7F32, silver: 0xC0C0C0, gold: 0xFFD700 };
// Cash reward paid on earning a trophy, by the difficulty it's earned on
// (owner 2026-07-18): Easy $5 → Normal $25 → Hard $50.
const TIER_REWARD  = { bronze: 5, silver: 25, gold: 50 };

let _onAward = null;       // toast callback set by GameScene

export const AchievementSystem = {
  /** Definitions accessible to UI for the achievements page. */
  viceDefs() { return VICE_INFO; },
  runDefs()  { return RUN_DEFS; },
  tierColor(tier) { return TIER_COLOR[tier] ?? 0xFFFFFF; },

  /** GameScene calls this once with a function that pops a toast. */
  setAwardCallback(cb) { _onAward = cb; },

  /** Earned set lives on the SaveSystem-backed registry as a plain map
   *  { [id]: 'bronze' | 'silver' | 'gold' }.  Returns the full map. */
  earned(registry) {
    const save = registry?.get?.('save');
    return save?.get?.('achievements') ?? {};
  },

  earnedTier(registry, id) {
    return this.earned(registry)[id] ?? null;
  },

  /** Award an achievement.  Persists the highest tier seen — Bronze on
   *  Easy, Silver on Normal, Gold on Hard.  Returns true if the badge
   *  upgraded (i.e. either first time or higher tier than before).
   *  Custom mode awards nothing — vice levels are user-set so there's
   *  no challenge baseline. */
  award(id, registry) {
    if (Difficulty.noScore?.()) return false;
    const tier = TIER_BY_MODE[Difficulty.mode()] ?? 'silver';
    const save = registry?.get?.('save');
    if (!save) return false;
    const owned = save.get('achievements') ?? {};
    const prev  = owned[id];
    if (prev && TIER_RANK[prev] >= TIER_RANK[tier]) return false;
    owned[id] = tier;
    save.set('achievements', owned);
    const def = VICE_INFO[Object.keys(VICE_INFO).find(k => VICE_INFO[k].id === id)] ?? RUN_DEFS[id];
    // Cash reward — paid by the tier earned; GameScene adds it to the score and
    // shows it on the toast. Only pays on an UPGRADE (first-time / higher tier),
    // so re-earning the same tier never double-pays.
    const reward = TIER_REWARD[tier] ?? 0;
    if (def && _onAward) _onAward({ id, tier, def, reward });
    try { window.__notif?.bump?.('trophy'); } catch (_) {}   // phone-menu red dot
    return true;
  },

  /** Convenience hook: award on first pickup of a vice. */
  firstPickup(viceId, registry) {
    const def = VICE_INFO[viceId];
    if (!def) return;
    this.award(def.id, registry);
  },
};
