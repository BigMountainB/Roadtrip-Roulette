/**
 * CopSystem — manages wanted level and cop vehicles.
 *
 * Three cop kinds:
 *   • 'pursuit-front'  — same direction as player, sits a few thousand
 *     units ahead, gravitates LATERALLY toward the player to set up PIT
 *     maneuvers and slow the player down so rear cops can close.
 *   • 'rear'           — same direction, behind player, ALWAYS closing
 *     the gap (constant +8% closing rate), tries to rear-end the player.
 *   • 'oncoming'       — head-on, travels in the OPPOSING direction
 *     (negative speed). Spawns in left lanes at 3★, all lanes at 4★+.
 *
 * Bust thresholds (any one trips it → BUSTED):
 *   • 5 rear-end bumps from 'rear' cops
 *   • 3 head-on collisions with 'oncoming' cops
 *   • 3 successful PIT maneuvers (alongside side-swipe by 'pursuit-front')
 *
 * Per-star spawn matrix + aggression (chase-realism pass, owner 2026-07-31):
 *   1★  → a single rear cruiser that TAILS — holds station, never strikes.
 *         Witnessed erratic driving (civilian collision, 90+ mph, wrong side
 *         of the double-yellow) → backup call: +1★, capped at 3★.
 *   2★  → rear cops (cap scales up); rams + PIT attempts begin (5 s hold,
 *         strikes every ~5-8.5 s, one striker at a time)
 *   3★  → + oncoming cops (left lanes only); shorter holds, faster strikes
 *   4★  → + oncoming cops (any lane), SWAT, overtake tokens (cops may lead)
 *   5★  → all of the above at maximum density + barricades + helicopter
 * Wanted decay pauses while any pursuer is within EYES_ON_FT of the car.
 *
 * Top speed for every cop: COP_TOP_MPH.  Rear cops close unless the
 * player is already faster than that ceiling.
 *
 * F12 tokens (f12_coal / f12_fireworks / f12_paint → normalized):
 *   'coal'        — Rolling Coal: rear diesel-smoke cloud, pursuers lose sight
 *   'fireworks'   — show over the car: EVERY vehicle on screen blows up (+1★)
 *   'paint_bomb'  — 'Donuts': every cop stops chasing for 15s (no kills)
 *   'disguise'    — resets stars + cops entirely (hitchhiker reward)
 */
import {
  MAX_STARS, STAR_DECAY, MAX_SPEED, ROUTE_SEGS, SEG_LENGTH, TOTAL_ROUTE_MILES,
  COP_REAR_BUMPS_TO_ARREST,
  COP_HEADONS_TO_ARREST, COP_PITS_TO_ARREST, COP_TOP_MPH, PLAYER_VIRTUAL_Z,
} from '../constants.js';
import { clamp } from '../utils/Helpers.js';
import { Difficulty } from './Difficulty.js';
import { TimeOfDay } from '../world/TimeOfDay.js';
import { Weather }   from '../world/Weather.js';
import { makeProfile, integrateSpeed, dispatchSpeed, stoppingDistance } from '../cops/CopProfiles.js';
import { driveCop, pitCommitting } from '../cops/CopDriver.js';
import { PursuitDirector, spacingBias } from '../cops/PursuitDirector.js';
import { DeployableField, DONUT_DIVERT_BY_STAR, DONUT_IMMUNE_SEC, PUFF_LIFE, CL } from './Deployables.js';

// Cop top speed in internal world units.  MAX_SPEED is the player's 120 mph
// reference, so COP_TOP_MPH / 120 × MAX_SPEED is the cop's cap.
const COP_TOP_UNITS    = MAX_SPEED * (COP_TOP_MPH / 120);
// How fast oncoming traffic closes on the player (negative-direction speed
// in the world frame).  ~70 mph relative to a stationary world.
const ONCOMING_UNITS   = MAX_SPEED * (70 / 120);

// Fleeing-cop removal is POSITION-driven: a smoked/scattered cop stays alive
// until it has receded past the bottom of the forward view (rel <= 0 is
// already off-screen; FLEE_DESPAWN_REL adds margin so it's also tiny in the
// rear-view mirror before it's spliced).  FLEE_MAX_SEC is only a lifetime
// FAILSAFE (e.g. player at a dead stop — the cop can't recede at 35% of
// zero speed), never the primary removal trigger.
const FLEE_MAX_SEC     = 6;
const FLEE_DESPAWN_REL = -6000;   // world units behind the player at despawn
const FLEE_FADE_SPAN   = 9000;    // alpha ramps 1→0 over rel 3000 → -6000
// ── Synthetic bottom-edge exit ──────────────────────────────────────────
// getVehicleProjection() can't project a vehicle once rel drops below the
// visible band (which starts well AHEAD of the player's own virtual depth —
// see the 2026-07-14 traffic-stop fix, where the parked trooper had to sit
// at +4400 to render).  A fleeing cop therefore used to blink out
// mid-screen the frame its rel crossed the projection floor.  Instead we
// track an EXIT PROGRESS (0→1) as rel falls from FLEE_EXIT_HOLD_REL (the
// last reliably-projectable depth) down to FLEE_EXIT_HOLD_REL −
// FLEE_EXIT_SPAN: the renderer clamps the cop's draw depth at the hold
// value and drives its screen-Y down past the bottom edge with this
// progress, so the cruiser visibly sinks off the screen before it fades.
export const FLEE_EXIT_HOLD_REL = 4400;
export const FLEE_EXIT_SPAN     = 7400;   // exit completes at rel ≈ -3000
// Rolling coal that actually smokes a pursuer buys a real lull: NO new cop
// spawns for 30 s (stars persist — pursuit just doesn't remanifest).
const COAL_LULL_SEC = 30;
// ── Pursuit reference frame ─────────────────────────────────────────────
// The player's CAR is rendered PLAYER_VIRTUAL_Z units AHEAD of
// player.position (which is the camera/physics origin).  Collision detection
// and the rear-view mirror both measure from the car; the pursuit AI used to
// measure from the camera, so a rear cop "caught" the player 3000 units short
// of the bumper — six times the ±CAR_LEN_Z collision window — and then
// throttled to 0.92x.  It could close on the camera forever and never touch
// the car or fill the mirror.  Rear pursuit now targets the car.
const UNITS_PER_MILE   = (ROUTE_SEGS * SEG_LENGTH) / TOTAL_ROUTE_MILES;
// Escape distance: get this far ahead of a pursuer and you have genuinely
// lost it (owner 2026-07-27).  This replaces the old ~1000 ft cull, which was
// short enough to delete cops the same tick they spawned.
const COP_ESCAPE_MILES = 1.5;
const COP_ESCAPE_UNITS = UNITS_PER_MILE * COP_ESCAPE_MILES;

// ── Chase discipline (police-chase spec, owner 2026-07-28) ──────────────
// A pursuer may only get IN FRONT of the player at 4-5 stars.  Below that,
// blocking / overtaking / PIT are unreachable and two guards enforce it.
const MIN_STARS_AHEAD = 4;

// Car length in world units.  Derived, not guessed: LANE_DASH_LEN (3) x
// SEG_LENGTH (200) = 600 units per dash, and a US-standard highway dash is
// 10 ft, giving ~60.8 units/ft.  The spec's 5 m car length is therefore
// ~997 units — which also matches CAR_LEN_Z (500) being the HALF-length.
const CAR_LENGTH_Z = 1000;

// GUARD 1 — speed ceiling as a MULTIPLE of the player's speed, never an
// absolute cap, so it holds at any speed.  Indexed by star 1-5 (0 unused).
const SPEED_CAP_BY_STAR = [1.03, 1.03, 1.06, 1.08, 1.15, 1.25];

// GUARD 2 — the hard positional clamp, and the one that actually fixes the
// reported bug: a speed ceiling alone still lets a cop drift past whenever
// the player brakes harder than the cop can decelerate (braking for a
// corner is the exact repro).
//
// The spec's star-scaled `minGap` standoff was DROPPED (owner call): a 25 CL
// gap at 1 star put the cop 410 ft back and made the low-star ram
// unreachable.  The invariant is simply "never exceed the player's depth".
//
// TAILGATE_GAP is NOT that standoff — it is collision hygiene.  Pinning a
// cop at exactly the player's depth would hold it inside the +/-CAR_LEN_Z
// hit box permanently, registering a ram every frame and busting the player
// instantly.  A cop parks just clear of the box instead, and a cop actively
// making a strike is exempt so bumping still lands.
// ── Overtake tokens (spec §3) ───────────────────────────────────────────
// A unit may only pass the player while HOLDING a token, and tokens only
// exist at 4-5 stars.  This is what makes "getting in front" a scarce,
// deliberate event rather than whoever happens to be fastest.
const TOKEN_POOL_BY_STAR   = [0, 0, 0, 0, 1, 2];   // index by star tier
const TOKEN_MAX_GAP        = 12 * CL;   // must be this close to even ask
const TOKEN_LANE_CLEAR     = 20 * CL;   // pass lane clear for this far ahead
const TOKEN_GRANT_COOLDOWN = 8;         // no two grants inside this window
const TOKEN_HOLD_MAX       = 15;        // forced return after this long
const TOKEN_RETURN_COOLDOWN = 6;        // unit can't re-request for this long

// ── Onramp reinforcements (spec §3) ─────────────────────────────────────
// At 4-5 stars fresh units merge from an onramp AHEAD of the player rather
// than sprinting past from behind — far more believable than a rear cruiser
// overtaking at 120 mph, and it's how a real interdiction is set up.
const ONRAMP_MIN_STARS   = 4;
const ONRAMP_INTERVAL    = [0, 0, 0, 0, 14, 9];   // seconds between merges, by tier
// 18-30 CL ahead, NOT 40-70: the rear-cop far cull fires at dist > 30000, so
// a reinforcement seeded past that was culled on the very frame it merged —
// the same spawn-outside-the-despawn-window bug that used to delete half of
// all star-driven spawns.  Onramp units are also exempted from that cull
// below while they still hold their token.
const ONRAMP_AHEAD_MIN   = 18 * CL;
const ONRAMP_AHEAD_SPAN  = 12 * CL;

// ── Forward counter (spec §6) ───────────────────────────────────────────
// At 4-5 stars, leaning on a blocker's rear bumper for PUSH_THROUGH_SEC
// shoves it aside and spins it out, at a cost in HP scaled to closing speed.
const PUSH_THROUGH_SEC   = 1.2;
const PUSH_CONTACT_Z     = 1.4 * CL;   // how close counts as "on its bumper"
const PUSH_HP_PER_SPEED  = 6.0;        // HP at full speed; scales linearly

// Where a pursuer SITS.  This is a RENDERING constraint as much as a driving
// one (owner 2026-07-31: "if it's going to hold station then I want it to do
// it on the game screen. I want to see the cop").
//
// The camera sits PLAYER_VIRTUAL_Z (3000) behind the player's car, so a cop
// `gap` units back projects at camera-relative 3000-gap.  Measured against the
// live projection: 1800 back = camera-rel 1200 = NO PROJECTION AT ALL (below
// the floor — it can only ever appear in the mirror), while 900 back = 2100 =
// screen y 357 at 1.3x the player's width: plainly visible, plainly BEHIND and
// nearer the camera.  So the standoff is ~15 ft, not the ~30 ft a real traffic
// stop holds — the honest distance is literally undrawable here.
// Still clear of the +/-CAR_LEN_Z (500) ram window, which is what this gap was
// for originally: a parked cop must not register a ram every frame.
const TAILGATE_GAP  = 900;
// Minimum legal separation for a PROFILED pursuer. Not a following distance —
// purely the anti-overlap floor. Preferred gaps live in the cop profiles.
const OVERLAP_MIN   = 240;
// How far back a pursuer still steers into the player's lane.  Must exceed
// TAILGATE_GAP or a cop at station never lines up behind you.
const LANE_TRACK_Z  = 2200;
// PIT arming is a different, tighter thing: the cop has to be genuinely
// alongside, not merely tracking your lane from behind.
const PIT_ARM_Z     = 800;
// How much road a pursuer gets to shed speed in before the standoff.  The
// speed ceiling applies ONLY inside this band (~35 ft): outside it the cruiser
// runs at its own pace regardless of what the player's throttle is doing.
// ~200 ft.  Long enough that a cruiser DRIFTS into view and settles instead of
// arriving all at once: at 135 mph against a 60 mph player it takes ~3.5 s to
// cross, easing the whole way (owner 2026-07-31: "cops should slowly enter the
// game screen").  Outside it they run at their own pace, untouched.
const APPROACH_BAND = 12000;

// World units per foot, derived from the route definition (see UNITS_PER_MILE).
const FT = UNITS_PER_MILE / 5280;
// Where a pursuit STARTS, measured from the player's CAR.  Was 100-280 ft,
// which at a 110 mph closing rate is under two seconds of warning — the owner
// was being rammed before the cruiser was ever visible.  A chase should open
// with a siren in the distance.
const SPAWN_BEHIND_FT_MIN  = 800;
const SPAWN_BEHIND_FT_SPAN = 400;
// How close to TAILGATE_GAP counts as "on station".  The hold clock runs ONLY
// inside this — measured from a first attempt that let it tick across the whole
// approach, so the cruiser arrived with the timer already spent and struck
// within a third of a second of settling.
// How far a cruiser must drop back before it counts as having LEFT station
// (~25 ft).  Only used to clear the flag; arrival is detected by the clamp.
const STATION_TOL = 1500;
const SETTLE_SPEED_MULT = 0.98;   // pinned cops settle rather than stick

