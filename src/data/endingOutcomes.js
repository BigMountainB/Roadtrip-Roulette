/**
 * Ending-screen outcome calculators (owner 2026-08-27).
 *
 * ONE source of truth for what RESTART DRIVE and CONTINUE will actually do:
 * GameScene._endGame computes these objects once, the ending screen renders
 * its buttons FROM them, and the button handlers apply THE SAME objects —
 * so the previewed cash/mileage/HP can never disagree with the state the
 * player lands in.
 *
 * Pure functions, no Phaser — covered by tests/outcomes.test.mjs.
 *
 * Rules encoded here mirror the EXISTING engine behavior (GameScene create's
 * resumeFromPosition branch), not new design:
 *   RESTART DRIVE — restore the drive-start snapshot (position, HP, fuel,
 *     wanted level, vice levels, weapon stash) but NEVER at a cash loss
 *     (owner 2026-08-29: "restart should not receive a cash loss penalty —
 *     the penalty is starting the game over").  Cash is the BETTER of the
 *     snapshot wallet and the wallet at the moment of the ending BEFORE the
 *     ending's own penalty (pre-bail for a bust): a drive that earned money
 *     keeps the earnings, a drive that spent it still gets the snapshot's
 *     refund along with the rolled-back purchases.
 *   CONTINUE — resume at the most recent checkpoint with current
 *     consequences kept: busted keeps the post-bail wallet as-is; wreck /
 *     pass-out checkpoint retries cost HALF the remaining cash (the shipped
 *     "crash recovery" rule — surfaced on the button as an explicit fee
 *     line, never hidden).  The car comes back at the engine's 50%-of-base-
 *     HP recovery so the player is never resumed dead.
 */

/** $1,234 / -$56 / $0 — commas, sign preserved, never "-$0". */
export function fmtMoney(n) {
  const v = Math.round(n ?? 0);
  const sign = v < 0 ? '-' : '';
  return `${sign}$${Math.abs(v).toLocaleString('en-US')}`;
}

/** Signed variant for deltas: +$1,250 / -$6,121 / +$0. */
export function fmtMoneyDelta(n) {
  const v = Math.round(n ?? 0);
  return `${v < 0 ? '-' : '+'}$${Math.abs(v).toLocaleString('en-US')}`;
}

/**
 * Compute both choice outcomes.
 *
 * @param cause            _endGame cause ('busted' | 'crash' | 'passed_out' | …)
 * @param finalCash        wallet after the ending's own penalties (bail etc.)
 * @param prePenaltyCash   wallet at the moment of the ending BEFORE its own
 *                         penalty (pre-bail).  Optional — defaults to
 *                         finalCash for endings with no pre-screen charge.
 * @param snap             drive-start snapshot (GameScene._driveStartSnap) or null
 * @param checkpoint       { name, position } — most recent checkpoint, or null
 * @param baseVehicleHp    the vehicle's BASE hp (engine's checkpoint respawn
 *                         restores 50% of this — see GameScene resume branch)
 * @param routeUnits       total route length in world units
 * @param totalRouteMiles  total route length in miles
 */
export function computeEndingOutcomes({
  cause, finalCash, prePenaltyCash, snap, checkpoint, baseVehicleHp, routeUnits, totalRouteMiles,
}) {
  const toMi = (pos) => Math.max(0, (pos ?? 0) / (routeUnits || 1)) * (totalRouteMiles || 0);
  const cashNow = Math.max(0, Math.round(finalCash ?? 0));
  const preCash = Math.max(0, Math.round(prePenaltyCash ?? finalCash ?? 0));

  // ── RESTART DRIVE — the snapshot, but never at a cash loss ────────────
  const restart = snap ? {
    cash:   Math.max(0, Math.round(snap.cash ?? 0), preCash),
    mi:     toMi(snap.position),
    loc:    snap.locName ?? null,
    hp:     snap.hp != null ? Math.round(snap.hp) : null,
    fuelMi: snap.fuelMi ?? null,
    snap,                       // carried through so apply == preview
  } : null;

  // ── CONTINUE — existing checkpoint rules ──────────────────────────────
  let cont;
  if (checkpoint && checkpoint.position != null) {
    // Busted already charged bail before this screen; wreck/pass-out
    // checkpoint retries use the shipped half-cash crash-recovery rule.
    const cash = cause === 'busted' ? cashNow : Math.floor(cashNow / 2);
    const fee  = cashNow - cash;
    const hp   = Math.round((baseVehicleHp ?? 100) * 0.5);
    cont = {
      valid: true,
      cash,
      mi:  toMi(checkpoint.position),
      loc: checkpoint.name ?? null,
      hp,
      fee,
      note: fee > 0 ? `Includes ${fmtMoney(fee)} recovery · HP ${hp}` : `HP ${hp}`,
    };
  } else {
    cont = { valid: false };
  }

  return { restart, cont };
}

/** The ending screen's explicit accounting block. */
export function summarizeDrive({ startCash, finalCash }) {
  const start = Math.round(startCash ?? 0);
  const end   = Math.max(0, Math.round(finalCash ?? 0));
  return { startCash: start, finalCash: end, delta: end - start };
}
