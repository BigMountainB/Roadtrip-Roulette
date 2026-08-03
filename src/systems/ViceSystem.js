/**
 * ViceSystem — tracks active vice levels and unlocks
 *
 * Each vice has a level 0–1.
 * Level fills on pickup, decays over time.
 * At threshold most vices end the run (you pass out).
 * Burrito is the exception — it just makes you very slow.
 *
 * Unlock tree (checked each update):
 *   energy   → sushi > 0.3 for > 30s total
 *   gummies  → sushi > 0.4 AND burrito > 0.4 simultaneously
 *   hotdog   → gummies bar ever reached >= 0.75
 *   combo    → distance > 50% of route
 *   coldbrew → energy > 0.5 (simulates "calming down")
 *   coma     → combo bar ever reached >= 0.6
 *   slushie  → hotdog bar ever reached >= 0.5
 */
import { VICES, VICE_CONFIG, VICE_COMBOS } from '../constants.js';

// Pickup amounts — per the owner's vice-design spec.  Hits-to-max varies
// wildly by vice: 14 sushi rolls vs 2 buffet-coma hits, etc.  Many vices
// also trigger cross-vice or per-pickup effects (see ViceSystem.pickup +
// GameScene).
const PICKUP_AMOUNTS = {
  sushi:  0.18,    // 18% — a bigger bite so one hit spikes a real effect that
                     // survives the realistic ~65s decay (raised from 7% 2026-06-22)
  burrito:     0.125,   // 12.5% base; tolerance kicks in past 60%
  energy:  0.10,    // 10% per shot → 10 shots fills the bar, the 11th tips you over (per
                     // user 2026-07-01: "10 hits to max, each hit is 10%")
  gummies:  0.20,    // 20% — fastest visual ramp
  hotdog:      0.25,    // 25% — fastest of all
  combo:   0.30,    // 30%
  coldbrew:       0.10,    // 10% — per-dose timer, see DOSE_SECONDS (was 0.18)
  coma: 0.55,    // 55% — 2 hits tips you over at ≥1.00
  slushie: 0.15,    // 15% — dissociative, scales with redosing (was 10%)
  caffeine:     0.10,    // 10% — per-dose timer, see DOSE_SECONDS (was 0.25)
};

// ── Per-dose stimulant decay (owner 2026-07-27) ──────────────────────────
// The default model is ONE shared bar draining at a flat `cfg.decayRate`, which
// means each extra pickup extends the whole bar's lifetime — 4 caffeine pills
// lasted 204 s TOGETHER instead of ~51 s each, so a stacked stimulant high never
// wore off (and pinned the speed multiplier at its ceiling for minutes).
//
// Vices listed here are DOSE-TRACKED instead: every pickup becomes its own
// {amt, t, dur} entry whose clock starts the instant it's collected, and the bar
// level is the SUM of the live doses' remaining fractions. Stacking now raises
// the bar HIGHER, never LONGER — dose #4 expires on its own schedule regardless
// of what doses #1-3 are doing. Anything not listed keeps the shared-drain model.
const DOSE_SECONDS = {
  caffeine: 60,   // one pill: 10% → 0 over 60 s
  coldbrew: 45,   // one pull: 10% → 0 over 45 s
  energy:   30,   // one shot: 10% → 0 over 30 s
};