// ── Ram lunges ──────────────────────────────────────────────────────────
// A pursuer holds TAILGATE_GAP and periodically COMMITS to a strike, then
// falls back.  This replaces a permanent exemption (any cop within a flat
// RAM_STRIKE_Z of the bumper was allowed to ignore the standoff), which let a
// cruiser park at the player's exact depth indefinitely — the "cops drive
// alongside me instead of behind me" report — and let it re-register a rear
// ram every single frame while it sat there.
//
// STAR-SCALED (owner 2026-07-31 chase-realism pass): 1★ is a TAIL, not an
// attack — the lone cruiser holds station and NEVER strikes; pressure comes
// from the backup-call clock (see BACKUP below).  Strikes (rams + PITs)
// begin at 2★; 3★+ holds shorter and hits more often.  Arrays are indexed by
// the displayed star tier (0-1 unused by the strike scheduler).
const RAM_MIN_STARS = 2;
// Time a cruiser must sit on station before its FIRST strike, by tier.
const FIRST_HOLD_BY_STAR     = [0, 0, 5.0, 2.5, 2.0, 1.5];
// Seconds between attempts… plus up to SPAN more, randomised per attempt.
const LUNGE_GAP_MIN_BY_STAR  = [0, 0, 5.0, 3.5, 2.8, 2.2];
const LUNGE_GAP_SPAN_BY_STAR = [0, 0, 3.5, 2.2, 1.8, 1.5];
const LUNGE_SEC      = 2.5;    // how long the standoff stays lifted
const LUNGE_CLOSE_MIN = 900;   // floor on the closing rate during a lunge
// PIT attempts begin here (owner 2026-08-01): an alongside rear-quarter tap
// is a PURSUIT manoeuvre, exempt from the no-lead rule — blocking/overtaking
// still needs MIN_STARS_AHEAD.  At 1★ the tail never arms one.
const MIN_STARS_PIT = 2;

// ── Backup calls + eyes-on (owner 2026-07-31 chase-realism pass) ────────
// A pursuer within EYES_ON_FT of the car "has eyes on you":
//   • wanted decay PAUSES — you can't wait out a star with a cruiser on your
//     bumper; shake it (COP_ESCAPE_MILES), use a weapon, or hit a rest stop.
//   • erratic driving is WITNESSED and radioed in: +1 whole star, capped at
//     3★ via addStar's sourceCap (weapons stay the only path to 4-5★).
// Erratic = a civilian-car collision (reported by GameScene), or ~2 s
// sustained across the double-yellow / at 90+ mph.  Clean driving is never
// escalated — a 1★ tail can follow forever.
const EYES_ON_FT          = 1000;
const ERRATIC_SUSTAIN_SEC = 2;     // continuous kinds must persist this long
const ERRATIC_MPH         = 90;
const BACKUP_COOLDOWN_SEC = 15;    // min gap between consecutive calls
// Rolling-coal recede (owner 2026-07-17): the smoked cop KEEPS PACE with the
// player for this many seconds, then slows to 0.45× and falls back, dropping
// off the bottom edge the same way it drove in (pure positional recede — no
// synthetic slide, no in-place fade).
const COAL_PACE_SEC = 1.5;
// Rolling-coal TOUCH model (owner 2026-07-22): the smokescreen hangs on the
// road behind the car; a cop is affected once it's IN the cloud (at fire, or
// by driving into it while it lives). On contact the cop BREAKS PURSUIT and
// smoke-outs — the _fleeNoSwerve flee: keeps pace COAL_PACE_SEC, then sinks
// straight back into the smoke and despawns (lost sight of you entirely).
// Replaces the old 60 mph / 30 s slow-cap, which kept the cop visibly on the
// player's tail — at ≤60 mph it read as "the first cop withstood the coal".
const COAL_CLOUD_LIFE = 5;                        // s the hanging smoke can still catch a pursuer
const COAL_CLOUD_BACK = 10000;                    // road length of smoke BEHIND the belch point
const COAL_CLOUD_FRONT = 1500;                    // slack ahead (alongside rammers in the plume)

// Normalize raw sprite token names → internal names used in useF12Token
const TOKEN_MAP = {
  f12_coal:   'coal',
  f12_fireworks: 'fireworks',
  f12_paint:  'paint_bomb',
};

export class CopSystem {
  constructor() {
    this._director = new PursuitDirector();
    this.stars         = 0;
    this.starTimer     = 0;
    this.cops          = [];
    this.f12Tokens     = [];
    // Rolling-coal charge pool — each pickup adds 1 cloud (cap 3, same as
    // every other weapon).  The 'coal' token in f12Tokens is present whenever
    // coalAmmo > 0; each fire burns a charge, and the token is removed
    // when the pool hits 0.
    this.coalAmmo      = 0;
    this.lastStateLine = -1;

    // Cop-diverted counters (trip-summary stat) — accumulated here since
    // CopSystem alone knows the instant a pursuit genuinely ends via a
    // weapon (coal/donut/fireworks) vs the player just out-running the
    // cruiser.  GameScene drains this once per frame and forwards to
    // StatsTracker; kept as plain counters so instrumentation can't affect
    // any existing chase behaviour.
    this._diverted = { weapon: 0, distance: 0 };

    // World-space donut boxes + coal puffs.  Replaces the old longitudinal
    // band filters, which could not reach a cop in front of the player.
    this.deployables = new DeployableField();

    // Overtake-token bookkeeping.  `_tokenHadTurn` is the fairness set: a unit
    // cannot take a SECOND token until every other live unit has had one, so
    // the same cruiser can't monopolise every pass.
    this._tokensOut      = 0;
    this._lastGrantAt    = -Infinity;
    this._tokenClock     = 0;
    this._tokenHadTurn   = new Set();
    this._starLevel      = 0;    // latched display level; see _syncStarLevel()
    this._onrampTimer    = 0;
    this._pushThrough    = 0;    // seconds of sustained bumper contact

    this._spawnCooldown = 0;
    this._flashTimer    = 0;
    this.lightFlash     = false;
    // Backup-call state (chase-realism pass).  `backupCalled` holds the
    // reason string until GameScene drains it for the HUD beat.
    this._eyesOn        = false;
    this._erraticT      = 0;
    this._backupCd      = 0;
    this.backupCalled   = null;
    // Donut pursuit-freeze countdown (seconds).  While > 0 every cop
    // stops dead and no fresh pursuit spawns.  Set by the 'paint_bomb' token.
    this._donutPauseTimer = 0;

    // Arrest tracking — type-specific counters; any one tripping its
    // threshold sets arrestPending true.  bumpCount is the legacy generic
    // total still surfaced in the HUD ("BUMPS x/3" → "x/8" now).
    this.bumpCount       = 0;
    this.rearBumpCount   = 0;
    this.headOnCount     = 0;
    this.pitCount        = 0;
    this.arrestPending   = false;
  }

  /** Triggered by GameScene when the player passes a random roadside cop
   *  with stars ≥ 1.  Spawns a rear-pursuit cop closing in from behind so
   *  the encounter has consequence. */
  _spawnRearFromEncounter(playerPos) {
    const _p1 = this._newPursuitProfile(false);
    const _p1Speed = dispatchSpeed(_p1);
    // Rolling-coal lull — route encounters don't manifest pursuers either.
    // Returns the spawned cop (or null when the lull gated it) so callers
    // can tell whether anything actually hit the road — _spawnTrapPursuit
    // used to assume cops[last] was its fresh spawn, which mis-tagged a
    // RANDOM existing cop as the trap trooper during the lull (2026-07-23).
    if ((this._coalLull ?? 0) > 0) return null;
    const cop = {
      id:          Math.random(),
      // Measured to the CAR (playerPos + PLAYER_VIRTUAL_Z), not the camera.
      position:    playerPos + PLAYER_VIRTUAL_Z
                   - (SPAWN_BEHIND_FT_MIN + Math.random() * SPAWN_BEHIND_FT_SPAN) * FT,
      // Travel lanes only (owner 2026-07-31: "why are they in the oncoming
      // traffic?").  The road runs -1..+1 with the double-yellow at 0, so the
      // old (rand-0.5)*0.6 straddled the centerline and put HALF of all
      // pursuers on the oncoming side.  0.2-0.8 keeps them in the two
      // right-hand lanes, where a car chasing you actually drives.
      laneOffset:  0.2 + Math.random() * 0.6,
      // Profile first, then speed from it — a roadside unit pulling out is
      // doing road speed, not top speed (see dispatchSpeed).
      speed:       _p1Speed,
      baseSpeed:   _p1Speed,
      profile:     _p1,
      side:        'rear',
      kind:        'rear',
      colorSet:    'police',
      color:       0xFFFFFF,
      alive:       true,
      painted:     false,
      _recoverT:   0,
      _attackCd:   0,
      _closeFactor: 0.10 + Math.random() * 0.06,
      _laneDrift:   0.4  + Math.random() * 0.4,
    };
    this.cops.push(cop);
    return cop;
  }

  /**
   * Grant / hold / revoke overtake tokens.  Called once per frame BEFORE the
   * per-cop AI so a unit's `_overtakeToken` is current when the anti-pass
   * guards read it.
   *
   * A token is the ONLY way a unit may exceed the player's depth.  Pool size
   * is 0 below 4 stars, so the guards are absolute there by construction.
   */
  _tickOvertakeTokens(dt, pursuitZ, playerX) {
    this._tokenClock += dt;
    const tier = Math.max(0, Math.min(5, this._syncStarLevel()));
    const pool = TOKEN_POOL_BY_STAR[tier];

    // ── Revoke: demotion, death, flight, or the 15 s hold expiring ────────
    let out = 0;
    for (const cop of this.cops) {
      if (!cop._overtakeToken) continue;
      const expired = (this._tokenClock - cop._overtakeToken.at) > TOKEN_HOLD_MAX;
      if (pool === 0 || expired || cop.fleeing || cop.parked || !cop.alive) {
        cop._overtakeToken   = null;
        cop._tokenCooldownAt = this._tokenClock;   // 6 s before it may re-ask
        // NOT teleported: the demotion branch in update() lets it decelerate
        // until the player passes it.
      } else {
        out++;
      }
    }
    this._tokensOut = out;
    if (pool === 0) return;

    // ── Grant: at most one per TOKEN_GRANT_COOLDOWN ──────────────────────
    if (out >= pool) return;
    if (this._tokenClock - this._lastGrantAt < TOKEN_GRANT_COOLDOWN) return;

    // Fairness: once every live unit has had a turn, the set resets and
    // everyone is eligible again.
    const live = this.cops.filter(c => c.alive && !c.fleeing && !c.parked && c.kind === 'rear');
    if (live.length && live.every(c => this._tokenHadTurn.has(c.id))) this._tokenHadTurn.clear();

    let best = null, bestGap = Infinity;
    for (const cop of live) {
      if (cop._overtakeToken) continue;
      if (this._tokenHadTurn.has(cop.id)) continue;                  // wait your turn
      if (this._tokenClock - (cop._tokenCooldownAt ?? -Infinity) < TOKEN_RETURN_COOLDOWN) continue;
      const gap = pursuitZ - cop.position;                            // >0 = behind
      if (gap < 0 || gap > TOKEN_MAX_GAP) continue;                   // must be close
      if (!this._passLaneClear(cop, playerX)) continue;
      if (gap < bestGap) { best = cop; bestGap = gap; }
    }
    if (!best) return;

    best._overtakeToken = { at: this._tokenClock };
    this._tokenHadTurn.add(best.id);
    this._lastGrantAt = this._tokenClock;
  }

  /**
   * Is the lane this unit would pass through clear for TOKEN_LANE_CLEAR ahead?
   *
   * Checks other POLICE units only — CopSystem has no handle on civilian
   * traffic, so a pass can still be attempted into occupied traffic.  Wiring
   * traffic in would mean threading it through update(); noted rather than
   * faked, since a fake check that always passes is worse than none.
   */
  _passLaneClear(cop, playerX) {
    const passLane = cop.laneOffset <= playerX ? playerX - 0.5 : playerX + 0.5;
    for (const other of this.cops) {
      if (other === cop || !other.alive) continue;
      const ahead = other.position - cop.position;
      if (ahead <= 0 || ahead > TOKEN_LANE_CLEAR) continue;
      if (Math.abs(other.laneOffset - passLane) < 0.35) return false;
    }
    return true;
  }

