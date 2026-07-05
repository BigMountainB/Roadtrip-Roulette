/**
 * ViceSystem — tracks active vice levels, unlocks, OD state
 *
 * Each vice has a level 0–1.
 * Level fills on pickup, decays over time.
 * At threshold: OD triggers (game over for most vices).
 * Weed is the exception — cannot OD, just makes you very slow.
 *
 * Unlock tree (checked each update):
 *   cocaine   → alcohol > 0.3 for > 30s total
 *   shrooms   → alcohol > 0.4 AND weed > 0.4 simultaneously
 *   lsd       → shrooms bar ever reached >= 0.75
 *   heroin    → distance > 50% of route
 *   rx        → cocaine > 0.5 (simulates "calming down")
 *   fentanyl  → heroin bar ever reached >= 0.6
 *   ketamine  → lsd bar ever reached >= 0.5
 */
import { VICES, VICE_CONFIG, VICE_COMBOS } from '../constants.js';
import { Difficulty } from './Difficulty.js';

// Pickup amounts — per the user's vice-design spec.  Hits-to-max varies
// wildly by vice: 14 beers vs 2 fentanyl, etc.  Many vices also trigger
// cross-vice or per-pickup effects (see ViceSystem.pickup + GameScene).
const PICKUP_AMOUNTS = {
  sushi:  0.18,    // 18% — bigger sips so a beer line spikes a real buzz that
                     // survives the realistic ~65s decay (raised from 7% 2026-06-22)
  burrito:     0.125,   // 12.5% base; tolerance kicks in past 60%
  energy:  0.10,    // 10% per line → 10 lines fills the bar, 11th ODs (per
                     // user 2026-07-01: "10 lines OD, each hit is 10%")
  gummies:  0.20,    // 20% — fastest visual ramp
  hotdog:      0.25,    // 25% — fastest of all
  combo:   0.30,    // 30%
  coldbrew:       0.18,    // 18% — one pill is a real dose (raised from 8.5% 2026-06-23)
  coma: 0.55,    // 55% — 2 hits OD at ≥1.00
  slushie: 0.15,    // 15% — dissociative, scales with redosing (was 10%)
  caffeine:     0.25,    // 25% — most potent + longest stimulant high (was 10%)
};

export class ViceSystem {
  constructor() {
    this.levels    = {};
    this.unlocked  = {};
    this.maxReached = {}; // highest level each vice has ever reached

    // Unlock tracking
    this.totalDrunkTime   = 0;
    this.routeProgress    = 0; // 0–1, updated by GameScene
    // Lifetime NPC-crash counter — feeds the rx unlock gate.
    this.npcCrashesTotal   = 0;
    this.cocainePickupCount = 0; // each pickup permanently raises top speed +4 mph
    this.pickupCounts       = {};
    // Vices that crossed their unlock gate THIS frame — GameScene drains this
    // to force a guaranteed "first line" of the new vice so the player can
    // actually try what they just earned (esp. on short runs).
    this._firstLineQueue    = [];
    // Active-combo timestamp tracker — initialised here so getActiveCombos
    // doesn't have to lazy-init on first call (audit caught this).
    this._comboActivatedAt  = {};
    for (const id of Object.values(VICES)) this.pickupCounts[id] = 0;

    for (const id of Object.values(VICES)) {
      this.levels[id]     = 0;
      this.unlocked[id]   = VICE_CONFIG[id].unlocked ?? false;
      this.maxReached[id] = 0;
    }
  }

  /** Hydrate persistent unlock state from prior runs (registry-backed).
   *  Once unlocked, vices stay unlocked through arrests/deaths until the
   *  player ends the game. */
  hydrateUnlocks(savedUnlocks) {
    if (!savedUnlocks || typeof savedUnlocks !== 'object') return;
    for (const id of Object.keys(savedUnlocks)) {
      if (savedUnlocks[id]) this.unlocked[id] = true;
    }
  }

  /** Snapshot current unlocked state — caller stashes into the registry. */
  snapshotUnlocks() {
    return { ...this.unlocked };
  }

