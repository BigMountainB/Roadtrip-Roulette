// ── Deployable field — world-space entities for donuts and rolling coal ───
//
// WHY THIS EXISTS.  Both deployables used to resolve as a one-shot loop over
// `cops` filtered to a longitudinal band around the player: donuts tested
// `rel < 3000 && rel > -15000`, coal tested a fixed backZ..frontZ band.  Any
// unit outside that window was untouchable — which is why neither did anything
// against a cop that had got in front of the player (owner 2026-07-28).
//
// Now both are WORLD-ANCHORED entities with their own position and lifetime,
// and every unit is radius-checked against them regardless of where it sits
// relative to the player.  A donut can therefore pull a blocking cop off the
// road, which is the whole point of carrying them at 4-5 stars.
//
// This module owns geometry and lifetime ONLY.  What contact does to a cop is
// CopSystem's business — that keeps the pursuit rules in one place.

/** Car length in world units.  Derived: LANE_DASH_LEN (3) x SEG_LENGTH (200)
 *  = 600 units per 10 ft dash => ~60.8 units/ft, so a 5 m car ~= 1000. */
export const CL = 1000;

// ── Donuts: a lure ───────────────────────────────────────────────────────
export const DONUT_RADIUS = 16 * CL;
export const DONUT_LIFE   = 8;      // seconds the box is worth diverting for
/** Per-unit immunity after a divert, so a stack of boxes can't chain-disable
 *  one car — it gets pulled once, then ignores donuts for this long. */
export const DONUT_IMMUNE_SEC = 20;
/** Divert chance by star tier (index 1-5).  Higher wanted = more discipline. */
export const DONUT_DIVERT_BY_STAR = [0.9, 0.9, 0.85, 0.7, 0.5, 0.3];

// ── Rolling coal: a trail of puffs ───────────────────────────────────────
export const PUFF_INTERVAL = 0.10;  // emit cadence while the belch is running
export const PUFF_LIFE     = 3.5;
export const PUFF_RADIUS   = 6 * CL;

export class DeployableField {
  constructor() {
    /** @type {{z:number, lane:number, life:number}[]} */
    this.donuts = [];
    /** @type {{z:number, life:number}[]} */
    this.puffs  = [];
    this._emitLeft = 0;    // seconds of coal still being emitted
    this._emitAcc  = 0;    // accumulator for the 100 ms cadence
  }

  clear() {
    this.donuts.length = 0;
    this.puffs.length  = 0;
    this._emitLeft = 0;
    this._emitAcc  = 0;
  }

  /** Drop a box of donuts at a world position. */
  dropDonuts(z, lane = 0, lifeMult = 1) {
    this.donuts.push({ z, lane, life: DONUT_LIFE * lifeMult });
  }

  /** Start belching coal.  Puffs are laid at the player's position as they
   *  drive, so the trail follows the road rather than a rigid box. */
  startCoal(durationSec) {
    this._emitLeft = Math.max(this._emitLeft, durationSec);
    this._emitAcc  = PUFF_INTERVAL;   // lay one immediately
  }

  get coalActive() { return this._emitLeft > 0; }

  /** Age everything and lay new puffs behind the player. */
  update(dt, emitZ) {
    for (let i = this.donuts.length - 1; i >= 0; i--) {
      if ((this.donuts[i].life -= dt) <= 0) this.donuts.splice(i, 1);
    }
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      if ((this.puffs[i].life -= dt) <= 0) this.puffs.splice(i, 1);
    }
    if (this._emitLeft > 0) {
      this._emitLeft -= dt;
      this._emitAcc  += dt;
      while (this._emitAcc >= PUFF_INTERVAL) {
        this._emitAcc -= PUFF_INTERVAL;
        this.puffs.push({ z: emitZ, life: PUFF_LIFE });
      }
    }
  }

  /** Nearest live donut within DONUT_RADIUS of `z`, or null.  Radius test in
   *  BOTH directions — a donut behind a blocking cop still pulls it. */
  donutNear(z) {
    let best = null, bestD = DONUT_RADIUS;
    for (const d of this.donuts) {
      const dist = Math.abs(d.z - z);
      if (dist <= bestD) { best = d; bestD = dist; }
    }
    return best;
  }

  /** True if `z` intersects any live coal puff. */
  inPuff(z) {
    for (const p of this.puffs) {
      if (Math.abs(p.z - z) <= PUFF_RADIUS) return true;
    }
    return false;
  }
}