  /**
   * Merge a reinforcement from an onramp AHEAD of the player (4-5 stars).
   * It arrives already holding a token — it is legitimately in front, so the
   * anti-pass guards must not drag it back.
   */
  _tickOnrampReinforcements(dt, playerPos, cap) {
    const _p2 = this._newPursuitProfile(false);
    // Merging traffic speed, capped by what this unit can sustain.
    const _p2Speed = Math.min(COP_TOP_UNITS * 0.55, _p2.cruiseSpeed);
    const tier = Math.max(0, Math.min(5, this._syncStarLevel()));
    if (tier < ONRAMP_MIN_STARS) { this._onrampTimer = 0; return; }
    if ((this._coalLull ?? 0) > 0) return;          // smokescreen holds them off
    if (this.cops.length >= cap) return;

    this._onrampTimer -= dt;
    if (this._onrampTimer > 0) return;
    this._onrampTimer = ONRAMP_INTERVAL[tier];

    const cop = {
      id:          Math.random(),
      position:    playerPos + ONRAMP_AHEAD_MIN + Math.random() * ONRAMP_AHEAD_SPAN,
      // Travel lanes only (owner 2026-07-31: "why are they in the oncoming
      // traffic?").  The road runs -1..+1 with the double-yellow at 0, so the
      // old (rand-0.5)*0.6 straddled the centerline and put HALF of all
      // pursuers on the oncoming side.  0.2-0.8 keeps them in the two
      // right-hand lanes, where a car chasing you actually drives.
      laneOffset:  0.2 + Math.random() * 0.6,
      // Merge speed, but never above what this unit can sustain — an on-ramp
      // car is joining traffic, not launching. Clamped to profile.cruiseSpeed
      // per the dispatch rule.
      speed:       _p2Speed,
      // baseSpeed was COP_TOP_UNITS — above this unit's own ceiling, so an
      // on-ramp car was still dispatched faster than it can drive. It mirrors
      // the merge speed now, same rule as every other pursuit entry point.
      baseSpeed:   _p2Speed,
      side:        'rear',
      kind:        'rear',
      colorSet:    'police',
      damageMul:   1,
      color:       0xFFFFFF,
      alive:       true,
      painted:     false,
      profile:      _p2,
      _recoverT:    0,
      _attackCd:    0,
      _closeFactor: 0.06 + Math.random() * 0.06,
      _laneDrift:   0.4  + Math.random() * 0.4,
      // Arrives in front legitimately — hand it a token so the guards leave
      // it alone, and mark its turn so fairness accounting stays honest.
      _overtakeToken: { at: this._tokenClock },
      _fromOnramp:    true,
    };
    this.cops.push(cop);
    this._tokenHadTurn.add(cop.id);
    return cop;
  }

  /**
   * FORWARD COUNTER — the player's answer to a 4-5 star roadblock.
   *
   * Holding the throttle against a blocker's rear bumper for PUSH_THROUGH_SEC
   * shoves it aside and spins it out.  Called from GameScene, which is the
   * only place that knows whether the accelerator is actually held.
   *
   * @returns {{spun:object|null, hp:number}} unit spun out this frame (if any)
   *          and the HP the shove cost the player.
   */
  tickPushThrough(dt, playerPos, playerSpeed, throttleHeld) {
    const tier = Math.max(0, Math.min(5, this._syncStarLevel()));
    if (tier < MIN_STARS_AHEAD || !throttleHeld) { this._pushThrough = 0; return { spun: null, hp: 0 }; }

    const carZ = playerPos + PLAYER_VIRTUAL_Z;
    // Nearest unit sitting just in FRONT of the player — the blocker.
    let target = null, bestGap = PUSH_CONTACT_Z;
    for (const cop of this.cops) {
      if (!cop.alive || cop.fleeing || cop.kind === 'oncoming') continue;
      const gap = cop.position - carZ;
      if (gap <= 0 || gap > bestGap) continue;
      target = cop; bestGap = gap;
    }
    if (!target) { this._pushThrough = 0; return { spun: null, hp: 0 }; }

    this._pushThrough += dt;
    if (this._pushThrough < PUSH_THROUGH_SEC) return { spun: null, hp: 0 };

    // Shove: the blocker is spun out of the chase and the player pays for it.
    this._pushThrough = 0;
    target._overtakeToken = null;
    target.fleeing        = true;
    target._fleeNoSwerve  = false;
    target._donutLure     = null;
    target._fleeTimer     = FLEE_MAX_SEC;
    target.laneOffset    += (Math.random() < 0.5 ? -1 : 1) * 0.9;   // spun aside
    target._pitArmed      = false;
    const hp = PUSH_HP_PER_SPEED * Math.max(0, Math.min(1, playerSpeed / MAX_SPEED));
    return { spun: target, hp };
  }

  /**
   * Pull one unit off the chase toward a donut box.  Factored out of the old
   * inline paint_bomb loop so the world-space lure in update() can reuse the
   * exact same visual contract the renderer already reads (`fleeing`,
   * `_donutLure`, `_donutHoldRel`, `_donutFleeDelay`).
   *
   * `box` may sit AHEAD of the unit — that is the point.  `_donutHoldRel` is
   * still measured from the player so the render keeps pinning the cruiser's
   * on-screen size the way it did before.
   */
  _donutDivert(cop, box) {
    const rel = cop.position - (this._playerPosForDonut ?? cop.position);
    cop.fleeing         = true;
    cop._fleeNoSwerve   = false;
    cop._donutLure      = 0;
    cop._donutHoldRel   = Math.max(rel, 1500);
    cop._donutFleeDelay = 1;
    cop._fleeTimer      = FLEE_MAX_SEC;
    cop.trapPursuit     = false;
    cop.parked          = false;
    cop._pitProgress    = 0;
    cop._pitArmed       = false;
    cop._overtakeToken  = null;   // a diverted unit gives its token back
    this._diverted.weapon++;
    return cop;
  }

  /** Speed-trap civil-stop pursuer (0★ layer, Stage 1).  Same rear-pursuit
   *  cop as an encounter spawn, but TAGGED so the comply window can pull it
   *  back off cleanly (player pulled over) or promote it into the normal
   *  wanted system (player ignored the stop → +1★). */
  _spawnTrapPursuit(playerPos) {
    const cop = this._spawnRearFromEncounter(playerPos);
    if (cop) {
      cop.trapPursuit = true;
      // Pull the civil-stop cruiser in CLOSE behind (≈40-65 ft) so it's plainly
      // visible in the mirror as it lights you up — a far rear-spawn at 0★ was
      // easy to miss entirely.
      cop.position   = playerPos - (2400 + Math.random() * 1500);
      cop.laneOffset = 0.3 + Math.random() * 0.4;   // travel lanes, see note above
    }
    return cop;
  }

  /** Player pulled over — park the trap pursuer just behind, lights on, and
   *  PIN it there for the duration of the held traffic stop (no PIT/ram, no
   *  drift).  If the cruiser despawned (player outran it earlier) spawn a
   *  fresh one parked behind so the trooper is visibly there for the stop. */
  parkTrapPursuit(playerPos) {
    let cop = this.cops.find(c => c.trapPursuit);
    if (!cop) { this._spawnTrapPursuit(playerPos); cop = this.cops.find(c => c.trapPursuit); }
    if (cop) {
      cop.parked     = true;
      // Starts BEHIND (mirror-only); GameScene's held-stop tick slides it
      // forward into view so it visibly "pulls up" and parks just ahead-left
      // in the travel lane beside the player's shoulder.
      cop.position   = playerPos - 2600;
      cop.laneOffset = 0.5;                // right travel lane, inboard of the shoulder
      cop.speed      = 0;
      cop.baseSpeed  = 0;
    }
  }

  /** Player complied with the civil stop — drop the trap pursuer(s).
   *  IN-PLACE, not `this.cops = filter(...)`: GameScene._checkCollisions
   *  iterates `cops.cops[i]` by live index, and a collision handler can land
   *  here mid-loop.  Replacing the array left the loop indexing a SHORTER new
   *  array with its old index — `cop` came back undefined and `.parked` threw
   *  (owner crash screenshot 2026-08-05, GameScene _checkCollisions). */
  endTrapPursuit() {
    for (let i = this.cops.length - 1; i >= 0; i--) {
      if (this.cops[i]?.trapPursuit) this.cops.splice(i, 1);
    }
  }

  /** Comply window expired — the trap pursuer becomes a regular wanted-level
   *  cop (so it keeps chasing as the player enters the 1★ system). */
  promoteTrapPursuit() {
    for (const c of this.cops) if (c.trapPursuit) c.trapPursuit = false;
  }

  /** Rolling-coal smoke-out — the cop caught in the cloud breaks pursuit and
   *  recedes straight back into the smoke (the `_fleeNoSwerve` flee: keep
   *  pace COAL_PACE_SEC, then sink off the bottom edge and despawn).  Clears
   *  any trap/PIT state so a smoked trooper can't still line up a bust. */
  _coalSmokeOut(cop) {
    cop.fleeing       = true;
    cop._fleeNoSwerve = true;      // straight-back recede, no shoulder swerve
    cop._fleeTimer    = FLEE_MAX_SEC;
    cop.trapPursuit   = false;
    cop.parked        = false;
    cop._pitProgress  = 0;
    cop._pitArmed     = false;
    this._diverted.weapon++;
  }

  /** Pull + reset the cop-diverted counters (trip-summary stat).  GameScene
   *  drains this once per frame and forwards non-zero counts to
   *  StatsTracker — kept as a plain getter/reset pair so CopSystem never
   *  needs a reference to StatsTracker itself. */
  drainDiverted() {
    const d = this._diverted;
    this._diverted = { weapon: 0, distance: 0 };
    return d;
  }

  /** 5★ roadblock maze — strings of parked cruisers spanning the drivable
   *  width, each row with ONE open pass lane.  Rows are staggered a tight
   *  reaction distance apart and every row's gap lands in a DIFFERENT lane
   *  than the previous one, so the player weaves a short zigzag through
   *  the blockade instead of just holding one line.  Hitting any cruiser
   *  = the classic barricade penalty (kind 'barricade' → damage + 45-mph
   *  flat-tire slow in _onCopCollision).  Difficulty-aware: Easy runs 2
   *  rows with a double-wide gap; Normal/Hard run 3 rows, single-lane gap. */
  _spawnBarricade(playerPos) {
    // First row spawns just BEYOND the render draw distance (76k) so the
    // maze scrolls in over the horizon like normal traffic — the old +14k
    // spawn was well inside the visible road, so rows materialized
    // mid-screen with ~0.6s to react (owner 2026-07-23).  ~78k ≈ 3.5s of
    // warning at 100 mph.
    const firstRowZ = playerPos + 78000 + Math.random() * 4000;
    // 5 lane slots across the drivable width; the gap is one (or two,
    // on Easy) of these.
    const laneSlots = [-0.8, -0.4, 0, 0.4, 0.8];
    const easy      = Difficulty.mode?.() === 'easy';
    const rows      = easy ? 2 : 3;
    const gapWidth  = easy ? 2 : 1;               // adjacent open slots per row
    // Row spacing — 0.1 mile between rows (owner 2026-07-23: the old
    // 9-11k gap ≈ 0.03 mi was nearly impossible to weave gap-to-gap).
    // Derived from route constants so a route change can't desync it;
    // ≈32k units ≈ 1.4s between rows at 100 mph.
    const rowGapZ   = 0.1 * (ROUTE_SEGS * SEG_LENGTH / TOTAL_ROUTE_MILES);
    let prevGap = -1;
    for (let r = 0; r < rows; r++) {
      const rowZ = firstRowZ + r * rowGapZ;
      // Pick the gap's leftmost slot — never the same as the previous
      // row's, so consecutive rows always force a lane change.
      const maxGapIdx = laneSlots.length - gapWidth;
      // Bounded re-pick, NOT a do/while re-roll: with Math.random pinned
      // (test harness) or unlucky, "roll until different" never terminates.
      // A collision just steps to the next slot — same "never the same lane
      // twice" guarantee, always finite.
      let gapIdx = (Math.random() * (maxGapIdx + 1)) | 0;
      if (gapIdx === prevGap) gapIdx = (gapIdx + 1) % (maxGapIdx + 1);
      prevGap = gapIdx;
      for (let i = 0; i < laneSlots.length; i++) {
        if (i >= gapIdx && i < gapIdx + gapWidth) continue;   // the pass lane
        this.cops.push({
          id:          Math.random(),
          position:    rowZ + (Math.random() - 0.5) * 80,    // tiny stagger
          laneOffset:  laneSlots[i],
          speed:       200,                                  // nearly stationary
          baseSpeed:   200,
          side:        'front',
          kind:        'barricade',
          colorSet:    'police',
          color:       0xFFFFFF,
          alive:       true,
          painted:     false,
          _closeFactor: 0,
          _laneDrift:   0,
        });
      }
    }
  }

