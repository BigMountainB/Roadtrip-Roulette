// ── Per-cop driving profiles ───────────────────────────────────────────────
//
// WHY THIS EXISTS
// Pursuit speed used to be computed from the player's: `reactSpd + closing`,
// `playerSpeed * 0.80`, `reactSpd * SETTLE_SPEED_MULT`. Lagging the input made
// the copying late, not absent — every cruiser still converged on one speed,
// which is what read as a hive mind. A cop's speed now comes from its own
// acceleration, braking and ceiling; the player's speed is an OBSERVATION that
// feeds decisions, never a value that is assigned.
//
// UNITS
// Everything here is world units/sec, converted from mph through the same
// MAX_SPEED/120 scale the rest of the game uses. Literal mph never reaches
// movement code — see mph() below.
//
// NO PHASER
// Plain data and plain functions, so the whole behavior layer is testable
// without a scene. CopSystem owns the Phaser-facing objects.

import { MAX_SPEED } from '../constants.js';

/** mph → world units/sec, the project's one conversion. */
export const mph = (m) => MAX_SPEED * (m / 120);

/**
 * Bounded archetypes. Ranges are [min, max] and rolled once at spawn, so two
 * AGGRESSIVE cops differ from each other while both still read as aggressive.
 *
 * Speeds are mph. `accel`/`brake` are units/sec². `preferredGap` is in world
 * units (TAILGATE_GAP was 900 — these bracket it deliberately so no archetype
 * sits exactly on the old station distance).
 */
export const ARCHETYPES = {
  PATIENT: {
    maxSpeed: [96, 106], accel: [0.55, 0.75], brake: [0.85, 1.05],
    reaction: [0.55, 0.95], preferredGap: [1400, 2200],
    aggression: [0.15, 0.35], laneDiscipline: [0.75, 0.95],
    passTendency: [0.05, 0.15], attackCooldown: [5.5, 8.0],
    recoveryTime: [2.5, 4.0], steeringRate: [0.7, 1.0],
  },
  AGGRESSIVE: {
    maxSpeed: [104, 116], accel: [0.90, 1.20], brake: [0.70, 0.95],
    reaction: [0.30, 0.55], preferredGap: [600, 1050],
    aggression: [0.70, 0.95], laneDiscipline: [0.55, 0.80],
    passTendency: [0.25, 0.45], attackCooldown: [2.5, 4.0],
    recoveryTime: [1.2, 2.2], steeringRate: [1.1, 1.5],
  },
  INTERCEPTOR: {
    maxSpeed: [112, 126], accel: [0.95, 1.25], brake: [0.80, 1.00],
    reaction: [0.35, 0.60], preferredGap: [900, 1500],
    aggression: [0.45, 0.70], laneDiscipline: [0.70, 0.90],
    passTendency: [0.70, 0.95], attackCooldown: [4.0, 6.0],
    recoveryTime: [1.8, 3.0], steeringRate: [1.0, 1.4],
  },
  CAUTIOUS: {
    maxSpeed: [94, 104], accel: [0.50, 0.70], brake: [1.00, 1.30],
    reaction: [0.60, 1.00], preferredGap: [1600, 2600],
    aggression: [0.10, 0.25], laneDiscipline: [0.80, 0.98],
    passTendency: [0.02, 0.10], attackCooldown: [6.5, 9.5],
    recoveryTime: [3.5, 5.5], steeringRate: [0.6, 0.9],
  },
  ERRATIC: {
    maxSpeed: [98, 118], accel: [0.60, 1.20], brake: [0.60, 1.10],
    reaction: [0.35, 0.85], preferredGap: [700, 2000],
    aggression: [0.35, 0.80], laneDiscipline: [0.30, 0.60],
    passTendency: [0.20, 0.60], attackCooldown: [3.0, 6.5],
    recoveryTime: [1.5, 4.0], steeringRate: [0.9, 1.6],
  },
  HEAVY: {   // SWAT
    maxSpeed: [100, 110], accel: [0.35, 0.50], brake: [0.45, 0.65],
    reaction: [0.50, 0.85], preferredGap: [1100, 1800],
    aggression: [0.60, 0.85], laneDiscipline: [0.65, 0.85],
    passTendency: [0.05, 0.20], attackCooldown: [4.5, 7.0],
    recoveryTime: [2.5, 4.0], steeringRate: [0.5, 0.8],
  },
};

/** Star → archetype weights. Stars escalate by spawning FASTER, more
 *  aggressive drivers (owner's call) rather than by scaling a cop's ceiling
 *  off the player's speed — which is the coupling this refactor removes.
 *  A consequence, accepted deliberately: at 1★ a cruiser can genuinely be
 *  outrun, because its maxSpeed is its own and it is not pinned to yours. */
const MIX_BY_STAR = [
  ['PATIENT'],                                                   // 0 (unused)
  ['PATIENT', 'PATIENT', 'CAUTIOUS'],                            // 1★ observe
  ['PATIENT', 'CAUTIOUS', 'AGGRESSIVE'],                         // 2★
  ['AGGRESSIVE', 'PATIENT', 'ERRATIC', 'CAUTIOUS'],              // 3★
  ['AGGRESSIVE', 'INTERCEPTOR', 'ERRATIC', 'PATIENT'],           // 4★
  ['AGGRESSIVE', 'INTERCEPTOR', 'AGGRESSIVE', 'ERRATIC'],        // 5★
];

