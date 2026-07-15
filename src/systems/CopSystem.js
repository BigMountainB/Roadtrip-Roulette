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
 * Per-star spawn matrix:
 *   1★  → a single rear-pursuit cop (cap = 1)
 *   2★  → rear cops (cap scales up)
 *   3★  → + oncoming cops (left lanes only)
 *   4★  → + oncoming cops (any lane, replacing traffic feel)
 *   5★  → all of the above at maximum density
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
  COP_HEADONS_TO_ARREST, COP_PITS_TO_ARREST, COP_TOP_MPH,
} from '../constants.js';
import { clamp } from '../utils/Helpers.js';
import { Difficulty } from './Difficulty.js';
import { TimeOfDay } from '../world/TimeOfDay.js';
import { Weather }   from '../world/Weather.js';

// Cop top speed in internal world units.  MAX_SPEED is the player's 120 mph
// reference, so COP_TOP_MPH / 120 × MAX_SPEED is the cop's cap.
const COP_TOP_UNITS    = MAX_SPEED * (COP_TOP_MPH / 120);
// How fast oncoming traffic closes on the player (negative-direction speed
// in the world frame).  ~70 mph relative to a stationary world.
const ONCOMING_UNITS   = MAX_SPEED * (70 / 120);

// Normalize raw sprite token names → internal names used in useF12Token
const TOKEN_MAP = {
  f12_coal:   'coal',
  f12_fireworks: 'fireworks',
  f12_paint:  'paint_bomb',
};

export class CopSystem {
  constructor() {
    this.stars         = 0;
    this.starTimer     = 0;
    this.cops          = [];
    this.f12Tokens     = [];
    // Rolling-coal charge pool — each pickup adds 6 clouds (cap 18 = 3
    // pickups max).  The 'coal' token in f12Tokens is present whenever
    // coalAmmo > 0; each fire burns a charge, and the token is removed
    // when the pool hits 0.
    this.coalAmmo      = 0;
    this.lastStateLine = -1;

    this._spawnCooldown = 0;
    this._flashTimer    = 0;
    this.lightFlash     = false;
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
    this.cops.push({
      id:          Math.random(),
      position:    playerPos - (3000 + Math.random() * 3000),
      laneOffset:  (Math.random() - 0.5) * 0.6,
      speed:       MAX_SPEED * (COP_TOP_MPH / 120),
      baseSpeed:   MAX_SPEED * (COP_TOP_MPH / 120),
      side:        'rear',
      kind:        'rear',
      colorSet:    'police',
      color:       0xFFFFFF,
      alive:       true,
      painted:     false,
      _closeFactor: 0.10 + Math.random() * 0.06,
      _laneDrift:   0.4  + Math.random() * 0.4,
    });
  }