  /** Pick one of the cop kinds appropriate for the current wanted level.
   *
   *  The proactive `pursuit-front` kind has been removed — same-direction
   *  cops AHEAD of the player only ever come from the random-roadside
   *  cops baked into the route (handled in GameScene).  This system now
   *  only spawns:
   *    1★  → a SINGLE rear pursuit cop (closing from behind; cap = 1)
   *    2★  → rear pursuit cops (closing from behind; cap scales up)
   *    3★  → + oncoming-left
   *    4★+ → + oncoming-anywhere
   *  At 5★ barricades and the helicopter overlay layer on top. */
  _pickKind() {
    const s = this.stars;
    const r = Math.random();
    if (s < 1) return null;                          // no proactive spawn below 1★
    if (s < 3) return 'rear';                        // 1-2★ → rear-pursuit only
    if (s < 4) {
      return r < 0.55 ? 'rear' : 'oncoming-left';
    }
    // 4★: rear pursuit + oncoming. SWAT no longer appears here — the owner's
    // call (2026-08-13) is that vans are a 5★ escalation, so 4★ stays a
    // conventional-cruiser tier and the van's arrival reads as the moment the
    // chase gets serious.
    // 4.75, not 5 — same reason as the cap above: a 5★ chase reads 4.9997, so
    // `s < 5` swallowed the whole 5★ tier and SWAT never spawned. This mirrors
    // the helicopter's existing `stars >= 4.75` threshold.
    if (s < 4.75) return r < 0.60 ? 'rear' : 'oncoming-any';
    // 5★: SWAT vans join (~30 % of spawns) — heavier sprite, ×2 damage, and
    // the HEAVY driving profile (slow to build speed, hard to shake once it
    // has). Rest splits between rear pursuit and oncoming.
    if (r < 0.30) return 'swat';
    if (r < 0.65) return 'rear';
    return 'oncoming-any';
  }

  /** Profile FIRST, then speed from it. Every rear-pursuit entry point goes
   *  through here so none can reintroduce a full-top-speed dispatch. */
  _newPursuitProfile(isSwat = false) {
    return makeProfile({ star: this._starLevel || 1, swat: isSwat });
  }

  _spawnCop(playerPos) {
    const kindRaw = this._pickKind();
    if (!kindRaw) return;                            // no proactive spawn below 1★
    const isSwat  = kindRaw === 'swat';
    // SWAT vans behave like rear pursuit (chase from behind) but use
    // the heavier 'swat' colorSet so _carTexKey resolves to the
    // car_back_swat / car_front_swat assets and so the damage path
    // can apply the ×2 multiplier.
    const kind    = (kindRaw.startsWith('oncoming')) ? 'oncoming'
                  : (isSwat ? 'rear' : kindRaw);
    let position, laneOffset, speed;

    if (kind === 'rear') {
      // Behind by 6-14k units.  Starts at full top speed so it visibly
      // closes the gap.
      position   = playerPos + PLAYER_VIRTUAL_Z
                 - (SPAWN_BEHIND_FT_MIN + Math.random() * SPAWN_BEHIND_FT_SPAN) * FT;
      // Travel lanes only (owner 2026-07-31: "why are they in the oncoming
      // traffic?").  The road runs -1..+1 with the double-yellow at 0, so the
      // old (rand-0.5)*0.6 straddled the centerline and put HALF of all
      // pursuers on the oncoming side.  0.2-0.8 keeps them in the two
      // right-hand lanes, where a car chasing you actually drives.
      laneOffset = 0.2 + Math.random() * 0.6;
      // Speed comes from the profile below, not COP_TOP_UNITS — see
      // _newPursuitProfile / dispatchSpeed.
      speed      = null;
    } else {
      // Oncoming — far ahead, will rocket toward the player.
      position   = playerPos + (16000 + Math.random() * 14000);
      if (kindRaw === 'oncoming-left') {
        laneOffset = -(0.30 + Math.random() * 0.50);
      } else {
        laneOffset = -0.80 + Math.random() * 1.50;
      }
      speed = -ONCOMING_UNITS;
    }

    const _prof = kind === 'rear' ? this._newPursuitProfile(isSwat) : null;
    if (_prof && speed === null) speed = dispatchSpeed(_prof);
    this.cops.push({
      id:          Math.random(),
      position,
      laneOffset,
      speed,
      baseSpeed:   speed,
      side:        kind === 'rear' ? 'rear' : 'front',
      kind,
      colorSet:    isSwat ? 'swat' : 'police',         // drives texture + damage tier
      damageMul:   isSwat ? 2.0 : 1.0,                 // SWAT hits do 2× damage
      color:       0xFFFFFF,
      alive:       true,
      painted:     false,
      _closeFactor: 0.06 + Math.random() * 0.06,
      _laneDrift:   0.4  + Math.random() * 0.4,
      // Persistent driving profile — rolled ONCE here, never per frame. Only
      // rear pursuers drive themselves; oncoming units and barricades keep
      // their existing scripted movement.
      profile:      _prof,
      _slot:        0,
      _recoverT:    0,
      _attackCd:    0,
    });
  }

  addStar(amount = 1, sourceCap = MAX_STARS) {
    // starCapMax = sex-worker "dirt-on-a-politician" hard cap (while active).
    // sourceCap lets the CALLER cap its own contribution: driving / collision
    // heat passes 3, so reckless DRIVING can only ever reach 3★ — using a
    // WEAPON on a cop is the sole path into 4-5★.  Never reduces below the
    // current level (a low sourceCap can't pull a weapon-earned 5★ down).
    const hardCap = (this.starCapMax != null) ? this.starCapMax : MAX_STARS;
    // Energy "sloppy" multiplier — GameScene stamps phys.energyStarMul
    // onto this._starGainMul each frame so we don't have to plumb the
    // multiplier through every addStar call site.
    // Difficulty.starGainMul (Easy 0.5×) only softens FRACTIONAL drip heat
    // (collision bumps etc.).  Whole-star gains (amount >= 1) are announced
    // events — "Failed to pull over! +1★", "WANTED LEVEL ACTIVATED", the
    // fireworks spectacle star — and must land a full DISPLAY star: halving
    // them made the popup promise +1★ while floor(stars) never moved
    // (2026-07-14 playtest bug).  _starGainMul (energy >1× / rage 0×)
    // still applies to everything.
    const mul  = (this._starGainMul ?? 1)
               * (amount >= 1 ? 1 : Difficulty.starGainMul());
    const ceil = Math.min(MAX_STARS, hardCap, Math.max(this.stars, sourceCap));
    this.stars     = clamp(this.stars + amount * mul, 0, ceil);
    this.starTimer = 4;
  }

  /** Per-frame check by GameScene to expire the politician-dirt cap
   *  after the player has driven the buff distance. */
  tickStarCap(playerPos) {
    if (this.starCapEndPos != null && playerPos >= this.starCapEndPos) {
      this.starCapMax    = null;
      this.starCapEndPos = null;
    }
  }

  clearStarsAtStateLine() {
    // Crossing a town line cools low-level heat by ONE star.  Weapon-earned
    // 4-5★ are IMMUNE — once you've pulled a weapon on a cop the chopper
    // stays overhead; only a paint job (not a town crossing) clears it:
    //   4★ or 5★ → 0 (no reduction)
    //   3★ or less → 1
    const cur = this.stars;
    const reduction = cur >= 4 ? 0 : 1;
    this._lastStateLineReduction = reduction;
    this.stars         = Math.max(0, cur - reduction);
    this.starTimer     = 0;
    // Active cop chases are NOT wiped on a town crossing — the chase
    // persists.  The only exception: SWAT vans require 4★+ to spawn,
    // so if the post-reduction heat dropped below that threshold, any
    // SWAT vans currently in play disappear (they wouldn't be on the
    // road at this lower wanted level).  Regular police keep chasing.
    if (this.stars < 3.5) {
      // In-place for the same reason as endTrapPursuit — this can run inside
      // a collision handler while _checkCollisions is still iterating.
      for (let i = this.cops.length - 1; i >= 0; i--) {
        if (this.cops[i]?.colorSet === 'swat') this.cops.splice(i, 1);
      }
    }
    this.bumpCount     = 0;
    this.rearBumpCount = 0;
    this.headOnCount   = 0;
    this.pitCount      = 0;
    this.arrestPending = false;
  }

  // Generic bump tracker — kept for the per-type registers below to
  // increment the total bump tally.  Legacy COP_BUMPS_TO_ARREST check
  // removed; the per-type counters (rear/headOn/PIT) are authoritative.
  registerBump() {
    this.bumpCount++;
    return this.bumpCount;
  }

  /** A 'rear' cop slammed into the back of the player.  Difficulty-scaled
   *  threshold (Normal/Hard 5, Easy 7) = BUSTED. */
  registerRearBump() {
    this.rearBumpCount++;
    if (this.rearBumpCount >= Difficulty.arrest().rear) this.arrestPending = true;
    return this.rearBumpCount;
  }

  /** Player hit an 'oncoming' cop head-on.  Difficulty-scaled (N/H 3, Easy 5)
   *  = BUSTED. */
  registerHeadOn() {
    this.headOnCount++;
    if (this.headOnCount >= Difficulty.arrest().headOn) this.arrestPending = true;
    return this.headOnCount;
  }

  /** A 'pursuit-front' cop landed a PIT (alongside side-swipe).  Difficulty-
   *  scaled (N/H 3, Easy 5) = BUSTED. */
  registerPit() {
    this.pitCount++;
    if (this.pitCount >= Difficulty.arrest().pit) this.arrestPending = true;
    return this.pitCount;
  }

  // Call after handling an arrest.  Wanted level fully resets to 0 — once
  // the player has done their time, the slate is clean.
  clearArrest() {
    this.arrestPending  = false;
    this.bumpCount      = 0;
    this.rearBumpCount  = 0;
    this.headOnCount    = 0;
    this.pitCount       = 0;
    this.cops           = [];
    this.stars          = 0;
    this.starTimer      = 0;
    this._spawnCooldown = 8;
  }

  addF12Token(rawType) {
    const type = TOKEN_MAP[rawType] ?? rawType;
    if (!this.canCarryMore(type)) return;
    if (type === 'coal') {
      // Each coal pickup grants 1 cloud up to a cap of 3.  The token
      // is present whenever coalAmmo > 0 (driven by the inventory render).
      this.coalAmmo = Math.min(3, this.coalAmmo + 1);
      if (!this.f12Tokens.includes('coal')) this.f12Tokens.push('coal');
      return;
    }
    this.f12Tokens.push(type);
  }

  /** Per-type cap.  Every weapon (rolling coal included) caps at 3. */
  canCarryMore(type) {
    if (type === 'coal') return this.coalAmmo < 3;
    let count = 0;
    for (const t of this.f12Tokens) if (t === type) count++;
    return count < 3;
  }

  /** Inventory count surfaced in the HUD.  Rolling coal returns its cloud
   *  total (so the badge reads ×1/×2/×3); other types return their stack
   *  size. */
  countOf(type) {
    if (type === 'coal') return this.coalAmmo;
    let n = 0;
    for (const t of this.f12Tokens) if (t === type) n++;
    return n;
  }