  /** Restore meta-progress that gates partial unlocks across scene
   *  restarts.  Right now this is just the meth Phase-1 flag (cocaine has
   *  ever peaked ≥0.40) — without this, taking a rest stop after a coke
   *  spike resets the gate and the player can never get to Phase 2's
   *  30-second clean window. */
  hydrateProgress(saved) {
    if (!saved || typeof saved !== 'object') return;
    if (saved.methPhase1) this._methPhase1 = true;
    if (typeof saved.cocainePeak === 'number') {
      this.maxReached[VICES.ENERGY] = Math.max(
        this.maxReached[VICES.ENERGY] ?? 0, saved.cocainePeak);
    }
  }

  /** Snapshot meta-progress for the registry. */
  snapshotProgress() {
    return {
      methPhase1:  !!this._methPhase1,
      cocainePeak: this.maxReached[VICES.ENERGY] ?? 0,
    };
  }

  /** Top up every unlocked vice bar to a safe 60% — keeps the player from
   *  walking out of a rest stop into an instant fent OD.  Bars already
   *  above 60% are left alone.  IMPORTANT: do NOT bump `maxReached` —
   *  the LSD / fentanyl unlock gates read maxReached for shrooms /
   *  heroin, so writing CAP there would chain-unlock the downstream
   *  vices without the player ever peaking the prerequisite bar. */
  refillAll() {
    const CAP = 0.60;
    for (const id of Object.values(VICES)) {
      if (!this.unlocked[id]) continue;
      // Don't dial back a player who's already higher than the cap.
      if ((this.levels[id] ?? 0) >= CAP) continue;
      this.levels[id] = CAP;
    }
  }

  update(dt) {
    let anyActive = false;
    const cokeLevel = this.levels[VICES.ENERGY] ?? 0;
    // Custom mode — vice levels are user-set sandbox values, so they
    // hold steady (no decay).  Still tally maxReached + anyActive so
    // bar rendering and combo detection work normally.
    const noDecay = Difficulty.noScore?.() === true;
    // Permastoned hold — once the weed bar hits 100% it should freeze
    // there until the 10-mile timer trips.  We can't gate on
    // `_weedAt100StartPos` because that field is populated by
    // `notePermastonedTick`, which runs AFTER `update()` — so on the
    // first frame at 100% the decay would shave the bar back below 1.0
    // before the timer could even start.  Gate purely on the bar level.
    const weedPermastonedActive = (this.levels[VICES.BURRITO] ?? 0) >= 1.0
      && !this._weedPermastonedLocked;

    for (const id of Object.values(VICES)) {
      const cfg   = VICE_CONFIG[id];
      const level = this.levels[id];

      if (level > 0) {
        anyActive = true;
        if (level > this.maxReached[id]) this.maxReached[id] = level;
        // Custom mode freezes every bar — no decay, no metabolism.
        if (noDecay) continue;
        // Weed bar holds at 100% during the Permastoned window — no decay
        // until the 10-mi mark trips and the bar is force-reset to 0.
        if (id === VICES.BURRITO && weedPermastonedActive) continue;
        let decay = cfg.decayRate;
        // Alcohol asymmetric decay — first 50 % of the bar sticks around
        // (decay ×0.6) so it's easy to stay tipsy; above 50 % the body
        // burns it off faster (decay ramps up to ×2.5 at full bar) so
        // extreme drunkenness wears off quickly.  Net: easier to reach
        // and maintain a buzz, harder to stay maxed.
        if (id === VICES.SUSHI) {
          if (level <= 0.5) {
            decay *= 0.6;
          } else {
            const t = (level - 0.5) / 0.5;        // 0 at 50 %, 1 at 100 %
            decay *= 0.6 + (2.5 - 0.6) * t;       // 0.6 → 2.5
          }
        }
        // Cocaine speeds up alcohol metabolism (~2× faster at full coke bar)
        if (id === VICES.SUSHI && cokeLevel > 0.1) {
          decay *= 1 + cokeLevel * 1.2;
        }
        this.levels[id] = Math.max(0, level - decay * dt);
      }
    }

    // Drunk-time tracking (for cocaine unlock)
    if (this.levels[VICES.SUSHI] > 0.3) {
      this.totalDrunkTime += dt;
    }

    // Unlock checks
    this._checkUnlocks(dt);

    return anyActive;
  }