  /** Speed-trap civil-stop pursuer (0★ layer, Stage 1).  Same rear-pursuit
   *  cop as an encounter spawn, but TAGGED so the comply window can pull it
   *  back off cleanly (player pulled over) or promote it into the normal
   *  wanted system (player ignored the stop → +1★). */
  _spawnTrapPursuit(playerPos) {
    this._spawnRearFromEncounter(playerPos);
    const cop = this.cops[this.cops.length - 1];
    if (cop) {
      cop.trapPursuit = true;
      // Pull the civil-stop cruiser in CLOSE behind (≈40-65 ft) so it's plainly
      // visible in the mirror as it lights you up — a far rear-spawn at 0★ was
      // easy to miss entirely.
      cop.position   = playerPos - (2400 + Math.random() * 1500);
      cop.laneOffset = (Math.random() - 0.5) * 0.4;
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

  /** Player complied with the civil stop — drop the trap pursuer(s). */
  endTrapPursuit() {
    this.cops = this.cops.filter(c => !c.trapPursuit);
  }

  /** Comply window expired — the trap pursuer becomes a regular wanted-level
   *  cop (so it keeps chasing as the player enters the 1★ system). */
  promoteTrapPursuit() {
    for (const c of this.cops) if (c.trapPursuit) c.trapPursuit = false;
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
    // First row ~14k units ahead so the player has time to read the maze.
    const firstRowZ = playerPos + 14000 + Math.random() * 4000;
    // 5 lane slots across the drivable width; the gap is one (or two,
    // on Easy) of these.
    const laneSlots = [-0.8, -0.4, 0, 0.4, 0.8];
    const easy      = Difficulty.mode?.() === 'easy';
    const rows      = easy ? 2 : 3;
    const gapWidth  = easy ? 2 : 1;               // adjacent open slots per row
    // Row spacing — ~0.4s of reaction at highway speed (≈100 mph is
    // 22.5k units/s), tight enough to force a real weave but dodgeable.
    const rowGapZ   = easy ? 11000 : 9000;
    let prevGap = -1;
    for (let r = 0; r < rows; r++) {
      const rowZ = firstRowZ + r * rowGapZ;
      // Pick the gap's leftmost slot — never the same as the previous
      // row's, so consecutive rows always force a lane change.
      const maxGapIdx = laneSlots.length - gapWidth;
      let gapIdx;
      do { gapIdx = (Math.random() * (maxGapIdx + 1)) | 0; } while (gapIdx === prevGap);
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
    // 4★+: SWAT vans join the mix (~30 % of spawns), they hit harder
    // and use a heavier sprite.  Rest splits between rear pursuit and
    // anywhere-oncoming standard cops.
    if (r < 0.30) return 'swat';
    if (r < 0.65) return 'rear';
    return 'oncoming-any';
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
      position   = playerPos - (6000 + Math.random() * 8000);
      laneOffset = (Math.random() - 0.5) * 0.6;
      speed      = COP_TOP_UNITS;
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
    });
  }

  addStar(amount = 1, sourceCap = MAX_STARS) {
    // starCapMax = sex-worker "dirt-on-a-politician" hard cap (while active).
    // sourceCap lets the CALLER cap its own contribution: driving / collision
    // heat passes 3, so reckless DRIVING can only ever reach 3★ — using a
    // WEAPON on a cop is the sole path into 4-5★.  Never reduces below the
    // current level (a low sourceCap can't pull a weapon-earned 5★ down).
    const hardCap = (this.starCapMax != null) ? this.starCapMax : MAX_STARS;
    // Cocaine "sloppy" multiplier — GameScene stamps phys.cocaineStarMul
    // onto this._starGainMul each frame so we don't have to plumb the
    // multiplier through every addStar call site.
    // Difficulty.starGainMul (Easy 0.5×) only softens FRACTIONAL drip heat
    // (collision bumps etc.).  Whole-star gains (amount >= 1) are announced
    // events — "Failed to pull over! +1★", "WANTED LEVEL ACTIVATED", the
    // fireworks spectacle star — and must land a full DISPLAY star: halving
    // them made the popup promise +1★ while floor(stars) never moved
    // (2026-07-14 playtest bug).  _starGainMul (cocaine >1× / steroid 0×)
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
      this.cops = this.cops.filter(c => c.colorSet !== 'swat');
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
      // Each coal pickup grants 6 clouds up to a cap of 18.  The token
      // is present whenever coalAmmo > 0 (driven by the inventory render).
      this.coalAmmo = Math.min(18, this.coalAmmo + 6);
      if (!this.f12Tokens.includes('coal')) this.f12Tokens.push('coal');
      return;
    }
    this.f12Tokens.push(type);
  }

  /** Per-type cap.  Rolling coal caps at 18 clouds (= 3 pickups); other
   *  types cap at 3 tokens. */
  canCarryMore(type) {
    if (type === 'coal') return this.coalAmmo < 18;
    let count = 0;
    for (const t of this.f12Tokens) if (t === type) count++;
    return count < 3;
  }