  useF12Token(type, playerPos = 0, direction = 'auto', traffic = null, encounterCops = null) {
    // Each fire consumes one token / one bullet in scored modes.  In
    // custom (sandbox) mode weapons are infinite — neither tokens nor
    // ammo are decremented, so the player can keep firing without
    // picking up resupply.  Heat (25% star roll per fire) is added
    // at the GameScene call site.
    const isCustom = Difficulty.mode?.() === 'custom';
    if (type === 'coal') {
      if (!isCustom) {
        if (this.coalAmmo <= 0) return { ok: false, victims: [], weapon: type };
        this.coalAmmo--;
        if (this.coalAmmo === 0) {
          const i = this.f12Tokens.indexOf('coal');
          if (i !== -1) this.f12Tokens.splice(i, 1);
        }
      } else if (!this.f12Tokens.includes('coal')) {
        // Sandbox safety — coal must always be in the inventory for
        // the HUD to show the slot.  Re-add if it was somehow stripped.
        this.f12Tokens.push('coal');
      }
    } else {
      const idx = this.f12Tokens.indexOf(type);
      if (idx === -1) return { ok: false, victims: [], weapon: type };
      if (!isCustom) this.f12Tokens.splice(idx, 1);
    }

    // Build a unified pool of targets across cops + traffic so every weapon
    // can affect either kind of car uniformly.
    // Unified target pool.  Every entry carries its world position (`pos`),
    // lane (`lane`), whether it's a cop (`isCop`, drives escalation + wreck
    // texture), and the array to splice it from (`src`) — so cops, civilian
    // traffic, AND roadside cop ENCOUNTER sprites all get hit the same way.
    const pool = [];
    for (const c of this.cops)              pool.push({ obj: c, src: this.cops, pos: c.position, lane: c.laneOffset, isCop: true,  colorSet: c.colorSet ?? null, color: c.color });
    if (traffic) for (const t of traffic)   pool.push({ obj: t, src: traffic,  pos: t.position, lane: t.laneOffset, isCop: false, colorSet: t.colorSet ?? null, color: t.color });
    // Roadside speed-trap / ambient cop encounter sprites — GameScene passes
    // each with a world position + its home seg.sprites array as `src`, so a
    // parked trooper is destroyed (spliced out of the road) and escalates
    // heat just like any cruiser.
    if (encounterCops) for (const e of encounterCops) {
      pool.push({ obj: e.sp, src: e.segSprites, pos: e.position, lane: e.offset, isCop: true, colorSet: e.colorSet ?? 'police', color: e.color });
    }

    // Capture each victim's position + lane before splicing so the
    // caller (GameScene) can project them to screen space and spawn
    // explosions / wreck-spins at the right spot.
    const victims = [];
    const removeAll = (entries) => {
      let copKills = 0;
      for (const e of entries) {
        victims.push({
          position:   e.pos,
          laneOffset: e.lane,
          isCop:      e.isCop,
          colorSet:   e.colorSet ?? null,
          texColor:   e.color ?? 0xFFFFFF,
        });
        const i = e.src.indexOf(e.obj);
        if (i !== -1) e.src.splice(i, 1);
        if (e.isCop) copKills++;
      }
      return copKills;
    };

    switch (type) {
      case 'coal': {
        // Rolling coal — a rear diesel smokescreen that HANGS on the road
        // behind the car.  A cop caught in the cloud BREAKS PURSUIT and
        // smoke-outs (owner 2026-07-22 — Option 1: coal ends the chase; the
        // old 60 mph slow-cap kept the cop visibly on the tail and read as
        // "the first cop withstood it").  The cloud stays world-anchored for
        // COAL_CLOUD_LIFE s, so late arrivals that drive into it smoke-out
        // too (touch check in update()).  STEALTHY: no kills, no stars, no
        // escalation.  Parked held-stop troopers + roadside encounter
        // sprites are untouched (smoke isn't a weapon).
        // Metal's "Weapons last +25%" (weaponDurationMult) stretches the
        // durations coal still has: the hanging cloud's life + the spawn
        // lull.  (Its old consumer — the 60 mph slow timer — is gone.)
        const _durMult = this._traitWeaponDurationMult ?? 1;
        this._coalCloud = {
          backZ:  playerPos - COAL_CLOUD_BACK,
          frontZ: playerPos + COAL_CLOUD_FRONT,
          life:   COAL_CLOUD_LIFE * _durMult,
        };
        // Puff trail (spec §5): a collider laid every 100 ms with its own
        // 3.5 s life, so the smoke FOLLOWS the road instead of being a rigid
        // box.  The band above is kept as the instantaneous catch region; the
        // trail is what keeps catching late arrivals as the player drives on.
        // Emit for (life - PUFF_LIFE) so the LAST puff dies exactly when the
        // legacy cloud does.  Emitting for the full life would stretch coal's
        // effective window by PUFF_LIFE and let it smoke a late arrival after
        // the cloud expired — behaviour coal.test.mjs explicitly forbids.
        this.deployables.startCoal(Math.max(0, COAL_CLOUD_LIFE * _durMult - PUFF_LIFE));
        // Smoke-out any cop ALREADY inside the cloud band this instant — a
        // cop chasing from behind is in the band the moment you belch.  The
        // per-frame touch check (update loop) keeps catching new arrivals,
        // but the cloud is set AFTER this frame's cop update, so without
        // this the first fire missed the current pursuer (owner 2026-07-19:
        // "coal didn't work on the cop the first time").
        for (const cop of this.cops) {
          if (cop && cop.kind !== 'barricade' && !cop.parked && !cop.fleeing
              && cop.position >= this._coalCloud.backZ
              && cop.position <= this._coalCloud.frontZ) {
            this._coalSmokeOut(cop);
          }
        }
        // Any arrest that was mid-progress is broken the moment the wall of
        // smoke goes up (nobody can line up the bust through it).
        this.bumpCount     = 0;
        this.rearBumpCount = 0;
        this.headOnCount   = 0;
        this.pitCount      = 0;
        this.arrestPending = false;
        // 30-second spawn lull — the smokescreen holds off fresh pursuers so
        // the smoke-out actually buys an escape window.
        this._coalLull      = Math.max(this._coalLull ?? 0, COAL_LULL_SEC * _durMult);
        this._spawnCooldown = Math.max(this._spawnCooldown ?? 0, COAL_LULL_SEC * _durMult);
        break;
      }

      case 'fireworks': {
        // Fireworks show — a full screen WIPE: every vehicle in view
        // (pursuing cops, parked speed-trap / ambient encounter sprites AND
        // civilian traffic) blows up as the barrage rains down.  Kills are
        // DEFERRED: nothing is spliced here — the victims go back with live
        // obj/src refs (`deferredVictims`) so GameScene can stagger the
        // detonations (~0.1-0.3s apart, timed to the aerial bursts) and
        // remove each car AT its own boom, not one simultaneous pop.
        // Bypasses removeAll/`victims` so the cop-killer escalation below
        // never sees these kills — the show's only heat is the flat +1★
        // spectacle star at the GameScene call site (no per-cop escalation,
        // no NPC-wreck reckless heat).  Visibility window matches
        // _collectEncounterCops (-60..+200 segs around the player).
        const deferred = [];
        for (const e of pool) {
          const rel = e.pos - playerPos;
          if (rel < -60 * SEG_LENGTH || rel > 200 * SEG_LENGTH) continue;
          deferred.push({
            obj:        e.obj,
            src:        e.src,
            position:   e.pos,
            laneOffset: e.lane,
            isCop:      e.isCop,
            colorSet:   e.colorSet ?? null,
            texColor:   e.color ?? 0xFFFFFF,
          });
        }
        // Doomed cruisers keep driving until their boom lands, but they
        // can't hurt you in that beat: disarm PITs / trap pursuit now,
        // reset the arrest counters (nobody survives to bust you) and hold
        // off the replacement spawn — same guard as weaponPulledAtTrap.
        for (const cop of this.cops) {
          cop.trapPursuit  = false;
          cop.parked       = false;
          cop._pitProgress = 0;
          cop._pitArmed    = false;
        }
        this.bumpCount      = 0;
        this.rearBumpCount  = 0;
        this.headOnCount    = 0;
        this.pitCount       = 0;
        // The 5★ helicopter goes down with the barrage (owner 2026-08-05) —
        // it's the one unit fireworks previously couldn't touch.  Grounded
        // for a good stretch; the flag flip is read by GameScene, which
        // detonates the overlay at its on-screen spot.
        if (this.helicopterActive) {
          this._heliDownT = 30;
          this.helicopterActive = false;
          this._heliShotDown = true;   // one-shot cue for GameScene's boom
        }
        this.arrestPending  = false;
        this._spawnCooldown = Math.max(this._spawnCooldown ?? 0, 2.5);
        this._diverted.weapon += deferred.filter(v => v.isCop).length;
        return { ok: true, victims: [], deferredVictims: deferred, weapon: type };
      }

      case 'paint_bomb': {
        // Donuts — a box tossed onto the road behind you. Every cop in range
        // BREAKS PURSUIT and veers toward the donuts (lane 0), then peels off
        // the back of the screen (owner 2026-07-16). Unlike rolling coal they
        // do NOT linger/fade in place — they divert and are gone. Pure
        // DISTRACTION: no kills, no star change. `_donutLure` steers the flee
        // toward the donuts; the fireworks-style positional recede slides them
        // off. A SHORT no-spawn window keeps them from re-manifesting instantly.
        // Drop a world-anchored box.  The per-frame lure check in update()
        // radius-tests EVERY unit against it — including one that has got in
        // front of the player, which the old `rel < 3000` band could never
        // reach.  That is the whole reason donuts felt dead against a blocker.
        this.deployables.dropDonuts(playerPos, 0, this._traitWeaponDurationMult ?? 1);
        // Immediate catch: run the SAME radius lure the per-frame check uses,
        // so a unit already standing in the box's radius reacts on the frame
        // it lands.  One code path only — the old `rel < 3000` band is gone,
        // and with it the reason donuts were dead against a blocker.
        let lured = 0;
        this._syncStarLevel();
    this._playerPosForDonut = playerPos;
        {
          const box  = this.deployables.donuts[this.deployables.donuts.length - 1];
          const tier = Math.max(1, Math.min(5, this._syncStarLevel()));
          for (const cop of this.cops) {
            if (!cop || cop.kind === 'barricade' || cop.parked || cop.fleeing) continue;
            if ((cop._donutImmune ?? 0) > 0) continue;
            if (Math.abs(cop.position - box.z) > 16 * CL) continue;
            cop._donutRolled = box;
            if (Math.random() >= DONUT_DIVERT_BY_STAR[tier]) continue;
            cop._donutImmune = DONUT_IMMUNE_SEC;
            this._donutDivert(cop, box);
            lured++;
          }
        }
        if (lured > 0) {
          this.bumpCount     = 0;
          this.rearBumpCount = 0;
          this.headOnCount   = 0;
          this.pitCount      = 0;
          this.arrestPending = false;
        }
        // 6s no-spawn window (vs coal's 30s) — donuts distract, they don't
        // buy a long lull. Reuses the existing donut spawn-gate below.
        this._donutPauseTimer = 6;
        break;
      }

      case 'disguise':
        this.stars     = 0;
        this.starTimer = 0;
        this.cops      = [];
        // Zero EVERY bump-counter family — without this, a player who
        // racked 4/5 rear bumps, hit disguise, and took one more rear
        // bump would BUST instantly with no warning.  Disguise is a
        // hard cleanse, so it must reset all four counters.
        this.bumpCount     = 0;
        this.rearBumpCount = 0;
        this.headOnCount   = 0;
        this.pitCount      = 0;
        this.arrestPending = false;
        break;
    }
    // ── Cop-killer escalation ──────────────────────────────────────────
    // A WEAPON kill on a cop does NOT cool you down — it makes them want you
    // MORE.  Each cop death adds +1★, so taking out two cruisers in one
    // blast adds +2★.  Kept live even though no current weapon records
    // kills here (fireworks defers its wipe and returns early, coal smokes,
    // donuts stall): any future lethal weapon that pushes `victims` re-arms
    // this path.
    const copKills = victims.filter(v => v.isCop).length;
    if (copKills > 0 && type !== 'paint_bomb' && type !== 'disguise') {
      this.escalateForCopKill(playerPos, copKills);
    }
    // Returns the victim list so GameScene can spawn per-car FX.
    return { ok: true, victims, weapon: type };
  }

  /** Cop-kill heat — called from useF12Token when a weapon destroys cop
   *  car(s).  Adds +1★ PER cop killed (two cruisers in one blast = +2★),
   *  capped at MAX_STARS.  Clears the arrest counters so the blast itself
   *  can't bust you, and buys a 3-5 mile head start before fresh pursuit
   *  re-engages. */
  escalateForCopKill(playerPos = 0, kills = 1) {
    this.stars         = Math.min(MAX_STARS, this.stars + kills);
    this.starTimer     = 4;
    this.bumpCount     = 0;
    this.rearBumpCount = 0;
    this.headOnCount   = 0;
    this.pitCount      = 0;
    this.arrestPending = false;
    const mile = (playerPos / (ROUTE_SEGS * SEG_LENGTH)) * TOTAL_ROUTE_MILES;
    this._pursuitGraceMile = mile + (3 + Math.random() * 2);   // 3-5 mi head start
  }

  /** A pursuer with eyes on the player radios in erratic driving: +1 whole
   *  star (driving-heat cap 3 via sourceCap) and an immediate reinforcement
   *  (the spawn cooldown is cut so the backup actually shows up).  The
   *  reason string sits in `backupCalled` until GameScene drains it for the
   *  "UNIT REQUESTING BACKUP" HUD beat. */
  _callBackup(reason) {
    this._erraticT      = 0;
    this._backupCd      = BACKUP_COOLDOWN_SEC;
    this.addStar(1, 3);
    this._spawnCooldown = Math.min(this._spawnCooldown ?? 0, 0.5);
    this.backupCalled   = reason;
  }

  /** GameScene reports the player crashing into a CIVILIAN car.  Counts as
   *  an erratic act (instant backup call) if a pursuer witnessed it —
   *  cop-collision heat is separate and already handled at those call
   *  sites, so this is never invoked for cop_* damage sources. */
  reportErraticCollision() {
    const tier = this._syncStarLevel();
    if (tier >= 1 && tier < 3 && this._eyesOn && this._backupCd <= 0) {
      this._callBackup('collision witnessed');
    }
  }

  /** Player pulled a WEAPON on a parked speed-trap trooper instead of pulling
   *  over.  Voids the civil stop: every surviving trap pursuer becomes a live
   *  chaser (un-parked, back up to speed) and you land at a flat 2★ — a real
   *  but escapable offense, milder than taking out an active pursuer (4-5★).
   *
   *  Stars are SET, not added: the triggering weapon may itself have just
   *  "killed" the trooper (a future lethal weapon), which runs
   *  escalateForCopKill → 4★ inside useF12Token.  Setting to 2 here overwrites
   *  that in the same frame so the two can't stack into 5★.  Grace is cleared
   *  so this behaves like normal 2★ heat, not a 4-5★ weapon-kill head start. */
  weaponPulledAtTrap(playerPos = 0, graceMi = 0) {
    const chaseSpeed = MAX_SPEED * (COP_TOP_MPH / 120);
    for (const c of this.cops) {
      if (!c.trapPursuit) continue;
      c.trapPursuit = false;
      c.parked      = false;
      c.speed       = chaseSpeed;
      c.baseSpeed   = chaseSpeed;
    }
    this.stars             = Math.min(MAX_STARS, 2);
    this.starTimer         = 4;
    this.bumpCount         = 0;
    this.rearBumpCount     = 0;
    this.headOnCount       = 0;
    this.pitCount          = 0;
    this.arrestPending     = false;
    // graceMi > 0 = the weapon fully cleared the trooper (fireworks): the
    // replacement pursuit holds off for that long.  0 = the trooper survives
    // as a live chaser — normal 2★ pursuit, no head start.  Either way, force
    // a real spawn delay: at 0★ the spawn cooldown has been sitting expired,
    // so without this a fresh cruiser appeared THE SAME FRAME the trooper
    // cleared — which made the weapon look like it did nothing (bug, 2026-07-13).
    const mile = (playerPos / (ROUTE_SEGS * SEG_LENGTH)) * TOTAL_ROUTE_MILES;
    this._pursuitGraceMile = graceMi > 0 ? mile + graceMi : 0;
    this._spawnCooldown    = Math.max(this._spawnCooldown ?? 0, 2.5);
  }