export class ViceSystem {
  constructor() {
    this.levels    = {};
    this.unlocked  = {};
    this.maxReached = {}; // highest level each vice has ever reached

    // Unlock tracking
    this.totalSushiTime   = 0;
    this.routeProgress    = 0; // 0–1, updated by GameScene
    // Lifetime NPC-crash counter — feeds the Cold Brew unlock gate.
    this.npcCrashesTotal   = 0;
    this.pickupCounts       = {};
    // Energy speed-bonus dose (owner 2026-08-02): a SINGLE +4 mph window —
    // never stacks.  Picking up another shot RESTARTS this clock; it does
    // not add another 4.  (Replaced the old `energyPickupCount × 4 × bar`
    // formula, which grew without bound over a run and also double-counted
    // through EffectsSystem's ×1.55 speedMult term — both removed.)
    this._energySpeedDose   = null;   // { t, dur } | null
    // Vices that crossed their unlock gate THIS frame — GameScene drains this
    // to force a guaranteed first pickup of the new vice so the player can
    // actually try what they just earned (esp. on short runs).
    this._firstLineQueue    = [];
    // Active-combo timestamp tracker — initialised here so getActiveCombos
    // doesn't have to lazy-init on first call (audit caught this).
    this._comboActivatedAt  = {};
    // Coffee speed-bonus doses (owner 2026-07-31: "coffee adds 1mph, up to
    // 10mph"). Coffee isn't a VICES entry — it's a rest-stop purchase with
    // no bar/unlock semantics — so it gets its own tiny dose ledger
    // instead of living in the VICES/_doses machinery above. Same shape as
    // a real dose ({t, dur}) but no `amt`/fitting: every cup is worth a
    // flat 1 mph at full strength, decaying linearly over its own 30s.
    this._coffeeDoses = [];
    // Caffeine-pill speed doses — same dedicated-ledger pattern as coffee, and
    // for the same reason: the LIVE pickup path (GameScene._onCollect →
    // noteCaffeinePickup) must not depend on the retired vice-bar machinery.
    this._caffeineDoses = [];
    for (const id of Object.values(VICES)) this.pickupCounts[id] = 0;
    // Per-dose ledgers for the DOSE_SECONDS vices: `_doses[id]` is the list of
    // live doses, `_doseSum[id]` is the level this system last wrote.  The pair
    // lets `_updateDoses` tell its own output apart from an EXTERNAL write to
    // `levels[id]` (GameScene does that in ~13 places) and honour the latter.
    this._doses   = {};
    this._doseSum = {};

    for (const id of Object.values(VICES)) {
      this.levels[id]     = 0;
      this.unlocked[id]   = VICE_CONFIG[id].unlocked ?? false;
      this.maxReached[id] = 0;
      this._doses[id]     = [];
      this._doseSum[id]   = 0;
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
   *  restarts.  Right now this is just the caffeine Phase-1 flag (energy has
   *  ever peaked ≥0.40) — without this, taking a rest stop after a energy
   *  spike resets the gate and the player can never get to Phase 2's
   *  30-second clean window. */
  hydrateProgress(saved) {
    if (!saved || typeof saved !== 'object') return;
    // `?? old-key` = one-time migration from the save fields these two were
    // renamed from (pre-dating the vice rename to the current food/fatigue
    // set) so existing progress isn't lost. Old key names kept as-is here —
    // this is a save-compat shim, not a place to touch.
    if (saved.caffeinePhase1 ?? saved.methPhase1) this._caffeinePhase1 = true;
    const _peak = saved.energyPeak ?? saved.cocainePeak;
    if (typeof _peak === 'number') {
      this.maxReached[VICES.ENERGY] = Math.max(
        this.maxReached[VICES.ENERGY] ?? 0, _peak);
    }
  }

  /** Snapshot meta-progress for the registry. */
  snapshotProgress() {
    return {
      caffeinePhase1: !!this._caffeinePhase1,
      energyPeak:     this.maxReached[VICES.ENERGY] ?? 0,
    };
  }

  /** Top up every unlocked vice bar to a safe 60% — keeps the player from
   *  walking out of a rest stop into an instant Coma blackout.  Bars already
   *  above 60% are left alone.  IMPORTANT: do NOT bump `maxReached` —
   *  the Hot Dog / Coma unlock gates read maxReached for Gummies /
   *  Combo, so writing CAP there would chain-unlock the downstream
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
    const energyLevel = this.levels[VICES.ENERGY] ?? 0;
    // Custom mode used to FREEZE every bar here (levels were treated as fixed
    // user-set sandbox values).  Removed 2026-07-28 (owner): custom now restores
    // road pickups, and a frozen bar plus working pickups is a one-way ratchet —
    // levels could only climb, with no way to sober up.  The slider now sets the
    // STARTING levels and the run simulates normally from there, which is also
    // what makes mid-run slider edits work (they land as external writes that
    // `_updateDoses` reconciles).
    // Permastoned hold — once the Burrito bar hits 100% it should freeze
    // there until the 10-mile timer trips.  We can't gate on
    // `_burritoAt100StartPos` because that field is populated by
    // `notePermastonedTick`, which runs AFTER `update()` — so on the
    // first frame at 100% the decay would shave the bar back below 1.0
    // before the timer could even start.  Gate purely on the bar level.
    const burritoPermastonedActive = (this.levels[VICES.BURRITO] ?? 0) >= 1.0
      && !this._burritoPermastonedLocked;

    for (const id of Object.values(VICES)) {
      const cfg   = VICE_CONFIG[id];
      const level = this.levels[id];

      // Dose-tracked stimulants run their own per-pickup clocks and must tick
      // even at level 0 (a direct external write to `levels[id]` needs
      // reconciling into the ledger, and a level-0 vice may still have stale
      // doses to clear).
      if (DOSE_SECONDS[id] !== undefined) {
        const lvl = this._updateDoses(id, dt);
        if (lvl > 0) {
          anyActive = true;
          if (lvl > this.maxReached[id]) this.maxReached[id] = lvl;
        }
        continue;
      }

      if (level > 0) {
        anyActive = true;
        if (level > this.maxReached[id]) this.maxReached[id] = level;
        // Burrito bar holds at 100% during the Permastoned window — no decay
        // until the 10-mi mark trips and the bar is force-reset to 0.
        if (id === VICES.BURRITO && burritoPermastonedActive) continue;
        let decay = cfg.decayRate;
        // Sushi asymmetric decay — first 50 % of the bar sticks around
        // (decay ×0.6) so the queasiness is easy to maintain; above 50 %
        // it burns off faster (decay ramps up to ×2.5 at full bar) so an
        // extreme case wears off quickly.  Net: easier to reach and
        // maintain a mild effect, harder to stay maxed.
        if (id === VICES.SUSHI) {
          if (level <= 0.5) {
            decay *= 0.6;
          } else {
            const t = (level - 0.5) / 0.5;        // 0 at 50 %, 1 at 100 %
            decay *= 0.6 + (2.5 - 0.6) * t;       // 0.6 → 2.5
          }
        }
        // Energy speeds up Sushi's metabolism (~2× faster at full energy bar)
        if (id === VICES.SUSHI && energyLevel > 0.1) {
          decay *= 1 + energyLevel * 1.2;
        }
        this.levels[id] = Math.max(0, level - decay * dt);
      }
    }

    // Sushi-time tracking (for energy unlock)
    if (this.levels[VICES.SUSHI] > 0.3) {
      this.totalSushiTime += dt;
    }

    // Unlock checks
    this._checkUnlocks(dt);

    // Coffee doses age on their own clock, same as the DOSE_SECONDS vices,
    // and get pruned once spent — see noteCoffeePurchase / getCoffeeSpeedBonusMPH.
    for (let i = this._coffeeDoses.length - 1; i >= 0; i--) {
      const d = this._coffeeDoses[i];
      d.t += dt;
      if (d.t >= d.dur) this._coffeeDoses.splice(i, 1);
    }
    for (let i = this._caffeineDoses.length - 1; i >= 0; i--) {
      const d = this._caffeineDoses[i];
      d.t += dt;
      if (d.t >= d.dur) this._caffeineDoses.splice(i, 1);
    }

    // The single energy speed-bonus window ages the same way (see
    // getEnergySpeedBonusMPH) — nulled once spent.
    if (this._energySpeedDose) {
      this._energySpeedDose.t += dt;
      if (this._energySpeedDose.t >= this._energySpeedDose.dur) this._energySpeedDose = null;
    }

    return anyActive;
  }

  /** Advance ONE dose-tracked vice (see DOSE_SECONDS) and return its new level.
   *
   *  Each dose carries its own elapsed clock, so its contribution to the bar is
   *  `amt × (1 − t/dur)` and it expires `dur` seconds after IT was picked up —
   *  never waiting on an earlier dose to drain first.  The bar is the sum.
   *
   *  Reconciliation: GameScene writes `vices.levels[id]` directly in ~13 places
   *  (rest-stop "reduce vices" buys, the Espresso rescue flush, save restore,
   *  the dev slider, and the cross-vice drops inside `pickup`).  Those writes must win,
   *  so whenever the level no longer matches what this method last produced, the
   *  live doses are rescaled to the externally-set total — preserving their
   *  individual clocks — rather than being silently recomputed away. */
  _updateDoses(id, dt) {
    const dur   = DOSE_SECONDS[id];
    const doses = this._doses[id] ?? (this._doses[id] = []);
    const level = this.levels[id] ?? 0;

    // ── 1. Honour any external write since the last tick ──
    if (Math.abs(level - (this._doseSum[id] ?? 0)) > 1e-4) {
      if (level <= 1e-4) {
        doses.length = 0;
      } else {
        let live = 0;
        for (const d of doses) live += d.amt * (1 - d.t / d.dur);
        if (live > 1e-6) {
          const k = level / live;
          for (const d of doses) d.amt *= k;
        } else {
          // Level set from nothing (dev slider, save restore) — start it as a
          // single fresh dose so it decays on the normal schedule from here.
          doses.length = 0;
          doses.push({ amt: level, t: 0, dur });
        }
      }
    }

    // ── 2. Every dose ages on its own clock ──
    for (const d of doses) d.t += dt;

    // ── 3. Retire the expired, sum the rest ──
    let sum = 0;
    for (let i = doses.length - 1; i >= 0; i--) {
      const d = doses[i];
      if (d.t >= d.dur) { doses.splice(i, 1); continue; }
      sum += d.amt * (1 - d.t / d.dur);
    }
    sum = Math.max(0, Math.min(1, sum));

    this.levels[id]   = sum;
    this._doseSum[id] = sum;
    return sum;
  }

  /** Called by GameScene each frame with the player's current world-Z
   *  position.  Tracks the Permastoned window: Burrito bar at 100% for
   *  10 in-game miles → fire achievement, force-reset Burrito to 0,
   *  permanently lock Burrito pickups for the remainder of the run.
   *
   *  `posUnitsPerMile` lets the system convert relative position units
   *  to miles without importing constants. */
  notePermastonedTick(playerPos, posUnitsPerMile) {
    if (this._burritoPermastonedLocked) return null;
    const burrito = this.levels[VICES.BURRITO] ?? 0;
    if (burrito < 1.0) {
      this._burritoAt100StartPos = null;
      return null;
    }
    if (this._burritoAt100StartPos == null) {
      this._burritoAt100StartPos = playerPos;
      return null;
    }
    const milesAt100 = (playerPos - this._burritoAt100StartPos) / posUnitsPerMile;
    if (milesAt100 >= 10) {
      this._burritoPermastonedLocked = true;
      this.levels[VICES.BURRITO]     = 0;
      this._burritoAt100StartPos     = null;
      return { permastoned: true };
    }
    return null;
  }

  isPermastoned() { return !!this._burritoPermastonedLocked; }

  /** Per-frame unlock check.  Updated thresholds per owner spec:
   *    energy   → 30s of Sushi
   *    gummies  → both Sushi AND Burrito have ever been ingested (any pickup)
   *    hotdog   → gummies bar ever hit 0.30
   *    combo    → 20% route progress
   *    coldbrew → energy bar ever hit 0.30
   *    coma     → combo bar ever hit 0.50
   *    slushie  → hotdog bar ever hit 0.40
   *    caffeine      → energy bar hit 0.40 then dropped back to 0 for 30s
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

    if (!u[VICES.ENERGY] && this.totalSushiTime > 30) {
      this._unlock(VICES.ENERGY);
    }

    // Gummies unlock once both Sushi AND Burrito bars are ≥ 30% AT THE SAME
    // TIME (not just historically ingested) — the player has to be riding
    // both at once, not stage them separately.
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

    // Cold Brew unlocks once the player has bumped 50+ NPC cars (the player
    // is generating their own legal mess and needs the caffeine to cope).
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

    // Caffeine — special two-phase gate.  Phase 1 fires once energy bar
    // peaks ≥ 0.40.  Phase 2 then waits for the player to clean out
    // (energy = 0) and stay clean for 30 sustained seconds.
    if (!u[VICES.CAFFEINE]) {
      if (this.maxReached[VICES.ENERGY] >= 0.40) {
        this._caffeinePhase1 = true;
      }
      if (this._caffeinePhase1) {
        if ((this.levels[VICES.ENERGY] ?? 0) <= 0.0001) {
          this._caffeineCleanTime = (this._caffeineCleanTime ?? 0) + dt;
          if (this._caffeineCleanTime >= 30) this._unlock(VICES.CAFFEINE);
        } else {
          this._caffeineCleanTime = 0;       // reset if any energy shows up again
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

    // Permastoned lockout — once Burrito has been Permastoned-locked, the
    // road suppresses Burrito pickups so this should rarely fire, but the
    // double-check keeps any stray pickup honest.
    if (id === VICES.BURRITO && this._burritoPermastonedLocked) return false;

    const cfg    = VICE_CONFIG[id];
    let amount   = PICKUP_AMOUNTS[id] ?? 0.12;

    // Burrito tolerance — 12.5% per hit until the bar hits 60%, then a flat
    // 5% per hit (per owner spec).  Below 60% lets the player ramp up
    // quickly; above 60% it takes ~8 more hits to reach the Permastoned
    // 100% lock-in point.
    if (id === VICES.BURRITO) {
      amount = this.levels[id] < 0.60 ? 0.125 : 0.05;
    }

    const prevLevel = this.levels[id];
    const newLevel  = Math.min(1, prevLevel + amount);
    this.levels[id] = newLevel;

    // Dose-tracked stimulants: log THIS pickup as its own dose, clock starting
    // now.  Bank only the portion that actually fit under the 1.0 cap so the
    // ledger can't drift above the bar, and sync `_doseSum` so the reconcile in
    // `_updateDoses` doesn't mistake our own write for an external one.
    if (DOSE_SECONDS[id] !== undefined) {
      const fitted = newLevel - prevLevel;
      if (fitted > 1e-6) {
        this._doses[id] ??= [];
        this._doses[id].push({ amt: fitted, t: 0, dur: DOSE_SECONDS[id] });
      }
      this._doseSum[id] = newLevel;
    }

    // ── Cross-vice pickup effects ─────────────────────────────────────
    // Sushi lowers each OTHER vice by 5 percentage points only while that
    // bar is above 45%, so it can curb dangerous highs without wiping
    // early-stage effects. Energy burns 7 points off Sushi. Cold Brew
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

    // Speed-bonus windows — routed through the same note* methods the LIVE
    // road-pickup path uses, so both paths can never disagree.  Deliberately
    // not gated on whether the bar had room: you consumed it either way.
    if (id === VICES.ENERGY)   this.noteEnergyPickup();
    if (id === VICES.CAFFEINE) this.noteCaffeinePickup();
    // Per-pickup counters — addiction bias (chooseAddictedVice) and the
    // Cold-Brew-driven NPC traffic-speed shift (+/-7 mph / pickup).
    this.pickupCounts[id] = (this.pickupCounts[id] ?? 0) + 1;

    return { vice: id };
  }

  /** Log an energy-shot pickup — called from GameScene._onCollect on the LIVE
   *  road-pickup path (see noteCaffeinePickup for why the old `pickup()`-only
   *  wiring never fired in a real run).  Restarts the single window; never
   *  stacks a second +4. */
  noteEnergyPickup() {
    this._energySpeedDose = { t: 0, dur: DOSE_SECONDS[VICES.ENERGY] ?? 30 };
  }

  /** Energy speed boost in MPH — owner rule (2026-08-03): ON or OFF, never
   *  fading.  A flat +4 mph for the shot's whole clock (DOSE_SECONDS.energy),
   *  then nothing.  Only ONE is ever active: a new pickup restarts the clock
   *  at full strength, it never adds another +4 on top. */
  getEnergySpeedBonusMPH() {
    return this._energySpeedDose ? 4 : 0;
  }

  /** Log a caffeine-pill pickup — called from GameScene._onCollect on the
   *  LIVE road-pickup path. Own ledger, exactly like coffee: the old version
   *  read `_doses[CAFFEINE]`, which only `pickup()` ever filled, and `pickup()`
   *  has no production caller since vices moved to the survival model — so the
   *  speed bonus never fired in a real run ("I've been consuming caffeine and
   *  not noticing increase in speed"). */
  noteCaffeinePickup() {
    this._caffeineDoses.push({ t: 0, dur: DOSE_SECONDS[VICES.CAFFEINE] ?? 60 });
  }

  /** Caffeine Pill speed boost in MPH — owner rule (2026-08-03): ON or OFF,
   *  never fading. Each live pill is a flat +2 mph for its whole 60 s clock,
   *  then drops off. Capped at a combined +20 mph however many are stacked. */
  getCaffeineSpeedBonusMPH() {
    return Math.min(20, 2 * this._caffeineDoses.length);
  }

  /** Log a rest-stop Coffee purchase — called once per cup on GameScene
   *  resume (see the `coffeeCount` purchase field). Each cup gets its own
   *  fresh 30s clock, independent of any others still running. */
  noteCoffeePurchase() {
    this._coffeeDoses.push({ t: 0, dur: 30 });
  }

  /** Coffee speed boost in MPH — owner rule (2026-08-03): ON or OFF, never
   *  fading.  Each live cup is a flat +1 mph for its whole 30s clock, then
   *  drops off, capped at a combined +10 mph no matter how many are stacked.
   *  Coffee has no bar/fitting to scale by — every cup is full-strength. */
  getCoffeeSpeedBonusMPH() {
    return Math.min(10, this._coffeeDoses.length);
  }

  /** Cold-Brew-driven NPC traffic-speed offset in MPH (±7 mph per pickup),
   *  scaled by the current Cold Brew bar so traffic returns to normal as it
   *  wears off.  Read by GameScene._updateTraffic. */
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
      // Permastoned lock — no Burrito pickups for the rest of the run.
      if (id === VICES.BURRITO && this._burritoPermastonedLocked) continue;
      const count = this.pickupCounts[id] ?? 0;
      // Base weight 1 + addiction kicker.  Switched from linear (count×0.4)
      // to sqrt-scaled (sqrt(count)×1.6) so addiction still strongly biases
      // the pick after a few hits but a long lifetime history (30+ Sushi
      // rolls) doesn't permanently lock other vices out at 13:1 odds.
      // Old: 30 rolls → weight 13.  New: 30 rolls → weight ~9.8, 100 rolls
      // → ~17 (vs old 41).  Still meaningful, no longer pathological.
      let w = 1 + Math.sqrt(count) * 1.6;
      if (upDominant && DOWNERS.has(id)) w *= 0.45;
      if (dnDominant && UPPERS.has(id))  w *= 0.45;
      // Coma is RARE — single hit = 50%, two tips you over.  Knock its weight
      // way down so it shows up only occasionally even when the player
      // has piled up a heavy-vice pickup history.
      if (id === VICES.COMA) w *= 0.08;
      // Gummies population reduced 20% per owner request — they were
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

  checkPassOut() {
    // Per-frame safety net.  Under the 1.0001 scheme (2026-06-20) it is
    // actually triggered at pickup time by the overfill check (prev+dose ≥
    // 1.0001), since stored bars cap at 1.0 and never reach 1.0001 here.  Kept
    // as a guard in case a bar is ever pushed past its threshold by other
    // means.  Sushi/Burrito are canPassOut:false, so they fill safely.
    for (const id of Object.values(VICES)) {
      const cfg = VICE_CONFIG[id];
      const odThr = cfg.passOutThreshold ?? 1.0;
      if (cfg.canPassOut && this.levels[id] >= odThr) {
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

  /** Score multiplier — additive per vice, weighted by how deep in you are.
   *  Each vice's contribution:
   *     bar  ≤ 50%  →  +0.5  (light effect)
   *     bar  > 50%  →  +1.0  (deep, full effect)
   *     bar  < 5%   →   0    (trace residue, ignored)
   *  Examples (matching the owner spec):
   *     sushi 30% + burrito 30%     →  1 + 0.5 + 0.5 = 2.0×
   *     sushi full + burrito full   →  1 + 1.0 + 1.0 = 3.0×
   *     sushi 80% + burrito 20%     →  1 + 1.0 + 0.5 = 2.5×
   *     one vice at 50%             →  1 + 0.5       = 1.5×
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
