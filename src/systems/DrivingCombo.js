/**
 * DrivingCombo — the skill-driving multiplier (CASH ECONOMY V1, owner
 * workshop 2026-09-05).  Distinct from ViceSystem's consumable "combos" and
 * the Combo Meal item — this is the ×1–×15 DISTANCE-INCOME multiplier built
 * by cleanly overtaking traffic.
 *
 * Pure logic, no Phaser — covered by tests/combo.test.mjs.  All tuning lives
 * in constants.COMBO so Brendan can retune without touching GameScene.
 *
 *   • A clean overtake grants 1 progress point; PASSES_PER_LEVEL points raise
 *     the level by exactly one (level 1 → CAP).
 *   • An overtake refreshes grace to GRACE_SEC (+ survival bonus, × genre
 *     grace mult), never past GRACE_MAX_SEC.
 *   • Collected roadside sprites extend an ACTIVE (level > 1 or in-progress)
 *     combo's remaining grace by PICKUP_EXT_SEC, capped at GRACE_MAX_SEC.
 *     They never add progress or levels.
 *   • Grace at 0 → partial progress clears once, then one level drops every
 *     DECAY_STEP_SEC until level 1.
 *   • Any ordinary vehicle collision (or a run-state reset) → 1×/0/0.
 */
export class DrivingCombo {
  constructor(tuning) {
    this.T = tuning;
    this.reset();
  }

  reset() {
    this.level    = 1;      // the multiplier: 1..CAP
    this.progress = 0;      // clean passes toward the next level
    this.grace    = 0;      // seconds of life left
    this._decayT  = 0;      // accumulator while decaying
    this._decayed = false;  // partial progress cleared for this decay episode
  }

  get mult() { return this.level; }
  /** "Active" = there is something to protect (a level or partial progress). */
  get active() { return this.level > 1 || this.progress > 0; }

  /** A qualifying clean overtake.  Returns { leveled } for HUD callouts. */
  overtake({ graceBonus = 0, buildMult = 1, graceMult = 1 } = {}) {
    const T = this.T;
    this.progress += Math.max(0.1, buildMult);
    let leveled = false;
    while (this.progress >= T.PASSES_PER_LEVEL && this.level < T.CAP) {
      this.progress -= T.PASSES_PER_LEVEL;
      this.level++;
      leveled = true;
    }
    if (this.level >= T.CAP) this.progress = Math.min(this.progress, T.PASSES_PER_LEVEL);
    const refresh = Math.min(T.GRACE_MAX_SEC, (T.GRACE_SEC + graceBonus) * Math.max(0.25, graceMult));
    this.grace   = Math.max(this.grace, refresh);
    this._decayT = 0; this._decayed = false;
    return { leveled };
  }

  /** Roadside collectible: +grace only, active combos only, hard cap. */
  pickupExtend() {
    if (!this.active || this.grace <= 0) return false;
    this.grace = Math.min(this.T.GRACE_MAX_SEC, this.grace + this.T.PICKUP_EXT_SEC);
    return true;
  }

  /** Ordinary vehicle collision (and every run-state reset). */
  collisionReset() {
    const lost = this.active;
    this.reset();
    return lost;
  }

  /**
   * Per-frame clock.  dt seconds (0 while paused — the caller gates).
   *   canBuild=false  → grace bleeds normally but nothing protects it
   *                     (slow driving / off-road can't build).
   *   decayMult       → decay speed scale (off-road OFFROAD_DECAY_MULT).
   *   freeze=true     → forced stops (police holds etc.): no decay, no build.
   * Returns { dropped, lost } for HUD callouts.
   */
  tick(dt, { decayMult = 1, freeze = false } = {}) {
    if (freeze || dt <= 0 || !this.active) return { dropped: false, lost: false };
    if (this.grace > 0) {
      this.grace = Math.max(0, this.grace - dt);
      if (this.grace > 0) return { dropped: false, lost: false };
    }
    // Grace exhausted — decay.
    if (!this._decayed) { this.progress = 0; this._decayed = true; this._decayT = 0; }
    this._decayT += dt * Math.max(1, decayMult);
    let dropped = false;
    while (this._decayT >= this.T.DECAY_STEP_SEC && this.level > 1) {
      this._decayT -= this.T.DECAY_STEP_SEC;
      this.level--;
      dropped = true;
    }
    const lost = dropped && this.level === 1;
    return { dropped, lost };
  }

  snapshot() { return { level: this.level, progress: this.progress, grace: this.grace }; }
  restore(s) {
    if (!s) return;
    this.level    = Math.max(1, Math.min(this.T.CAP, Math.round(s.level ?? 1)));
    this.progress = Math.max(0, Math.min(this.T.PASSES_PER_LEVEL, s.progress ?? 0));
    this.grace    = Math.max(0, Math.min(this.T.GRACE_MAX_SEC, s.grace ?? 0));
    this._decayT  = 0; this._decayed = false;
  }
}
