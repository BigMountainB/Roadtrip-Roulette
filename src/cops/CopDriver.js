// ── One cop's driving brain ────────────────────────────────────────────────
//
// Takes a cop's profile, its delayed observation of the player, and the role
// the PursuitDirector handed it. Returns COMMANDS — a target speed, a target
// lane, an intention. It never writes cop.speed; CopProfiles.integrateSpeed
// does that from the cop's own acceleration and braking.
//
// REACTION TIME IS PERCEPTION, NOT VELOCITY
// The old system lagged the player's speed and then assigned it. Here the lag
// decides WHEN a cop refreshes what it believes about the player; between
// refreshes it keeps executing its previous decision. That is what lets a cop
// brake late when the player brakes, instead of adopting the player's new
// speed a beat later.
//
// INTENTIONS PERSIST
// An intention lasts 1-4s. Nothing here is re-rolled per frame — no random
// steering noise, no per-frame lane choice. Variation comes from the profile
// and from intention transitions, then gets smoothed by the physics.

import { integrateSpeed } from './CopProfiles.js';

/** Intention → how long it holds, in seconds [min, max]. */
const HOLD = {
  follow:   [2.0, 4.0],
  close:    [1.5, 3.0],
  hold:     [2.0, 3.5],
  pressure: [1.8, 3.0],
  pass:     [2.5, 4.0],
  block:    [2.0, 3.5],
  ram:      [1.0, 2.0],
  pit:      [1.0, 2.0],
  recover:  [1.5, 3.0],
  overshoot:[1.0, 2.5],
};

/** Maneuver phases shared by ram and PIT: the readable attack loop. */
export const PHASE = { SETUP: 'setup', TELEGRAPH: 'telegraph', COMMIT: 'commit', RECOVER: 'recover' };
const TELEGRAPH_SEC = 0.65;   // visible "winding up" beat before contact
const COMMIT_SEC    = 1.10;   // bounded — an attack can miss and must end
// Gap-error gain, 1/sec. Higher closes harder and overshoots more; this value
// gives a visible but recoverable overshoot when the player brakes hard.
const GAP_K = 0.55;

/**
 * Refresh a cop's belief about the player, no more often than its reactionTime.
 * Mutates cop._obs in place (no allocation per frame).
 */
export function observe(cop, world, dt) {
  cop._obsT = (cop._obsT ?? 0) - dt;
  const o = (cop._obs ??= { speed: 0, pos: 0, lane: 0, braking: false, accelerating: false });
  if (cop._obsT > 0) return o;
  cop._obsT = cop.profile.reactionTime;
  const prev = o.speed;
  o.speed = world.playerSpeed;
  o.pos   = world.pursuitZ;
  o.lane  = world.playerX;
  // Derived from what the cop can actually see between its own glances.
  o.braking      = world.playerSpeed < prev - 1;
  o.accelerating = world.playerSpeed > prev + 1;
  return o;
}

/** Roll a fresh hold timer for an intention. */
function armHold(cop, intention, rng) {
  const [lo, hi] = HOLD[intention] ?? HOLD.follow;
  cop._intent   = intention;
  cop._intentT  = lo + rng() * (hi - lo);
}

/**
 * Choose an intention when the current one expires.
 *
 * `role` comes from the PursuitDirector and is the only cross-cop coupling:
 * it says what this unit is ALLOWED to do, not where it must be.
 */
export function chooseIntention(cop, world, role, rng) {
  const p   = cop.profile;
  const gap = world.pursuitZ - cop.position;    // >0 = cop is behind
  const o   = cop._obs ?? { speed: world.playerSpeed };

  // Ahead of the player without permission — this is an accidental overshoot
  // (usually because the player braked). Recover; never snap backward.
  if (gap < 0 && role !== 'blocker' && role !== 'passer') return armHold(cop, 'overshoot', rng);
  if (cop._recoverT > 0) return armHold(cop, 'recover', rng);

  if (role === 'passer')  return armHold(cop, 'pass', rng);
  if (role === 'blocker') return armHold(cop, 'block', rng);
  if (role === 'striker') {
    // A striker only commits if it is close enough that the attempt is
    // readable; otherwise it closes first.
    return armHold(cop, gap > p.preferredGap * 2.2 ? 'close' : (rng() < 0.5 ? 'ram' : 'pit'), rng);
  }
  if (role === 'wing')    return armHold(cop, 'pressure', rng);

  // Default follower: close if far, hold if near, follow otherwise. Aggression
  // biases toward closing so an aggressive cop sits nearer without being told.
  if (gap > p.preferredGap * 2.0) return armHold(cop, 'close', rng);
  if (gap < p.preferredGap * 0.8) return armHold(cop, 'hold', rng);
  return armHold(cop, rng() < p.aggression ? 'close' : 'follow', rng);
}

/**
 * Target speed for the current intention.
 *
 * SOFT GAP CONTROL: the preferred gap is a target that shapes throttle and
 * braking, never a position that is enforced. A cop may sit closer than it
 * likes, fall back, brake late, or overshoot — all of which are the point.
 */