  /** Called by GameScene each frame with the player's current world-Z
   *  position.  Tracks the Permastoned window: weed bar at 100% for
   *  10 in-game miles → fire achievement, force-reset weed to 0,
   *  permanently lock weed pickups for the remainder of the run.
   *
   *  `posUnitsPerMile` lets the system convert relative position units
   *  to miles without importing constants. */
  notePermastonedTick(playerPos, posUnitsPerMile) {
    if (this._weedPermastonedLocked) return null;
    const weed = this.levels[VICES.BURRITO] ?? 0;
    if (weed < 1.0) {
      this._weedAt100StartPos = null;
      return null;
    }
    if (this._weedAt100StartPos == null) {
      this._weedAt100StartPos = playerPos;
      return null;
    }
    const milesAt100 = (playerPos - this._weedAt100StartPos) / posUnitsPerMile;
    if (milesAt100 >= 10) {
      this._weedPermastonedLocked = true;
      this.levels[VICES.BURRITO]     = 0;
      this._weedAt100StartPos     = null;
      return { permastoned: true };
    }
    return null;
  }

  isPermastoned() { return !!this._weedPermastonedLocked; }

  /** Per-frame unlock check.  Updated thresholds per player spec:
   *    cocaine   → 30s drunk
   *    shrooms   → both alcohol AND weed have ever been ingested (any pickup)
   *    lsd       → shrooms bar ever hit 0.30
   *    heroin    → 20% route progress
   *    rx        → cocaine bar ever hit 0.30
   *    fentanyl  → heroin bar ever hit 0.50
   *    ketamine  → lsd bar ever hit 0.40
   *    meth      → cocaine bar hit 0.40 then dropped back to 0 for 30s
   *
   *  Once unlocked, vices stay unlocked for the rest of the run — even
   *  through arrests/deaths.  Unlocks persist via the Phaser registry
   *  (hydrated on each GameScene._doCreate; see viceUnlocks key).
   */
  /** Flip a vice to unlocked and queue its guaranteed first line.  No-ops if
   *  already unlocked (so persisted unlocks from a prior run don't re-queue). */
  _unlock(id) {
    if (this.unlocked[id]) return;
    this.unlocked[id] = true;
    this._firstLineQueue.push(id);
  }

  /** GameScene drains this each frame; returns vice ids unlocked since the
   *  last drain and clears the queue. */
  drainFirstLineQueue() {
    if (!this._firstLineQueue.length) return [];
    const q = this._firstLineQueue;
    this._firstLineQueue = [];
    return q;
  }

  _checkUnlocks(dt = 0) {
    const u = this.unlocked;

    if (!u[VICES.ENERGY] && this.totalDrunkTime > 30) {
      this._unlock(VICES.ENERGY);
    }

    // Shrooms unlock once both beer AND weed bars are ≥ 30% AT THE SAME
    // TIME (not just historically ingested) — the player has to be drunk
    // and stoned simultaneously, not stage them separately.
    if (!u[VICES.GUMMIES]
      && (this.levels[VICES.SUSHI] ?? 0) >= 0.30
      && (this.levels[VICES.BURRITO]    ?? 0) >= 0.30) {
      this._unlock(VICES.GUMMIES);
    }

    if (!u[VICES.HOTDOG] && this.maxReached[VICES.GUMMIES] >= 0.50) {
      this._unlock(VICES.HOTDOG);
    }

    if (!u[VICES.COMBO] && this.routeProgress >= 0.20) {
      this._unlock(VICES.COMBO);
    }

    // Rx unlocks once the player has bumped 50+ NPC cars (the player is
    // generating their own legal mess that begs prescription painkillers).
    // GameScene tracks `npcCrashesTotal` on the registry-shared vices
    // instance via `recordNpcCrash`.
    if (!u[VICES.COLDBREW] && (this.npcCrashesTotal ?? 0) >= 50) {
      this._unlock(VICES.COLDBREW);
    }

    if (!u[VICES.COMA] && this.maxReached[VICES.COMBO] >= 0.50) {
      this._unlock(VICES.COMA);
    }

    if (!u[VICES.SLUSHIE] && this.maxReached[VICES.HOTDOG] >= 0.40) {
      this._unlock(VICES.SLUSHIE);
    }

    // Meth — special two-phase gate.  Phase 1 fires once cocaine bar
    // peaks ≥ 0.40.  Phase 2 then waits for the player to clean out
    // (cocaine = 0) and stay clean for 30 sustained seconds.
    if (!u[VICES.CAFFEINE]) {
      if (this.maxReached[VICES.ENERGY] >= 0.40) {
        this._methPhase1 = true;
      }
      if (this._methPhase1) {
        if ((this.levels[VICES.ENERGY] ?? 0) <= 0.0001) {
          this._methCleanTime = (this._methCleanTime ?? 0) + dt;
          if (this._methCleanTime >= 30) this._unlock(VICES.CAFFEINE);
        } else {
          this._methCleanTime = 0;       // reset if any coke shows up again
        }
      }
    }
  }