/** Star → multiplier on top speed and aggression. Modest: the archetype does
 *  most of the work, this just tilts the whole field as heat rises. */
const STAR_SPEED_MUL = [1.00, 0.94, 0.98, 1.02, 1.06, 1.10];
const STAR_AGGRO_MUL = [1.00, 0.70, 0.90, 1.05, 1.15, 1.30];

/** Small deterministic PRNG (mulberry32). Tests seed it; production seeds from
 *  Math.random once per spawn. Determinism is a hard requirement — profile
 *  values must be reproducible for a given seed. */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rng, lo, hi) => lo + rng() * (hi - lo);

/**
 * Build one cop's persistent profile. Called ONCE at spawn — never per frame.
 *
 * @param {object} o
 *   star      current wanted level (1-5), tilts the archetype mix
 *   swat      true → forced HEAVY
 *   rng       optional seeded generator (tests); defaults to Math.random
 *   archetype optional force, for tests
 */
export function makeProfile({ star = 1, swat = false, rng = Math.random, archetype } = {}) {
  const s = Math.max(0, Math.min(5, star | 0));
  const key = archetype
    ?? (swat ? 'HEAVY'
             : MIX_BY_STAR[s][Math.floor(rng() * MIX_BY_STAR[s].length)] ?? 'PATIENT');
  const A = ARCHETYPES[key];
  const spdMul = STAR_SPEED_MUL[s];
  const aggMul = STAR_AGGRO_MUL[s];

  return {
    archetype:      key,
    maxSpeed:       mph(pick(rng, ...A.maxSpeed) * spdMul),
    cruiseSpeed:    mph(pick(rng, ...A.maxSpeed) * spdMul * 0.88),
    // accel/brake are given as a fraction of maxSpeed per second, so a heavy
    // van and a fast interceptor both take a believable time to reach pace
    // rather than one number meaning different things at different top ends.
    accel:          pick(rng, ...A.accel),
    brake:          pick(rng, ...A.brake),
    reactionTime:   pick(rng, ...A.reaction),
    preferredGap:   pick(rng, ...A.preferredGap),
    aggression:     Math.min(1, pick(rng, ...A.aggression) * aggMul),
    laneDiscipline: pick(rng, ...A.laneDiscipline),
    passTendency:   pick(rng, ...A.passTendency),
    attackCooldown: pick(rng, ...A.attackCooldown),
    recoveryTime:   pick(rng, ...A.recoveryTime),
    steeringRate:   pick(rng, ...A.steeringRate),
  };
}

// Dispatch speed for a newly assigned cruiser. A patrol car joining a pursuit
// is doing highway speed, not qualifying-lap speed — it has to CATCH you, which
// is the whole tension. Spawning at COP_TOP_UNITS meant a cop materialised
// hundreds of feet back at 100+ mph with no room to brake, so its first act was
// a collision the game then scored as a deliberate ram at 1★.
const DISPATCH_MPH = [60, 80];

/**
 * Initial road speed for a rear pursuer, from its OWN profile.
 *
 * Never derived from the player's speed — a fast player is supposed to pull
 * away from a freshly dispatched cruiser at first. Clamped to the profile so a
 * slow archetype can never be dispatched above what it can sustain.
 */
export function dispatchSpeed(profile, rng = Math.random) {
  const raw = mph(DISPATCH_MPH[0] + rng() * (DISPATCH_MPH[1] - DISPATCH_MPH[0]));
  return Math.min(raw, profile.cruiseSpeed, profile.maxSpeed);
}

/**
 * Distance a cop needs to shed its closing speed, using its OWN braking.
 * `closing` is cop.speed - observedPlayerSpeed; zero or negative means the cop
 * is not gaining and needs no braking room.
 */
export function stoppingDistance(closing, profile, grip = 1) {
  if (closing <= 0) return 0;
  const decel = Math.max(1, profile.brake * profile.maxSpeed * grip);
  return (closing * closing) / (2 * decel);
}

/**
 * Integrate one cop's speed toward a tactical target using ITS OWN
 * acceleration and braking. This is the whole point of the refactor: the
 * target may be chosen by looking at the player, but the SPEED is the cop's.
 *
 * @param  {number} speed    current cop speed, units/sec
 * @param  {number} target   desired speed, units/sec
 * @param  {object} profile
 * @param  {number} dt
 * @param  {number} grip     0..1 weather grip; scales both accel and brake
 * @return {number} new speed, clamped to [0, profile.maxSpeed]
 */
export function integrateSpeed(speed, target, profile, dt, grip = 1) {
  const cap = profile.maxSpeed;
  const want = Math.max(0, Math.min(cap, target));
  // Rates are fractions of the cop's own top speed per second.
  const aRate = profile.accel * cap * grip;
  const bRate = profile.brake * cap * grip;
  if (want > speed) return Math.min(want, speed + aRate * dt);
  if (want < speed) return Math.max(want, speed - bRate * dt);
  return speed;
}