  /** Inventory count surfaced in the HUD.  Rolling coal returns its cloud
   *  total (so the badge reads ×6/×12/×18); other types return their stack
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
        // Rolling coal — a rear-only diesel smokescreen.  Every ACTIVE
        // pursuer behind the player (within the cloud's reach) drives into
        // the smoke, loses sight, falls back and despawns — the same
        // fleeing pipeline, flagged `_fleeNoSwerve` so
        // they sink straight back into the cloud instead of swerving for
        // the shoulder.  STEALTHY: no kills, no stars, no escalation —
        // firing with nobody behind just wastes the cloud.  Parked /
        // roadside encounter sprites are untouched (smoke isn't a weapon).
        let smoked = 0;
        for (const cop of this.cops) {
          const rel = cop.position - playerPos;
          // The cloud erupts off the REAR of the car, but pursuers don't
          // sit politely behind it: the rear-cop AI oscillates around
          // rel ≈ 0 (alongside at playerSpeed + 200, throttling back once
          // slightly ahead).  The old strict `rel < 0` test excluded
          // exactly the cops actively ramming — they kept pursuing right
          // through the smoke (bug, 2026-07-14).  Anything from 15k behind
          // up to ~2.5k ahead (the alongside / nose-ahead pressure band)
          // is IN the cloud.  Stationary barricade rows aren't chasing by
          // sight, so smoke can't shake them.
          if (cop.kind !== 'barricade' && rel < 2500 && rel > -15000) {
            cop.fleeing       = true;
            cop._fleeNoSwerve = true;
            cop._fleeTimer    = 1.6 + Math.random() * 0.8;   // staggered fade-outs
            cop.trapPursuit   = false;
            cop.parked        = false;
            cop._pitProgress  = 0;
            cop._pitArmed     = false;
            smoked++;
          }
        }
        if (smoked > 0) {
          // Nobody can see you to bust you — reset the counters and hold
          // off the replacement spawn so the escape actually registers
          // (same guard as the fireworks wipe / weaponPulledAtTrap).
          this.bumpCount      = 0;
          this.rearBumpCount  = 0;
          this.headOnCount    = 0;
          this.pitCount       = 0;
          this.arrestPending  = false;
          this._spawnCooldown = Math.max(this._spawnCooldown ?? 0, 2.5);
        }
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
        this.arrestPending  = false;
        this._spawnCooldown = Math.max(this._spawnCooldown ?? 0, 2.5);
        return { ok: true, victims: [], deferredVictims: deferred, weapon: type };
      }

      case 'paint_bomb': {
        // Donuts — the player lays a smoking burnout that transfixes
        // every cop on the road.  All pursuit stops cold for 15 seconds
        // (handled in update(): cops freeze and no fresh pursuit spawns).
        // It's a pure DISTRACTION — no cars are removed and your wanted
        // level doesn't change (no reduce, no escalate).  Non-directional:
        // direction is ignored since it stalls cops everywhere.
        this._donutPauseTimer = 15;
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

  update(dt, playerPos, playerSpeed, playerX = 0) {
    this._flashTimer += dt;
    if (this._flashTimer > 0.25) { this._flashTimer = 0; this.lightFlash = !this.lightFlash; }

    // Donut pursuit-freeze — tick the 15s "cops stall" window down.
    if (this._donutPauseTimer > 0) this._donutPauseTimer -= dt;

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

    if (this.stars > 0) {
      this.starTimer -= dt;
      // One full star decays per minute of real time — 1★ in 60s,
      // 2★ in 120s, up to 4★ in 240s.  5★ is the exception: helicopter
      // is overhead and the wanted level is LOCKED.  Only a rest-stop
      // paint job (`clearStars`) drops the player out of 5★.
      if (this.starTimer <= 0 && !this.helicopterActive) {
        this.stars = Math.max(0, this.stars - dt / 60);
        if (this.stars < 0.5) {
          this.bumpCount = this.rearBumpCount = this.headOnCount = this.pitCount = 0;
          this.arrestPending = false;
        }
      }
    }

    // Spawning — proactive rear pursuit kicks in at 1★ (a single chase car;
    // see the `cap` below) and scales up from 2★.  Random-roadside encounters
    // baked into the route (GameScene) still layer on top.
    // Difficulty.copEscalationMul scales BOTH the active-cop cap and the
    // spawn cooldown — Easy 0.7× cops + slower respawn, Hard 1.5× cops +
    // faster respawn.  TimeOfDay.darkness() adds an extra +30% at full
    // night (graveyard-shift cops are out in force).
    this._spawnCooldown -= dt;
    const escMul = Difficulty.copEscalationMul();
    const _mileForCops = (playerPos / (ROUTE_SEGS * SEG_LENGTH)) * TOTAL_ROUTE_MILES;
    const nightMul = 1 + TimeOfDay.darkness(_mileForCops) * 0.30;
    // 1★ is a SINGLE chase car; 2★+ scales the active-cop cap with stars,
    // difficulty, and night density.
    const cap = this.stars < 2
      ? 1
      : Math.max(2, Math.ceil(this.stars * 1.35 * escMul * nightMul));
    // Cop-killer head start — after a weapon kill, fresh pursuit holds off
    // until the player has driven the 3-5 mi grace distance (set in
    // useF12Token).  Lets them reach a rest stop to disguise / paint / bus.
    const inGrace = _mileForCops < (this._pursuitGraceMile ?? 0);
    // Donuts freeze active → no new pursuit spawns for the window.
    const donutFreeze = this._donutPauseTimer > 0;
    if (this.stars >= 1 && this._spawnCooldown <= 0 && this.cops.length < cap && !inGrace && !donutFreeze) {
      this._spawnCop(playerPos);
      this._spawnCooldown = Math.max(0.8, (5.5 - this.stars * 0.9) / (escMul * nightMul));
    }

    // ── 5★ extras: barricades + helicopter ─────────────────────────
    // At max wanted level the highway gets cluttered with rolling
    // road-block formations and a permanent chopper overhead.
    this._barricadeCooldown = (this._barricadeCooldown ?? 0) - dt;
    if (this.stars >= 5 && this._barricadeCooldown <= 0) {
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
    this.helicopterActive = this.stars >= 4.75;
    if (this.helicopterActive) {
      this.helicopterPos     = playerPos + 1500;          // visually ahead-above
      this.helicopterPhase   = (this.helicopterPhase ?? 0) + dt;
    }

    // Drive each cop's behavior by its kind.
    for (let i = this.cops.length - 1; i >= 0; i--) {
      const cop = this.cops[i];
      const dist  = cop.position - playerPos;
      const aDist = Math.abs(dist);

      // Fireworks scatter / coal smoke-out — the cop breaks pursuit and
      // drops back until its retreat timer expires, then despawns.  Skips
      // all pursuit AI so a fleeing cop can never PIT / ram on the way out.
      // Fireworks flee swerves for the shoulder; rolling coal sets
      // `_fleeNoSwerve` so the blinded cop just sinks straight back into
      // the smoke (lost sight — no dramatic swerve).
      if (cop.fleeing) {
        cop._fleeTimer = (cop._fleeTimer ?? 2.5) - dt;
        // Fade OUT instead of popping — alpha eases to zero over the
        // retreat's final ~1s, so by the time the timer splices the cop
        // it's already invisible (shrunk by distance + swallowed by the
        // coal cloud).  Renderers read it via getCopsForRender().fleeFade
        // (forward view) or cop._fleeFade directly (rear-view mirror).
        cop._fleeFade = Math.max(0, Math.min(1, cop._fleeTimer / 1.0));
        if (!cop._fleeNoSwerve) {
          cop.laneOffset += (cop.laneOffset >= 0 ? 1 : -1) * 2.4 * dt;
        }
        cop.speed = Math.max(0, playerSpeed * (cop._fleeNoSwerve ? 0.35 : 0.5));
        cop.position += cop.speed * dt;
        if (cop._fleeTimer <= 0) this.cops.splice(i, 1);
        continue;
      }
      // Parked at a civil traffic stop — pinned behind the stopped player,
      // no pursuit AI / PIT / drift until endTrapPursuit() removes it.
      if (cop.parked) {
        cop.speed = 0;
        continue;
      }
      // Donut freeze — pursuit halted for the whole window.  The cop
      // sits still (so the player drives off and it despawns behind them)
      // and any armed PIT is disarmed so a stalled cop can't bust you.
      if (this._donutPauseTimer > 0) {
        cop.speed = 0;
        cop._pitProgress = 0;
        cop._pitArmed    = false;
      }
      // Disabled override — EMP stops the car flat for a custom timer.
      else if (cop.empTimer > 0) {
        cop.empTimer -= dt; cop.speed = 0;
      } else {
        switch (cop.kind) {
          case 'rear': {
            // ALWAYS closing while behind — but once alongside or ahead,
            // throttle back to the player's pace so we stick to them
            // instead of zooming off into the distance.  The previous
            // "always playerSpeed + closing" formula made cops sail past
            // the player and despawn off-screen, leaving the chase blank.
            const closing = Math.max(playerSpeed * 0.10, 600);
            if (dist > 0) {
              // Cop is AHEAD of player — slow down so the player either
              // catches up or the cop drifts back into PIT range.
              cop.speed = Math.max(0, playerSpeed * 0.92);
            } else if (aDist < 1500) {
              // Alongside / very close behind — match player speed with a
              // tiny forward bias to keep PIT pressure on.
              cop.speed = playerSpeed + 200;
            } else {
              // Far behind — full closing rate.
              cop.speed = Math.min(COP_TOP_UNITS, playerSpeed + closing);
            }
            // Once alongside the player, hold the lateral position so PIT
            // detection in GameScene can fire on side-swipe contact.
            // Pass-3: cops feel weather grip too — on snow/rain they
            // close the lateral gap slower (and thus PIT slower), giving
            // the player a real evasion window in bad weather.
            if (aDist < 800) {
              const _copMile = (cop.position / (ROUTE_SEGS * SEG_LENGTH)) * TOTAL_ROUTE_MILES;
              const _copGrip = Weather.gripMul?.(_copMile) ?? 1;
              const dx = playerX - cop.laneOffset;
              cop.laneOffset += Math.sign(dx) * Math.min(0.6, Math.abs(dx)) * dt * _copGrip;
              // PIT-arming — sustained alongside lock at close range arms
              // the cop so the next side contact registers as a successful
              // PIT strike.  Was previously only on pursuit-front; now
              // belongs on rear cops since pursuit-front is gone.
              const lateralLock = Math.abs(playerX - cop.laneOffset) < 0.18;
              if (lateralLock) {
                cop._pitProgress = (cop._pitProgress ?? 0) + dt;
                if (cop._pitProgress > 0.65) cop._pitArmed = true;
              } else {
                cop._pitProgress = Math.max(0, (cop._pitProgress ?? 0) - dt * 1.4);
                if (cop._pitProgress <= 0) cop._pitArmed = false;
              }
            } else {
              cop._pitProgress = 0;
              cop._pitArmed    = false;
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
      cop.position += cop.speed * dt;

      // Despawn rules — different per kind.
      if (cop.kind === 'oncoming') {
        if (dist < -2500) this.cops.splice(i, 1);
      } else if (cop.kind === 'rear') {
        if (dist < -10000 || dist > 30000) this.cops.splice(i, 1);
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
      }))
      .filter(c => c.relativePos > 0 && c.relativePos < 50000);
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
  get starDisplay() { return Math.floor(this.stars); }
}