  /** Active named combos: returns array of combo descriptors currently in
   *  effect, ORDERED so the HUD's first pick prefers (1) higher-arity
   *  combos, then (2) the combo whose vices have the highest summed
   *  levels.  For 2-way combos this naturally selects the pair that
   *  matches the player's two highest bars; for 3+-way combos it surfaces
   *  the most-developed multi-vice name (per user spec). */
  getActiveCombos() {
    if (!this._comboActivatedAt) this._comboActivatedAt = {};
    const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    const out = [];
    for (const [key, combo] of Object.entries(VICE_COMBOS)) {
      const allActive = combo.vices.every(id => (this.levels[id] ?? 0) >= combo.threshold);
      if (allActive) {
        if (this._comboActivatedAt[key] == null) this._comboActivatedAt[key] = now;
        const sum = combo.vices.reduce((s, id) => s + (this.levels[id] ?? 0), 0);
        out.push({ key, ...combo, _t: this._comboActivatedAt[key], _sum: sum });
      } else if (this._comboActivatedAt[key] != null) {
        delete this._comboActivatedAt[key];
      }
    }
    out.sort((a, b) => {
      if (a.vices.length !== b.vices.length) return b.vices.length - a.vices.length;
      return b._sum - a._sum;
    });
    return out;
  }

  pickup(viceType) {
    const id = this._mapPickupType(viceType);
    if (!id || !this.unlocked[id]) return false;

    // Permastoned lockout — once weed has been Permastoned-locked, the
    // road suppresses weed pickups so this should rarely fire, but the
    // double-check keeps any stray pickup honest.
    if (id === VICES.BURRITO && this._weedPermastonedLocked) return false;

    const cfg    = VICE_CONFIG[id];
    let amount   = PICKUP_AMOUNTS[id] ?? 0.12;

    // Weed tolerance — 12.5% per hit until the bar hits 60%, then a flat
    // 5% per hit (per user spec).  Below 60% lets the player ramp up
    // quickly; above 60% it takes ~8 more hits to reach the Permastoned
    // 100% lock-in point.
    if (id === VICES.BURRITO) {
      amount = this.levels[id] < 0.60 ? 0.125 : 0.05;
    }

    const prevLevel = this.levels[id];
    const newLevel  = Math.min(1, prevLevel + amount);
    this.levels[id] = newLevel;

    // ── Cross-vice pickup effects ─────────────────────────────────────
    // Beer lowers each OTHER vice by 5 percentage points only while that
    // bar is above 45%, so it can curb dangerous highs without wiping
    // early-stage effects. Cocaine burns 7 points off alcohol. Rx
    // multiplies every OTHER vice bar by 0.9 (10% off its current amount).
    const dropBy = (other, delta) => {
      this.levels[other] = Math.max(0, (this.levels[other] ?? 0) - delta);
    };
    if (id === VICES.SUSHI) {
      for (const otherId of Object.values(VICES)) {
        if (otherId === VICES.SUSHI) continue;
        if ((this.levels[otherId] ?? 0) > 0.45) dropBy(otherId, 0.05);
      }
    }
    if (id === VICES.ENERGY) {
      dropBy(VICES.SUSHI, 0.07);
    }
    if (id === VICES.COLDBREW) {
      for (const otherId of Object.values(VICES)) {
        if (otherId === VICES.COLDBREW) continue;
        this.levels[otherId] = Math.max(0, (this.levels[otherId] ?? 0) * 0.9);
      }
    }

    // Per-pickup permanent stat counters — read by GameScene for cumulative
    // top-speed bonuses (+4 mph / cocaine bag, +4 mph / meth pickup) and
    // for Rx-driven NPC traffic-speed shifts (+/-7 mph / Rx pickup).
    if (id === VICES.ENERGY) this.cocainePickupCount += 1;
    this.pickupCounts[id] = (this.pickupCounts[id] ?? 0) + 1;

    // Immediate OD check (2026-06-20) — every OD-capable vice now uses
    // odThreshold 1.0001, so OD fires only when a pickup would OVERFILL an
    // already-maxed bar.  The stored level is capped at 1.0, so we test the
    // UNCAPPED dose (prevLevel + amount): you OD by taking one hit too many on
    // a full bar, uniform across all dangerous vices.  Alcohol/weed are
    // canOD:false, so they still fill safely.
    const odThr = cfg.odThreshold ?? 1.0;
    if (cfg.canOD && (prevLevel + amount) >= odThr) {
      return { overdose: true, vice: id };
    }
    return { overdose: false, vice: id };
  }