function targetSpeed(cop, world) {
  const p    = cop.profile;
  const o    = cop._obs ?? { speed: world.playerSpeed };
  const gap  = world.pursuitZ - cop.position;
  const want = p.preferredGap;

  switch (cop._intent) {
    case 'overshoot':
    case 'recover':
      // Shed speed and let the player pull away, then rejoin naturally.
      return Math.max(0, Math.min(p.cruiseSpeed * 0.72, o.speed * 0.80));
    case 'block':
      // Ahead of the player, applying controlled forward pressure.
      return Math.max(0, o.speed * 0.86);
    case 'pass':
      return p.maxSpeed;
    case 'ram':
    case 'pit':
      // Commit phase runs flat out; setup/telegraph close at a readable rate.
      return cop._phase === PHASE.COMMIT ? p.maxSpeed : Math.min(p.maxSpeed, p.cruiseSpeed * 1.10);
    case 'close':
      return p.maxSpeed;
    case 'hold':
    case 'pressure':
    case 'follow':
    default: {
      // Proportional gap control — the standard car-following law.
      //
      // The TARGET is the observed player pace plus a term for how wrong the
      // gap is. This is the one place the player's speed legitimately enters:
      // it is an OBSERVATION feeding a decision, refreshed only at this cop's
      // reactionTime, and the result is a target the cop then has to REACH
      // through its own acceleration and braking. It is never assigned to
      // cop.speed, and it is clamped to this cop's own ceiling — so a cruiser
      // slower than the player still falls behind no matter how large the gap
      // error grows.
      //
      // Without the pace term the cop targeted its own cruise speed and blew
      // past a slow player at 60+ mph, which is how the first cut of this
      // failed the "no cop gets in front" tests.
      const err = gap - want;
      const desired = o.speed + err * GAP_K;
      return Math.max(0, Math.min(p.maxSpeed, desired));
    }
  }
}

/** Target lane for the current intention, in road units (-1..1). */
function targetLane(cop, world) {
  const o = cop._obs ?? { lane: world.playerX };
  switch (cop._intent) {
    case 'pressure':
      return clampLane(o.lane + (cop._side ?? 1) * 0.34);
    case 'pass':
      return clampLane(o.lane + (cop._side ?? 1) * 0.45);
    case 'ram':
      return clampLane(o.lane);                       // straight up the middle
    case 'pit':
      return clampLane(o.lane + (cop._side ?? 1) * 0.16);   // rear quarter
    case 'block':
      return clampLane(o.lane);
    case 'overshoot':
    case 'recover':
      return clampLane(o.lane + (cop._side ?? 1) * 0.30);   // out of the line
    default:
      // Followers sit near the player's lane but keep their own slot, scaled
      // by lane discipline so a sloppy driver wanders wider.
      return clampLane(o.lane + (cop._slot ?? 0) * (1.15 - cop.profile.laneDiscipline));
  }
}

const clampLane = (v) => Math.max(-0.95, Math.min(0.95, v));

/**
 * Advance one cop for a frame. Mutates cop.speed / cop.laneOffset / intention
 * state; returns the command it acted on so callers and tests can inspect it.
 *
 * @param {object} world  { playerSpeed, pursuitZ, playerX, grip, star }
 * @param {string} role   from PursuitDirector
 */
export function driveCop(cop, world, role, dt, rng = Math.random) {
  observe(cop, world, dt);

  cop._recoverT = Math.max(0, (cop._recoverT ?? 0) - dt);
  cop._intentT  = (cop._intentT ?? 0) - dt;
  if (!cop._intent || cop._intentT <= 0) chooseIntention(cop, world, role, rng);

  // Maneuver phase clock — the readable SETUP → TELEGRAPH → COMMIT → RECOVER
  // loop. Bounded at every step so an attack can genuinely miss and end.
  if (cop._intent === 'ram' || cop._intent === 'pit') {
    cop._phase ??= PHASE.SETUP;
    cop._phaseT = (cop._phaseT ?? 0) - dt;
    const gap = world.pursuitZ - cop.position;
    if (cop._phase === PHASE.SETUP && gap < cop.profile.preferredGap * 1.1) {
      cop._phase = PHASE.TELEGRAPH; cop._phaseT = TELEGRAPH_SEC;
    } else if (cop._phase === PHASE.TELEGRAPH && cop._phaseT <= 0) {
      cop._phase = PHASE.COMMIT;   cop._phaseT = COMMIT_SEC;
    } else if (cop._phase === PHASE.COMMIT && cop._phaseT <= 0) {
      cop._phase = PHASE.RECOVER;
      cop._recoverT = cop.profile.recoveryTime;
      cop._attackCd = cop.profile.attackCooldown;
      armHold(cop, 'recover', rng);
    }
  } else {
    cop._phase = null;
  }
  cop._attackCd = Math.max(0, (cop._attackCd ?? 0) - dt);

  // ── Longitudinal: the cop's OWN physics ────────────────────────────────
  const want = targetSpeed(cop, world);
  cop.speed = integrateSpeed(cop.speed, want, cop.profile, dt, world.grip ?? 1);
  cop.position += cop.speed * dt;

  // ── Lateral: smooth steering, never per-frame randomness ───────────────
  const lane = targetLane(cop, world);
  const rate = cop.profile.steeringRate * (world.grip ?? 1) * dt;
  const d = lane - cop.laneOffset;
  cop.laneOffset += Math.abs(d) <= rate ? d : Math.sign(d) * rate;

  return { intention: cop._intent, phase: cop._phase, targetSpeed: want, targetLane: lane };
}

/** True only while a PIT is genuinely committing — the compatibility signal
 *  GameScene's collision path reads. Ordinary following that happens to create
 *  lateral proximity must NOT arm a PIT. */
export function pitCommitting(cop) {
  return cop._intent === 'pit' && cop._phase === PHASE.COMMIT;
}