  /** Player speed as it was `lag` seconds ago (0.1 s resolution).  Backs the
   *  pursuit reaction lag — see the history push in update().  History
   *  younger than the lag returns the oldest known sample. */
  _playerSpeedAgo(lag) {
    const hist = this._spdHist;
    if (!hist?.length) return 0;
    const tWant = (this._chaseClock ?? 0) - lag;
    for (let i = hist.length - 1; i >= 0; i--) {
      if (hist[i].t <= tWant) return hist[i].v;
    }
    return hist[0].v;
  }

  update(dt, playerPos, playerSpeed, playerX = 0) {
    // Role assignment runs ONCE per frame over the rear pursuers, before the
    // per-cop loop. Roles gate what a unit may do (strike, wing, pass); they
    // never set a position or a speed. See PursuitDirector.
    this._rearPursuers = this.cops.filter(
      c => c.kind === 'rear' && c.alive && !c.parked && !c.fleeing && c.profile);
    this._roles = this._director.assign(
      this._rearPursuers,
      { pursuitZ: playerPos + PLAYER_VIRTUAL_Z, playerX, star: this._starLevel },
      dt);
    this._flashTimer += dt;

    // ── Player-speed history (pursuit reaction lag, owner 2026-08-04) ──
    // A pursuer reads the player's throttle 1.5-4 s LATE (per-cop, set
    // below), so speed changes take human reaction time to answer: gun it
    // and the cruiser visibly loses ground before it responds; brake and
    // it keeps charging onto your bumper.  0.1 s samples, ~4.5 s retained.
    this._chaseClock = (this._chaseClock ?? 0) + dt;
    {
      const hist = this._spdHist ?? (this._spdHist = []);
      if (!hist.length || this._chaseClock - hist[hist.length - 1].t >= 0.1) {
        hist.push({ t: this._chaseClock, v: playerSpeed });
        while (hist.length && hist[0].t < this._chaseClock - 4.5) hist.shift();
      }
    }
    if (this._flashTimer > 0.25) { this._flashTimer = 0; this.lightFlash = !this.lightFlash; }

    // Donut pursuit-freeze — tick the 15s "cops stall" window down.
    if (this._donutPauseTimer > 0) this._donutPauseTimer -= dt;

    // Rolling-coal cloud — the hanging smokescreen ages out; while it lives, a
    // cop inside its world-anchored road region gets the 60 mph / 30 s slow.
    this._playerPosForDonut = playerPos;
    this._tickOvertakeTokens(dt, playerPos + PLAYER_VIRTUAL_Z, playerX);
    // World-space deployables: age boxes/puffs and lay new coal at the car.
    this.deployables.update(dt, playerPos);

    if (this._coalCloud) {
      this._coalCloud.life -= dt;
      if (this._coalCloud.life <= 0) this._coalCloud = null;
    }

    // Bump auto-reset — keeps stale bump counts from old chases from
    // surprising the player with a phantom BUST.
    if (this.cops.length === 0) {
      this._copFreeTime = (this._copFreeTime ?? 0) + dt;
      if (this._copFreeTime > 20) {
        if (this.bumpCount > 0)     this.bumpCount     = 0;
        if (this.rearBumpCount > 0) this.rearBumpCount = 0;
        if (this.headOnCount > 0)   this.headOnCount   = 0;
        if (this.pitCount > 0)      this.pitCount      = 0;
        this.arrestPending = false;
      }
    } else {
      this._copFreeTime = 0;
    }

    // ── EYES ON — is a live pursuer close enough to see you? ────────────
    // Within EYES_ON_FT of the CAR: wanted decay pauses and erratic driving
    // is witnessed (backup calls below).  Fleeing/parked units and static
    // barricades don't count — nobody is watching you from a smoke-out.
    {
      const carZ = playerPos + PLAYER_VIRTUAL_Z;
      this._eyesOn = this.cops.some(c => c.alive && !c.fleeing && !c.parked
        && c.kind !== 'barricade' && Math.abs(c.position - carZ) < EYES_ON_FT * FT);
    }

    if (this.stars > 0) {
      this.starTimer -= dt;
      // One full star decays per minute of real time — 1★ in 60s,
      // 2★ in 120s, up to 4★ in 240s.  5★ is the exception: helicopter
      // is overhead and the wanted level is LOCKED.  Only a rest-stop
      // paint job (`clearStars`) drops the player out of 5★.
      // PAUSED while a pursuer has eyes on you (owner 2026-07-31): escape by
      // outrunning them, not by waiting out the timer mid-chase.
      if (this.starTimer <= 0 && !this.helicopterActive && !this._eyesOn) {
        // Genre-vehicle wanted-decay modifier (<1 ⇒ slower). Pushed from
        // GameScene._refreshGenreTrait; neutral (×1) for non-genre vehicles.
        this.stars = Math.max(0, this.stars - (dt / 60) * (this._traitWantedDecayMult ?? 1));
        if (this.stars < 0.5) {
          this.bumpCount = this.rearBumpCount = this.headOnCount = this.pitCount = 0;
          this.arrestPending = false;
        }
      }
    }

    // ── BACKUP CALLS — witnessed erratic driving escalates the chase ────
    // Continuous kinds (wrong side of the double-yellow / 90+ mph) must be
    // sustained ERRATIC_SUSTAIN_SEC before the call goes out; collisions are
    // instant via reportErraticCollision().  Only below 3★ — at 3★ everyone
    // who's coming is already coming, and 4-5★ stays weapons-only.
    if (this._backupCd > 0) this._backupCd -= dt;
    const _tierNow = this._syncStarLevel();
    if (_tierNow >= 1 && _tierNow < 3 && this._eyesOn && this._backupCd <= 0) {
      const wrongSide = playerX < -0.05;   // across the double-yellow
      const speeding  = playerSpeed >= MAX_SPEED * (ERRATIC_MPH / 120);
      if (wrongSide || speeding) {
        this._erraticT += dt;
        if (this._erraticT >= ERRATIC_SUSTAIN_SEC) {
          this._callBackup(wrongSide ? 'driving against traffic' : 'excessive speed');
        }
      } else {
        this._erraticT = Math.max(0, this._erraticT - dt * 2);
      }
    } else {
      this._erraticT = 0;
    }

    // Spawning — proactive rear pursuit kicks in at 1★ (a single chase car;
    // see the `cap` below) and scales up from 2★.  Random-roadside encounters
    // baked into the route (GameScene) still layer on top.
    // Difficulty.copEscalationMul scales BOTH the active-cop cap and the
    // spawn cooldown — Easy 0.7× cops + slower respawn, Hard 1.5× cops +
    // faster respawn.  TimeOfDay.darkness() adds an extra +30% at full
    // night (graveyard-shift cops are out in force).
    this._spawnCooldown -= dt;
    // Rolling-coal lull — re-assert the remaining lull onto the spawn
    // cooldown every tick so no other system (trap escalation, star
    // changes, clearArrest) can shorten the 30 s no-new-cops window.
    if ((this._coalLull ?? 0) > 0) {
      this._coalLull = Math.max(0, this._coalLull - dt);
      this._spawnCooldown = Math.max(this._spawnCooldown, this._coalLull);
    }
    const escMul = Difficulty.copEscalationMul();
    const _mileForCops = (playerPos / (ROUTE_SEGS * SEG_LENGTH)) * TOTAL_ROUTE_MILES;
    const nightMul = 1 + TimeOfDay.darkness(_mileForCops) * 0.30;
    // ONE PURSUER PER STAR (owner, 2026-08-13): 2★ = 2 cops, 3★ = 3, and so
    // on. The old formula was `ceil(stars * 1.35 * difficulty * night)`, which
    // put FIVE cars on you at 3★ and made the star rating a poor signal of what
    // you were actually facing.
    //
    // Difficulty and night density have not been dropped — they now scale the
    // spawn RATE below rather than the ceiling, so a hard night still fills the
    // roster faster, it just cannot exceed what the stars advertise.
    //
    // The cap counts PURSUERS, not every police object. Barricades, oncoming
    // units and the helicopter are hazards rather than chasers, and counting
    // them here would have let a single barricade starve the 5★ roster of the
    // cars it needs.
    const _pursuerCount = this.cops.reduce(
      (n, c) => n + ((c.kind === 'rear' && !c.parked) ? 1 : 0), 0);
    // _starLevel, not floor(this.stars): `stars` is a decaying float that sits
    // just UNDER its integer (a 5★ chase reads 4.9997), so flooring it gave a
    // cap one below the number on screen — 4 cars at 5★. _starLevel is the
    // integer the HUD and every other gate already use.
    const cap = Math.max(1, this._starLevel);
    // Cop-killer head start — after a weapon kill, fresh pursuit holds off
    // until the player has driven the 3-5 mi grace distance (set in
    // useF12Token).  Lets them reach a rest stop to disguise / paint / bus.
    const inGrace = _mileForCops < (this._pursuitGraceMile ?? 0);
    // Donuts freeze active → no new pursuit spawns for the window.
    const donutFreeze = this._donutPauseTimer > 0;
    if (this.stars >= 1 && this._spawnCooldown <= 0 && _pursuerCount < cap && !inGrace && !donutFreeze) {
      this._spawnCop(playerPos);
      this._spawnCooldown = Math.max(0.8, (5.5 - this.stars * 0.9) / (escMul * nightMul));
    }

    // ── 5★ extras: barricades + helicopter ─────────────────────────
    // At max wanted level the highway gets cluttered with rolling
    // road-block formations and a permanent chopper overhead.
    this._tickOnrampReinforcements(dt, playerPos, cap);

    this._barricadeCooldown = (this._barricadeCooldown ?? 0) - dt;
    if (this.stars >= 5 && this._barricadeCooldown <= 0 && (this._coalLull ?? 0) <= 0) {
      this._spawnBarricade(playerPos);
      this._barricadeCooldown = 6 + Math.random() * 4;   // every 6-10 sec
    }
    // Single helicopter that lives as long as we're at 5★.
    // Threshold 4.75 (was 4.5): a fractional star bump that landed on
    // exactly 4.5 used to lock the player out of decay forever — the
    // decay branch is gated by !helicopterActive AND helicopterActive
    // only flips off below 4.5, leaving a one-sided stuck state.  By
    // tightening to 4.75 the chopper still locks the player at "true 5★"
    // (display rounds up) while leaving the 4.5/4.75 band decay-able.
    // Fireworks shoot the chopper down (owner 2026-08-05): _heliDownT holds
    // it off the map while the wreck "recovers"; it re-launches only after
    // the timer drains (and only if the player is still at true 5★).
    this._heliDownT = Math.max(0, (this._heliDownT ?? 0) - dt);
    this.helicopterActive = this.stars >= 4.75 && this._heliDownT <= 0;
    if (this.helicopterActive) {
      this.helicopterPos     = playerPos + 1500;          // visually ahead-above
      this.helicopterPhase   = (this.helicopterPhase ?? 0) + dt;
    }

    // ── Pursuit formation slots (owner 2026-08-03: "if 3 police are
    // chasing, show 3 full police cars") ────────────────────────────────
    // Every guarded pursuer clamps at the SAME standoff depth, so multiple
    // units used to converge on the player's lane and stack into one
    // sprite.  Assign each live rear unit a lane slot instead: the primary
    // lines up on the player's bumper, wingmen track flanking half-lanes —
    // a rolling formation of visibly separate cruisers.  Slots follow
    // array order, so when the primary despawns the next unit drifts into
    // its place via normal lane tracking.  A unit mid-lunge always steers
    // at the bumper regardless of slot (see the lane-track target below).
    {
      const FORM = [0, -0.42, 0.42, -0.8, 0.8];
      let _slot = 0;
      for (const c of this.cops) {
        c._formOffset = (c.kind === 'rear' && c.alive && !c.fleeing && !c.parked)
          ? FORM[Math.min(_slot++, FORM.length - 1)]
          : 0;
      }
    }

    // Drive each cop's behavior by its kind.
    for (let i = this.cops.length - 1; i >= 0; i--) {
      const cop = this.cops[i];
      const dist  = cop.position - playerPos;
      const aDist = Math.abs(dist);
      // Where a pursuer actually aims: the player's CAR, not the camera.
      const pursuitZ = playerPos + PLAYER_VIRTUAL_Z;
      // Reaction lag (owner 2026-08-04): rear pursuit drives against the
      // player's speed AS OF 1.5-4 s AGO — see the history at the top of
      // update().  Position/distance math stays instantaneous (the cop can
      // SEE where you are; it just takes human time to answer the throttle).
      cop._reactSec ??= 1.5 + Math.random() * 2.5;
      const reactSpd = (cop.kind === 'rear' && !cop.parked && !cop.fleeing)
        ? this._playerSpeedAgo(cop._reactSec)
        : playerSpeed;

      // ── ROLLING-COAL TOUCH: a cop that drives into the hanging cloud (and
      // can be chasing — not a stationary barricade or a parked held-stop
      // trooper) breaks pursuit and smoke-outs.  Gated on !fleeing so a cop
      // lingering in the band doesn't get its pace/flee timers re-armed.
      const _deployable = cop.kind !== 'barricade' && !cop.parked && !cop.fleeing;

      // ── COAL: puff colliders, radius-tested ─────────────────────────────
      // The legacy band is kept as the instantaneous catch region at fire
      // time; the puff trail is what keeps catching units afterwards.
      // NOTE the EFFECT is still the full smoke-out, not the spec's "steering
      // noise + speed penalty".  That is deliberate: ending the chase was an
      // explicit owner call (2026-07-22, "Option 1"), because a slow-cap read
      // as "the first cop withstood the coal", and 25 tests encode it.
      if (_deployable
          && ((this._coalCloud
               && cop.position >= this._coalCloud.backZ
               && cop.position <= this._coalCloud.frontZ)
              || this.deployables.inPuff(cop.position))) {
        this._coalSmokeOut(cop);
      }

      // ── DONUTS: world-space lure, reaches units IN FRONT ────────────────
      // Radius check against every unit regardless of side.  One roll per
      // unit per box; on a divert the unit is immune for DONUT_IMMUNE_SEC so
      // a stack of boxes can't chain-disable the same car.
      if (cop._donutImmune > 0) cop._donutImmune -= dt;
      if (_deployable && (cop._donutImmune ?? 0) <= 0) {
        const box = this.deployables.donutNear(cop.position);
        if (box && cop._donutRolled !== box) {
          cop._donutRolled = box;             // one roll per box, per unit
          const tier = Math.max(1, Math.min(5, this._syncStarLevel()));
          if (Math.random() < DONUT_DIVERT_BY_STAR[tier]) {
            cop._donutImmune = DONUT_IMMUNE_SEC;
            this._donutDivert(cop, box);
          }
        }
      }

      // Fireworks scatter / coal smoke-out — the cop breaks pursuit and
      // drops back until it has RECEDED PAST THE BOTTOM OF THE SCREEN, then
      // despawns (position-driven; the timer is only a lifetime failsafe).
      // Skips all pursuit AI so a fleeing cop can never PIT / ram on the
      // way out.  Fireworks flee swerves for the shoulder; rolling coal sets
      // `_fleeNoSwerve` so the blinded cop just sinks straight back into
      // the smoke (lost sight — no dramatic swerve).
      if (cop.fleeing) {
        cop._fleeTimer = (cop._fleeTimer ?? FLEE_MAX_SEC) - dt;
        // ── DONUT 1s beat: hold the cop ON-SCREEN, IN LANE, keeping pace for 1s
        // after the box is thrown (owner 2026-07-19). NO left/right movement —
        // it should read as the cop still locked on you, then drop straight back
        // toward the donuts behind you (the recede below), not veer off.
        if (cop._donutFleeDelay > 0) {
          cop._donutFleeDelay -= dt;
          cop.speed = playerSpeed;          // hold position (rel constant), in lane
          cop.position += cop.speed * dt;
          cop._fleeFade = 1;                // stay fully visible during the hold
          continue;
        }
        // ── ROLLING COAL: keep pace, then slow and recede off the bottom ──
        // The cop KEEPS PACE with the player for COAL_PACE_SEC, then slows so
        // it falls back and drops off the BOTTOM edge the same way it drove in
        // (owner 2026-07-17). PURE positional recede — NO synthetic bottom
        // slide (`_fleeExit` stays 0) and NO in-place fade; the earlier
        // time-driven version made the cop "jump up, shrink, and float down".
        if (cop._fleeNoSwerve) {
          cop._coalPaceT = (cop._coalPaceT ?? 0) + dt;
          const keepPace = cop._coalPaceT < COAL_PACE_SEC;
          // 0.82 keep-pace = recede at ~0.18× player speed — 3× SLOWER than
          // the old 0.45 (owner 2026-08-04): the smoked cruiser lingers,
          // spinning out (see the coalFlee facing flash in the renderer),
          // instead of dropping away in a second.
          cop.speed = keepPace ? playerSpeed : playerSpeed * 0.82;
          cop.position += cop.speed * dt;
          const rel = cop.position - playerPos;
          // The RENDER drives the bottom-edge sink from relativePos (see the
          // coalFlee branch in _renderVehicles) — CopSystem just handles the
          // physics + despawn. FLEE_MAX_SEC timer covers the player-stopped case.
          cop._fleeFade = Math.max(0, Math.min(1, (rel - FLEE_DESPAWN_REL) / FLEE_FADE_SPAN));
          if (rel <= FLEE_DESPAWN_REL || cop._fleeTimer <= 0) this.cops.splice(i, 1);
          continue;
        }
        if (cop._donutLure != null) {
          // Donut: NO left/right movement — the cop drops STRAIGHT back (in its
          // lane) toward the donut box behind you, so it reads as chasing the
          // donuts rather than fleeing to the shoulder (owner 2026-07-19).
        } else {
          cop.laneOffset += (cop.laneOffset >= 0 ? 1 : -1) * 2.4 * dt;
        }
        // Donut recede sped up 3× (owner 2026-08-04, superseding the 2026-07-21
        // "gently" call): keep-pace 0.4 = recede at 0.6× player speed vs the
        // old 0.8/0.2× — the diverted cruiser clears the screen ~3× faster.
        // Regular flees keep the original 0.5.
        cop.speed = Math.max(0, playerSpeed * (cop._donutLure != null ? 0.4 : 0.5));
        cop.position += cop.speed * dt;
        const rel = cop.position - playerPos;
        // Alpha eases with POSITION, not time — full while still up-screen,
        // sinking toward zero as the cop slides down-screen into the smoke
        // and drops behind.  The fade's tail also covers its shrinking image
        // in the rear-view mirror.  Renderers read it via
        // getCopsForRender().fleeFade (forward view) or cop._fleeFade
        // directly (mirror).
        cop._fleeFade = Math.max(0, Math.min(1, (rel - FLEE_DESPAWN_REL) / FLEE_FADE_SPAN));
        // Synthetic exit progress (0→1) — drives the FORWARD view's
        // bottom-edge slide once rel is below the projection floor (the
        // renderer clamps draw depth at FLEE_EXIT_HOLD_REL and pushes
        // screen-Y down past SCREEN_H by this amount).  Position-driven;
        // if the flee timer expires with rel stalled (e.g. player stopped,
        // so the fleeing cop's 35%-of-player speed is 0 and rel never
        // falls) a small time boost finishes the slide instead of the old
        // mid-screen blink-out.
        const posExit = Math.max(0, Math.min(1, (FLEE_EXIT_HOLD_REL - rel) / FLEE_EXIT_SPAN));
        if (cop._fleeTimer <= 0) {
          cop._fleeExitBoost = Math.min(1, (cop._fleeExitBoost ?? 0) + dt * 0.6);
        }
        cop._fleeExit = Math.min(1, posExit + (cop._fleeExitBoost ?? 0));
        // Despawn OFF-SCREEN only: the exit slide has the cruiser past the
        // bottom edge (and alpha 0) by _fleeExit = 1; the extra rel margin
        // means it's also faded out and tiny in the mirror.  rel > 50000
        // matches the render cutoff (fully off-view ahead).  The expired
        // timer alone no longer splices — it must ALSO have completed the
        // exit slide, so there is never a mid-screen pop.
        if (rel <= FLEE_DESPAWN_REL || rel > 50000
            || (cop._fleeTimer <= 0 && cop._fleeExit >= 1)) {
          this.cops.splice(i, 1);
        }
        continue;
      }
      // Parked at a civil traffic stop — pinned behind the stopped player,
      // no pursuit AI / PIT / drift until endTrapPursuit() removes it.
      if (cop.parked) {
        cop.speed = 0;
        continue;
      }
      // (Donuts no longer freeze cops in place — affected cops are set
      //  `fleeing` toward the donuts in useF12Token and recede off-screen via
      //  the flee block above. The 6s _donutPauseTimer only gates new spawns.)
      // Disabled override — EMP stops the car flat for a custom timer.
      if (cop.empTimer > 0) {
        cop.empTimer -= dt; cop.speed = 0;
      } else {
        switch (cop.kind) {
          case 'rear': {
            // ── INDEPENDENT PURSUIT ────────────────────────────────────────
            // Speed is integrated from THIS cop's acceleration, braking and
            // ceiling (CopProfiles.integrateSpeed). The player's speed is an
            // observation that shapes the target, never a value assigned to
            // cop.speed — that coupling is what made every cruiser converge on
            // one pace and read as a hive mind.
            //
            // Roles come from the PursuitDirector (assigned once per frame,
            // above) and gate what a unit MAY do; they never set its position.
            cop.profile ??= makeProfile({ star: this._starLevel || 1,
                                          swat: cop.colorSet === 'swat' });
            const _copMile = (cop.position / (ROUTE_SEGS * SEG_LENGTH)) * TOTAL_ROUTE_MILES;
            const _grip    = Weather.gripMul?.(_copMile) ?? 1;
            const _role    = this._roles?.get(cop.id) ?? 'follower';
            const _world   = { playerSpeed, pursuitZ, playerX, grip: _grip,
                               star: this._starLevel };
            driveCop(cop, _world, _role, dt);
            // Gentle police-to-police spacing so units do not stack on one
            // point. A bias, not a formation — see PursuitDirector.spacingBias.
            const _bias = spacingBias(cop, this._rearPursuers ?? []);
            if (_bias) {
              cop.speed = integrateSpeed(cop.speed, Math.max(0, cop.speed + _bias),
                                         cop.profile, dt, _grip);
            }
            cop._selfIntegrated = true;   // position already advanced by driveCop

            // PIT arming is now PHASE-GATED. It used to arm whenever ordinary
            // following happened to produce lateral proximity for 0.65s, which
            // is why PITs felt like unavoidable ambient damage. It can only be
            // true during a genuine commit window.
            const _aDist = Math.abs(cop.position - pursuitZ);
            if (this._starLevel >= MIN_STARS_PIT && pitCommitting(cop)
                && _aDist < PIT_ARM_Z && Math.abs(playerX - cop.laneOffset) < 0.18) {
              cop._pitArmed = true;
            } else {
              cop._pitArmed = false;
              cop._pitProgress = 0;
            }
            break;
          }
          case 'oncoming': {
            // Head-on traffic — fixed negative-direction speed.  No lane
            // gravitation; drivers are barreling past, not actively chasing.
            cop.speed = -ONCOMING_UNITS;
            break;
          }
          case 'barricade': {
            // Stationary blockade — cops park across lanes.  Slight crawl
            // forward so they don't appear bolted to the asphalt.
            cop.speed = 200;
            break;
          }
          default:
            cop.speed = playerSpeed;
        }
      }

      // ── ANTI-PASS GUARDS ──────────────────────────────────────────────
      // Applied to every unit that has no right to lead.  Oncoming traffic
      // and barricades are exempt by definition (they are SUPPOSED to be in
      // front), as are fleeing / parked units, which are no longer pursuing.
      // Gate on the DISPLAYED tier, not the raw float.  `stars` decays
      // continuously (1 per 60 s), so a raw `>= 4` test flips to false within
      // a single frame of reaching 4.0 — and worse, it disagrees with the HUD,
      // which shows Math.floor(stars).  Reading the same floor keeps "cops may
      // lead" true exactly while the player can SEE 4+ stars.
      const _starTier = this._starLevel;
      const _mayLead = _starTier >= MIN_STARS_AHEAD || !!cop._overtakeToken;
      const _guarded = !_mayLead && !cop.fleeing && !cop.parked
                    && cop.kind !== 'oncoming' && cop.kind !== 'barricade';
      const _copCarDist = cop.position - pursuitZ;   // >0 = cop is ahead

      // ── RAM LUNGE ─────────────────────────────────────────────────────
      // Ticked BEFORE the guards: a committed lunge is exempt from GUARD 1's
      // speed ceiling (GUARD 2 still stops it passing the player), otherwise a
      // 1-star cap of 1.03x the player's speed makes the strike take ~6 s to
      // cross the standoff and it never lands.
      if (cop._lungeT > 0) {
        cop._lungeT -= dt;
      } else if (_guarded && !cop._demoting && cop.kind === 'rear'
                 && cop._onStation && _starTier >= RAM_MIN_STARS) {
        // The clock only runs once the cruiser is ON STATION — not while it is
        // still closing — so it visibly sits behind you for the tier's hold
        // before the first strike (owner 2026-07-31: "hold position for five
        // seconds before ramming the player").  1★ never reaches here at all:
        // a lone tail FOLLOWS (chase-realism pass) — pressure at 1★ is the
        // backup-call clock, not the bumper.
        //
        // "On station" is set by the positional clamp below, NOT by measuring
        // the gap here.  `_copCarDist` is sampled BEFORE this frame's movement
        // is integrated, so a parked cop reads as TAILGATE_GAP + one frame of
        // player travel — 225 units at 60 mph, 450 at 120.  A distance test
        // therefore deadlocked above 25 mph: the clamp held the cop at exactly
        // 900 while this check saw 1125 and never started the clock, so it sat
        // behind the player forever and never struck.
        cop._lungeCd = (cop._lungeCd ?? FIRST_HOLD_BY_STAR[_starTier]) - dt;
        if (cop._lungeCd <= 0) {
          // ONE STRIKER AT A TIME — units rotate attacks like a real pursuit
          // (a primary unit engages, the rest hold formation) instead of
          // mobbing the bumper.  If another unit is mid-lunge, retry shortly
          // after it disengages; the random skew keeps two ready units from
          // firing on the same frame it frees up.
          if (this.cops.some(c => c !== cop && c._lungeT > 0)) {
            cop._lungeCd = 0.4 + Math.random() * 0.6;
          } else {
            cop._lungeT  = LUNGE_SEC;
            cop._lungeCd = LUNGE_GAP_MIN_BY_STAR[_starTier]
                         + Math.random() * LUNGE_GAP_SPAN_BY_STAR[_starTier];
          }
        }
      }
      const _lunging = cop._lungeT > 0;
      if (_lunging) {
        // A committed strike is driven off the LIVE speed, not the lagged
        // one: the cop has stopped reacting and is going for contact.  That
        // is also what keeps a lunge landing when the player is accelerating.
        cop.speed = Math.min(COP_TOP_UNITS,
                             playerSpeed + Math.max(playerSpeed * 0.12, LUNGE_CLOSE_MIN));
      }

      if (_guarded) {
        // DEMOTION.  A unit already in front when the gate closes (5* -> 3*,
        // or a token revoked) must fall back under its OWN braking.  Snapping
        // it behind the player would teleport a car across the screen.
        if (_copCarDist > 0) cop._demoting = true;
        if (cop._demoting) {
          cop.speed = Math.max(0, playerSpeed * 0.80);   // drift back
          if (_copCarDist <= -TAILGATE_GAP) cop._demoting = false;
        } else if (!_lunging) {
          // GUARD 1 — the speed ceiling, but ONLY across the last APPROACH_BAND
          // before the standoff.  It used to apply at every distance, which is
          // what made a cop a thousand feet back brake the instant the player
          // did (owner 2026-07-31).  Outside the band the cruiser keeps its own
          // pace and simply ARRIVES; inside it, it eases to the player's speed
          // so it settles in behind instead of slamming into the clamp.
          const _gap  = -_copCarDist;                      // >0 = behind the car
          const _into = (TAILGATE_GAP + APPROACH_BAND) - _gap;
          // REAR PURSUERS OPT OUT. This ceiling is `reactSpd * SPEED_CAP_BY_STAR`
          // — the player's own speed, lagged. It was the last place a cruiser's
          // pace was derived from the player's, and with independent physics it
          // would undo the profile the cop just drove to. Star escalation is
          // now expressed through faster, more aggressive PROFILES instead.
          // Non-rear kinds (which have no profile) keep it unchanged.
          if (_into > 0 && !cop.profile) {
            const _starIdx = Math.max(1, Math.min(5, _starTier));
            // Ceiling reads the LAGGED speed (owner 2026-08-04): keyed to the
            // live one it answered the throttle the same frame, so the gap
            // never moved no matter how the player drove.
            const _ceil    = reactSpd * SPEED_CAP_BY_STAR[_starIdx];
            // t: 1 at the band's outer edge (keep full speed) → 0 at station.
            const t = Math.max(0, Math.min(1, (_gap - TAILGATE_GAP) / APPROACH_BAND));
            const eased = _ceil + (cop.speed - _ceil) * t;
            cop.speed = Math.min(cop.speed, Math.max(_ceil, eased));
          }
        }
      } else {
        cop._demoting = false;
      }

      // Rear pursuers integrate inside driveCop; everything else here.
      if (!cop._selfIntegrated) cop.position += cop.speed * dt;
      cop._selfIntegrated = false;

      // GUARD 2 — hard positional clamp, applied AFTER integration because
      // that is the only place an overrun can be observed.  Skipped while
      // demoting so the fall-back stays smooth rather than snapping.
      if (_guarded && !cop._demoting && !cop.profile) {
        // A cop mid-LUNGE may close to contact; it still may not pass.
        const _limit = pursuitZ - (_lunging ? 0 : TAILGATE_GAP);
        if (cop.position > _limit) {
          cop.position = _limit;
          // Settle on the LAGGED speed too, or the clamp re-synced the cop to
          // the player's throttle every frame it touched — the "I speed up
          // and slow down and the cop never gains or loses a foot" report.
          cop.speed    = (cop.kind === 'rear' ? reactSpd : playerSpeed) * SETTLE_SPEED_MULT;
          // Hitting the clamp IS arriving on station — the one frame-rate
          // independent signal we have.  The hold clock keys off this.
          if (!_lunging) cop._onStation = true;
        } else if (_copCarDist < -(TAILGATE_GAP + STATION_TOL)) {
          cop._onStation = false;      // genuinely fell back off station
        }
      } else if (cop.profile && _guarded) {
        // SOFT FOLLOWING. No positional clamp — a profiled pursuer is allowed
        // to sit too close, fall back, brake late or overshoot, because that
        // variation IS the behaviour. The only correction left prevents
        // geometrically impossible overlap (a cop occupying the player's own
        // depth), and it nudges rather than snaps: no teleporting, and the
        // cop's speed is never reset to a player-derived value.
        const _overlap = cop.position - (pursuitZ - OVERLAP_MIN);
        if (_overlap > 0) {
          cop.position -= Math.min(_overlap, OVERLAP_MIN * dt * 4);
          cop.speed = Math.max(0, cop.speed - cop.profile.brake * cop.profile.maxSpeed * dt);
        }
        cop._onStation = Math.abs(_copCarDist) < cop.profile.preferredGap * 1.4;
      }

      // Despawn rules — different per kind.
      if (cop.kind === 'oncoming') {
        if (dist < -2500) this.cops.splice(i, 1);
      } else if (cop.kind === 'rear') {
        // A PURSUING cop does not quit because it fell behind.  The old rule
        // culled at dist < -10000, but _spawnCop seeds a rear cop 6-14k back —
        // PAST that line — and the cull runs in the same update() tick as the
        // spawn, so roughly half of all star-driven pursuers were deleted
        // before they ever rendered (the spawn cooldown was still spent:
        // "cops dispatched", no cop).  It also ended live chases outright
        // whenever the player out-ran the cruiser, with the star still lit.
        //
        // Pursuit now ends only the ways the player can actually cause it to:
        // a weapon (cop.fleeing, handled above), an arrest, letting the wanted
        // level decay out, or genuinely OUT-RUNNING the cruiser — you have to
        // put COP_ESCAPE_MILES between you and it (owner 2026-07-27).  Far
        // AHEAD is still culled: that's a stranded cruiser, not a chase.
        const carDist = cop.position - pursuitZ;
        // An onramp reinforcement is SUPPOSED to be ahead — don't cull it as a
        // stranded cruiser while it still holds its overtake token.
        const _legitAhead = cop._fromOnramp && cop._overtakeToken;
        if (dist > 30000 && !_legitAhead) this.cops.splice(i, 1);
        else if (carDist < -COP_ESCAPE_UNITS) { this._diverted.distance++; this.cops.splice(i, 1); }
        else if (this.stars < 1 && carDist < -10000) this.cops.splice(i, 1);
      } else if (cop.kind === 'barricade') {
        // Once player blows past the barricade, drop it.
        if (dist < -2500) this.cops.splice(i, 1);
      } else {
        if (dist < -3000  || dist > 80000) this.cops.splice(i, 1);
      }
    }
  }