  /** Cocaine speed boost in MPH (additive on top of 120 base).  +4 mph per
   *  bag picked up, scaled by the CURRENT bar so the boost fades to 0 as the
   *  vice leaves your system (effect is tied to the active high, not lifetime
   *  count). */
  getCocaineSpeedBonusMPH() {
    return this.cocainePickupCount * 4 * (this.levels[VICES.ENERGY] ?? 0);
  }

  /** Meth speed boost in MPH (+4 mph per pickup), scaled by the current meth
   *  bar so it dissipates as the bar empties. */
  getMethSpeedBonusMPH() {
    return (this.pickupCounts[VICES.CAFFEINE] ?? 0) * 4 * (this.levels[VICES.CAFFEINE] ?? 0);
  }

  /** Rx-driven NPC traffic-speed offset in MPH (±7 mph per pickup), scaled by
   *  the current Rx bar so traffic returns to normal as the Rx wears off.
   *  Read by GameScene._updateTraffic. */
  getRxNpcSpeedShiftMPH() {
    return (this.pickupCounts[VICES.COLDBREW] ?? 0) * 7 * (this.levels[VICES.COLDBREW] ?? 0);
  }

  /** Weighted-random pick of an UNLOCKED vice, biased by lifetime pickups
   *  (addiction) AND cross-tolerance (heavy uppers depress downers and vv).
   *  Maps internal IDs back to RouteData/_mapPickupType pickup names. */
  chooseAddictedVice(routeProgress = 0) {
    const ID_TO_PICKUP = {
      sushi: 'sushi', burrito: 'burrito', energy: 'energy', gummies: 'gummies',
      hotdog: 'hotdog', combo: 'combo', coldbrew: 'coldbrew', coma: 'coma',
      slushie: 'slushie', caffeine: 'caffeine',
    };
    const UPPERS  = new Set(['energy', 'caffeine', 'coldbrew']);
    const DOWNERS = new Set(['sushi', 'burrito', 'combo', 'coma', 'slushie']);

    // Cross-tolerance ratio
    let upTotal = 0, dnTotal = 0;
    for (const id of Object.values(VICES)) {
      const c = this.pickupCounts[id] ?? 0;
      if (UPPERS.has(id))  upTotal += c;
      if (DOWNERS.has(id)) dnTotal += c;
    }
    const upDominant = upTotal > 2 * (dnTotal + 1);
    const dnDominant = dnTotal > 2 * (upTotal + 1);

    const candidates = [];
    let totalW = 0;
    for (const id of Object.values(VICES)) {
      if (!this.unlocked[id]) continue;
      // Permastoned lock — no weed pickups for the rest of the run.
      if (id === VICES.BURRITO && this._weedPermastonedLocked) continue;
      const count = this.pickupCounts[id] ?? 0;
      // Base weight 1 + addiction kicker.  Switched from linear (count×0.4)
      // to sqrt-scaled (sqrt(count)×1.6) so addiction still strongly biases
      // the pick after a few hits but a long lifetime history (30+ beers)
      // doesn't permanently lock other vices out at 13:1 odds.  Old: 30
      // beers → weight 13.  New: 30 beers → weight ~9.8, 100 beers →
      // ~17 (vs old 41).  Still meaningful, no longer pathological.
      let w = 1 + Math.sqrt(count) * 1.6;
      if (upDominant && DOWNERS.has(id)) w *= 0.45;
      if (dnDominant && UPPERS.has(id))  w *= 0.45;
      // Fentanyl is RARE — single hit = 50%, two = OD.  Knock its weight
      // way down so it shows up only occasionally even when the player
      // has piled up an opioid pickup history.
      if (id === VICES.COMA) w *= 0.08;
      // Shrooms population reduced 20% per player request — they were
      // showing up too often on the road.
      if (id === VICES.GUMMIES)  w *= 0.8;
      candidates.push({ id, w });
      totalW += w;
    }
    if (!candidates.length) return 'sushi';

    let r = Math.random() * totalW;
    for (const c of candidates) {
      if ((r -= c.w) <= 0) return ID_TO_PICKUP[c.id] ?? 'sushi';
    }
    return ID_TO_PICKUP[candidates[candidates.length - 1].id] ?? 'sushi';
  }

