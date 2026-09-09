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
 *   • Collected roadside sprites are worth 1 pass credit each while the combo
 *     can build (owner 2026-09-05: "3 sprites — or any mix of sprites and
 *     overtakes — = +1 level"; a sprite can also START a combo).  When the
 *     combo CAN'T build (slow / off-road / forced stop) a sprite falls back
 *     to extending an ACTIVE combo's grace by PICKUP_EXT_SEC, capped at
 *     GRACE_MAX_SEC, never leveling.
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
    // CAP PHASE (owner 2026-09-07): true once ×15 has been reached, and it
    // stays true through the whole descent — reaching the cap is hard, so
    // losing it is slow.  While set, grace and decay use the CAP_* tuning.
    // Cleared only by a reset or by sliding all the way back to 1×.
    this._capReached = false;
  }

  /** Grace to refresh to, in seconds — longer once the cap has been reached.
   *  Clamped to at least GRACE_MAX_SEC so a CAP_GRACE_SEC raised above the
   *  ordinary ceiling isn't silently swallowed by it. */
  _graceRefresh(graceBonus = 0, graceMult = 1) {
    const T = this.T;
    const base = this._capReached ? (T.CAP_GRACE_SEC ?? T.GRACE_SEC) : T.GRACE_SEC;
    const ceil = this._capReached
      ? Math.max(T.GRACE_MAX_SEC, T.CAP_GRACE_SEC ?? 0)
      : T.GRACE_MAX_SEC;
    return Math.min(ceil, (base + graceBonus) * Math.max(0.25, graceMult));
  }

  get mult() { return this.level; }
  /** "Active" = there is something to protect (a level or partial progress). */
  get active() { return this.level > 1 || this.progress > 0; }

  /** A qualifying clean overtake.  Returns { leveled, hitCap } for HUD
   *  callouts — `hitCap` banks a rewind charge, because the charge is earned by
   *  REACHING the cap, however the player got there (owner 2026-09-07). */
  overtake({ graceBonus = 0, buildMult = 1, graceMult = 1 } = {}) {
    const T = this.T;
    const wasAtCap = this.level >= T.CAP;
    this.progress += Math.max(0.1, buildMult);
    let leveled = false;
    while (this.progress >= T.PASSES_PER_LEVEL && this.level < T.CAP) {
      this.progress -= T.PASSES_PER_LEVEL;
      this.level++;
      leveled = true;
    }
    if (this.level >= T.CAP) this.progress = Math.min(this.progress, T.PASSES_PER_LEVEL);
    if (this.level >= T.CAP) this._capReached = true;
    this.grace   = Math.max(this.grace, this._graceRefresh(graceBonus, graceMult));
    this._decayT = 0; this._decayed = false;
    return { leveled, hitCap: !wasAtCap && this.level >= T.CAP };
  }

  /** Roadside collectible: +grace only, active combos only, hard cap.
   *  Still used in can't-build states (slow / off-road), where a sprite may
   *  protect a combo but must not build one. */
  pickupExtend() {
    if (!this.active || this.grace <= 0) return false;
    this.grace = Math.min(this.T.GRACE_MAX_SEC, this.grace + this.T.PICKUP_EXT_SEC);
    return true;
  }

  /**
   * Collected sprite — weapon, food or drink (owner 2026-09-07).
   *
   * A sprite used to be worth ONE PASS CREDIT, so three of them made a level.
   * It is now worth SPRITE_LEVELS whole levels, which is also what charges
   * REWIND.  Overtakes are untouched and still build through `progress`.
   *
   * Grace is refreshed exactly as an overtake does: a pickup that raised the
   * multiplier and then let it decay a second later would be strictly worse
   * than the grace-only behaviour it replaced.
   *
   * Returns { leveled, hitCap }.  `hitCap` is the RISING EDGE into CAP and is
   * the only thing that banks a rewind charge — sitting at CAP must never mint
   * more, or every subsequent sprite would print one.
   */
  pickup({ graceBonus = 0, graceMult = 1 } = {}) {
    const T = this.T;
    const wasAtCap = this.level >= T.CAP;
    const step = Math.max(0, Math.round(T.SPRITE_LEVELS ?? 1));
    const before = this.level;
    this.level = Math.min(T.CAP, this.level + step);
    if (this.level >= T.CAP) this.progress = Math.min(this.progress, T.PASSES_PER_LEVEL);
    if (this.level >= T.CAP) this._capReached = true;
    this.grace   = Math.max(this.grace, this._graceRefresh(graceBonus, graceMult));
    this._decayT = 0; this._decayed = false;
    return { leveled: this.level > before, hitCap: !wasAtCap && this.level >= T.CAP };
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
    // A meter that has BEEN at the cap sheds levels on the slower CAP step for
    // the whole way down (owner 2026-09-07).
    const step = this._capReached
      ? (this.T.CAP_DECAY_STEP_SEC ?? this.T.DECAY_STEP_SEC)
      : this.T.DECAY_STEP_SEC;
    let dropped = false;
    while (this._decayT >= step && this.level > 1) {
      this._decayT -= step;
      this.level--;
      dropped = true;
    }
    const lost = dropped && this.level === 1;
    // Back to 1× — the cap episode is over; a fresh climb uses normal tuning.
    if (this.level <= 1) this._capReached = false;
    return { dropped, lost };
  }

  snapshot() { return { level: this.level, progress: this.progress, grace: this.grace }; }
  restore(s) {
    if (!s) return;
    this.level    = Math.max(1, Math.min(this.T.CAP, Math.round(s.level ?? 1)));
    this.progress = Math.max(0, Math.min(this.T.PASSES_PER_LEVEL, s.progress ?? 0));
    this.grace    = Math.max(0, Math.min(this.T.GRACE_MAX_SEC, s.grace ?? 0));
    this._decayT  = 0; this._decayed = false;
    // A run resumed AT the cap is still in the cap phase, so it decays on the
    // slow step rather than snapping back to the harsh climb tuning.  Derived
    // from the restored level, so old snapshots (which predate the flag) do the
    // right thing without a save migration.
    this._capReached = this.level >= this.T.CAP;
  }
}