  // Closest cop matching `side` ('front' | 'rear' | 'any').
  _closestCop(playerPos, side = 'any') {
    let best = null, bestDist = Infinity;
    for (const cop of this.cops) {
      if (!cop.alive) continue;
      const rel = cop.position - playerPos;
      if (side === 'front' && rel <= 0) continue;
      if (side === 'rear'  && rel >= 0) continue;
      const d = Math.abs(rel);
      if (d < bestDist) { best = cop; bestDist = d; }
    }
    return best;
  }

  getCopsForRender(playerPos) {
    // Front cops render via the road's vehicle projection; rear cops are
    // shown by GameScene as a "PURSUIT" indicator (see _renderHUD) since
    // the pseudo-3D camera can't display anything behind the player.
    return this.cops
      .map(cop => ({
        relativePos: cop.position - playerPos,
        laneOffset:  cop.laneOffset,
        color:       cop.color,
        side:        cop.side,
        kind:        cop.kind,
        colorSet:    cop.colorSet,
        speed:       cop.speed,
        parked:      cop.parked,
        flash:       this.lightFlash,
        // 1 for normal cops; a fleeing cop's fade-out multiplier (→0 at
        // despawn) so the forward view alpha-fades instead of popping.
        fleeFade:    cop.fleeing ? (cop._fleeFade ?? 1) : 1,
        // Synthetic bottom-edge exit (fleeing cops only): 0 = normal
        // projection, 1 = fully slid off the bottom of the screen.  The
        // renderer clamps draw depth at FLEE_EXIT_HOLD_REL and offsets
        // screen-Y down by this progress so the cruiser never blinks out
        // when rel drops below the projection floor.
        fleeing:     !!cop.fleeing,
        fleeExit:    cop.fleeing ? (cop._fleeExit ?? 0) : 0,
        // Rolling-coal smoke-out: the renderer drives its own bottom-edge sink
        // from relativePos (clamped at the REAL floor, not the far 4400 hold),
        // so a close cop recedes straight off the bottom instead of jumping
        // forward/shrinking then vanishing (owner 2026-07-17).
        coalFlee:    !!(cop.fleeing && cop._fleeNoSwerve),
        // Donut flee: the render pins draw depth at donutHoldRel so the cruiser
        // keeps its size and slides straight off the bottom (owner 2026-07-21).
        donutFlee:    !!(cop.fleeing && cop._donutLure != null),
        donutHoldRel: cop._donutHoldRel ?? 1500,
      }))
      // Fleeing cops stay in the render list through their whole synthetic
      // exit (even once rel drops below the projection floor / behind the
      // camera) so the forward view can slide them off the bottom edge.
      .filter(c => (c.relativePos > 0 && c.relativePos < 50000)
                || (c.fleeing && c.fleeExit < 1 && c.relativePos > FLEE_DESPAWN_REL && c.relativePos < 50000));
  }

