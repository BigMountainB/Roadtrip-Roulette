// ── Pursuit coordination ───────────────────────────────────────────────────
//
// Decides WHAT each unit is allowed to do; never where it must be or how fast
// it must go. That distinction is the whole reason the old FORM array
// (`[0, -0.42, 0.42, -0.8, 0.8]`) is gone: it pinned every cop to a permanent
// slot around the player, so five cars moved as one shape. Roles here are
// temporary and only gate behaviour — each cop still drives itself.
//
// ONE MAJOR ATTACK AT A TIME
// Exactly one striker token exists. A cop holding it may run a ram or PIT; no
// other unit may commit while it is held. That is what keeps attacks readable
// instead of a simultaneous pile-on.
//
// NO PHASER — plain arrays and plain state, so this is testable headlessly.

/** Roles handed out per tick. `follower` is the default and implies nothing
 *  beyond "pursue independently". */
export const ROLE = {
  FOLLOWER: 'follower',
  PRIMARY:  'primary',
  STRIKER:  'striker',
  WING:     'wing',
  PASSER:   'passer',
  BLOCKER:  'blocker',
  RECOVER:  'recover',
};

/** Star → how much simultaneous pressure is permitted. Escalation is expressed
 *  as PERMISSION, not as speed matching. */
const POLICY = [
  { wings: 0, strikers: 0, passers: 0 },   // 0
  { wings: 0, strikers: 0, passers: 0 },   // 1★ tail and observe only
  { wings: 1, strikers: 1, passers: 0 },   // 2★ first striker
  { wings: 2, strikers: 1, passers: 0 },   // 3★ left/right pressure
  { wings: 2, strikers: 1, passers: 1 },   // 4★ interceptor allowed ahead
  { wings: 3, strikers: 1, passers: 2 },   // 5★ blocker + striker + wings
];

export class PursuitDirector {
  constructor() {
    this._strikerId = null;    // holder of the single attack token
    this._strikerT  = 0;       // how long it has held it
  }

  /**
   * Assign roles for this frame.
   *
   * @param {Array}  cops  rear pursuers only — plain objects with
   *                       { id, position, laneOffset, profile, _recoverT, _attackCd }
   * @param {object} world { pursuitZ, playerX, star }
   * @param {number} dt
   * @returns {Map<any,string>} cop id → role
   */
  assign(cops, world, dt) {
    const out = new Map();
    const pol = POLICY[Math.max(0, Math.min(5, world.star | 0))];
    if (!cops.length) { this._strikerId = null; return out; }

    // Nearest-first: distance decides who is primary, not spawn order.
    const byGap = cops
      .map(c => ({ c, gap: world.pursuitZ - c.position }))
      .sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap));

    // ── Striker token ──────────────────────────────────────────────────
    // Released when its holder is recovering, cooling down, gone, or has held
    // it too long — so the role rotates instead of one car owning the chase.
    this._strikerT += dt;
    const holder = cops.find(c => c.id === this._strikerId);
    if (!holder || holder._recoverT > 0 || holder._attackCd > 0 || this._strikerT > 9) {
      this._strikerId = null;
    }
    if (this._strikerId == null && pol.strikers > 0) {
      // Eligible: close enough to be readable, not recovering, off cooldown.
      // Most aggressive eligible unit takes it.
      const cand = byGap
        .filter(({ c, gap }) => gap > 0 && gap < c.profile.preferredGap * 2.5
                             && !(c._recoverT > 0) && !(c._attackCd > 0))
        .sort((a, b) => b.c.profile.aggression - a.c.profile.aggression)[0];
      if (cand) { this._strikerId = cand.c.id; this._strikerT = 0; }
    }

    let wings = 0, passers = 0;
    for (let i = 0; i < byGap.length; i++) {
      const { c, gap } = byGap[i];
      if (c.id === this._strikerId)        { out.set(c.id, ROLE.STRIKER);  continue; }
      if (c._recoverT > 0)                 { out.set(c.id, ROLE.RECOVER);  continue; }

      // Already ahead of the player: a blocker if it earned that, otherwise it
      // is overshooting and CopDriver will recover it. Never snapped back.
      if (gap < 0) {
        out.set(c.id, c._passGranted && pol.passers > 0 ? ROLE.BLOCKER : ROLE.FOLLOWER);
        continue;
      }

      // Passing is a granted permission, not an accident. Below 4★ pol.passers
      // is 0, so no cop is ever ASSIGNED a deliberate pass.
      if (passers < pol.passers && c.profile.passTendency > 0.5
          && gap < c.profile.preferredGap * 1.5 && !c._passGranted) {
        c._passGranted = true;
        passers++;
        out.set(c.id, ROLE.PASSER);
        continue;
      }
      if (c._passGranted && passers < pol.passers) { passers++; out.set(c.id, ROLE.PASSER); continue; }

      if (i === 0) { out.set(c.id, ROLE.PRIMARY); continue; }

      if (wings < pol.wings) {
        wings++;
        // Alternate sides so wings do not stack on one flank. Persistent per
        // cop, not re-rolled: the side is decided once and kept.
        c._side ??= (wings % 2 === 1 ? -1 : 1);
        out.set(c.id, ROLE.WING);
        continue;
      }
      out.set(c.id, ROLE.FOLLOWER);
    }
    return out;
  }

  /** True when the given cop holds the single attack token. */
  isStriker(id) { return this._strikerId === id; }

  /** Force-release the token — used when a striker dies, flees or is smoked. */
  release(id) { if (this._strikerId === id) { this._strikerId = null; this._strikerT = 0; } }
}

/**
 * Longitudinal spacing between police, so they do not stack on one point.
 * A gentle push only — enough to break synchrony, not enough to build a
 * formation. Returns a speed bias in units/sec to add to a cop's target.
 */
export function spacingBias(cop, others, minGap = 700) {
  let bias = 0;
  for (const o of others) {
    if (o === cop) continue;
    const d = cop.position - o.position;
    if (Math.abs(d) < minGap && Math.abs(cop.laneOffset - o.laneOffset) < 0.30) {
      // Behind the other car → ease off; ahead → press on. Scaled by how much
      // of the minimum gap is missing.
      bias += (d < 0 ? -1 : 1) * (1 - Math.abs(d) / minGap) * 260;
    }
  }
  return Math.max(-400, Math.min(400, bias));
}