  _mapPickupType(type) {
    const map = {
      sushi:        VICES.SUSHI,
      burrito:        VICES.BURRITO,
      energy:     VICES.ENERGY,
      gummies:     VICES.GUMMIES,
      hotdog:         VICES.HOTDOG,
      combo:      VICES.COMBO,
      coldbrew:          VICES.COLDBREW,
      coma:    VICES.COMA,
      slushie:    VICES.SLUSHIE,
      caffeine:        VICES.CAFFEINE,
    };
    return map[type] ?? null;
  }

  checkOD() {
    // Per-frame safety net.  Under the 1.0001 scheme (2026-06-20) OD is
    // actually triggered at pickup time by the overfill check (prev+dose ≥
    // 1.0001), since stored bars cap at 1.0 and never reach 1.0001 here.  Kept
    // as a guard in case a bar is ever pushed past its threshold by other
    // means.  Alcohol/weed are canOD:false, so they fill safely.
    for (const id of Object.values(VICES)) {
      const cfg = VICE_CONFIG[id];
      const odThr = cfg.odThreshold ?? 1.0;
      if (cfg.canOD && this.levels[id] >= odThr) {
        return id;
      }
    }
    return null;
  }

  /** Total intoxication 0–1 (weighted sum, capped) */
  get totalIntox() {
    const weights = {
      sushi:  1.0,
      burrito:     0.5,
      energy:  0.8,
      gummies:  1.1,
      hotdog:      1.3,
      combo:   1.4,
      coldbrew:       0.6,
      coma: 2.0,
      slushie: 1.2,
    };
    let total = 0;
    for (const id of Object.values(VICES)) {
      total += (this.levels[id] ?? 0) * (weights[id] ?? 1);
    }
    return Math.min(1, total / 2.5);
  }

  get(id)    { return this.levels[id]   ?? 0; }
  isOn(id)   { return this.levels[id]   > 0.05; }
  isUnlocked(id) { return this.unlocked[id] ?? false; }

  /** Score multiplier — additive per vice, weighted by how lit you are.
   *  Each vice's contribution:
   *     bar  ≤ 50%  →  +0.5  (light buzz / mild high)
   *     bar  > 50%  →  +1.0  (deep, full effect)
   *     bar  < 5%   →   0    (trace residue, ignored)
   *  Examples (matching the user spec):
   *     beer 30% + weed 30%        →  1 + 0.5 + 0.5 = 2.0×
   *     beer full + weed full      →  1 + 1.0 + 1.0 = 3.0×
   *     beer 80% + weed 20%        →  1 + 1.0 + 0.5 = 2.5×
   *     one vice at 50%            →  1 + 0.5       = 1.5×
   */
  get scoreMultiplier() {
    let bonus = 0;
    for (const id of Object.values(VICES)) {
      const level = this.levels[id] ?? 0;
      if (level < 0.05)      continue;       // trace residue, no score boost
      else if (level <= 0.5) bonus += 0.5;   // first-half buzz
      else                   bonus += 1.0;   // second-half full effect
    }
    return 1 + bonus;
  }

  /** Recovery: hitchhiker gives a sobriety boost */
  applyRecovery(amount = 0.2) {
    for (const id of Object.values(VICES)) {
      if (this.levels[id] > 0) {
        this.levels[id] = Math.max(0, this.levels[id] - amount * 0.5);
      }
    }
  }
}