  /** A strike landed — end the lunge and put the unit back on its standoff
   *  until the next attempt.  Without this a lunging cop pinned at the
   *  player's depth re-registers a rear ram every frame it sits there. */
  endLunge(cop) {
    if (!cop) return;
    // Tier floor of RAM_MIN_STARS: strikes only exist from 2★ up, so a
    // just-landed strike always has a valid cadence row to draw from.
    const t = Math.max(RAM_MIN_STARS, Math.min(MAX_STARS, this._starLevel ?? RAM_MIN_STARS));
    cop._lungeT  = 0;
    cop._lungeCd = LUNGE_GAP_MIN_BY_STAR[t] + Math.random() * LUNGE_GAP_SPAN_BY_STAR[t];
  }

  // Rear cops aren't visible in pseudo-3D; expose count + nearest distance.
  getRearCopInfo(playerPos) {
    let count = 0, nearest = -Infinity;
    for (const cop of this.cops) {
      const rel = cop.position - playerPos;
      if (rel < 0) {
        count++;
        if (rel > nearest) nearest = rel;
      }
    }
    return { count, nearestRelZ: count ? nearest : null };
  }

  // Display the floor — a star only appears once it's been fully earned.
  // Was Math.ceil, which made the HUD jump to "2" the instant raw stars
  // crossed 1.0 + a fractional heat tick.
  get starDisplay() { this._syncStarLevel(); return this._starLevel; }

  /**
   * Latch the DISPLAYED wanted level.
   *
   * `stars` is a float that decays continuously (1 per 60 s).  Reading it with
   * Math.floor meant any decay at all dropped the shown level instantly: start
   * a custom run at exactly 2 stars and one frame later stars is 1.9997, so
   * the HUD fell to 1 in 1/60th of a second (owner report 2026-07-29 — "two
   * stars, half a mile, down to one").  Math.ceil is not the answer either;
   * that was the ORIGINAL bug, where a fractional heat tick above 1.0 showed
   * a 2nd star that had not been earned.
   *
   * So latch it, with the two rules pulling in opposite directions:
   *   • GAIN only on a fully earned star  (stars >= level + 1)
   *   • LOSE only once a whole star has decayed away  (stars <= level - 1)
   *
   * Starting at 2.0 you now hold 2 stars for the full 60 s it takes to decay
   * one, and partial heat still never shows a star you have not earned.
   */
  _syncStarLevel() {
    const s = this.stars ?? 0;
    if (this._starLevel == null) this._starLevel = Math.floor(s);
    while (this._starLevel < MAX_STARS && s >= this._starLevel + 1) this._starLevel++;
    while (this._starLevel > 0        && s <= this._starLevel - 1) this._starLevel--;
    if (s <= 0) this._starLevel = 0;
    return this._starLevel;
  }
}
