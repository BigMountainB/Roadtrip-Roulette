// ── ViewportSettle — ONE settle sequence per burst of viewport events ──────
// iPhone stability pass (2026-09-15), item 2.
//
// iOS fires several `resize` / `orientationchange` / `visualViewport.resize`
// events per physical rotation, plus a ResizeObserver tick on #game-root, and
// the rotation animation often ends with NO final resize once it settles.  So
// a fit has to be re-applied along a short ladder of timers — but every
// trigger must REPLACE the pending ladder, never stack another (that was
// dozens of scale passes per turn while the process sat at the iOS ceiling).
//
// This factory was extracted from main.js so the "N events → exactly one
// ladder" contract is testable with fake timers.  Timers are injected.

export const SETTLE_STEPS_ROTATION = Object.freeze([120, 300, 550, 900]);
export const SETTLE_STEPS_COLD     = Object.freeze([120, 300, 550, 900, 1600]);

/**
 * @param {object} deps
 * @param {() => void} deps.apply      the fit to run at each step
 * @param {boolean}    [deps.useRaf]   run an immediate rAF step too (default true)
 * @param {number[]}   [deps.steps]    default ladder
 * @param {Function}   [deps.setTimeout] / clearTimeout / requestAnimationFrame / cancelAnimationFrame
 */
export function createSettleScheduler({
  apply,
  useRaf = true,
  steps = SETTLE_STEPS_ROTATION,
  setTimeout: st = (fn, ms) => setTimeout(fn, ms),
  clearTimeout: ct = (id) => clearTimeout(id),
  requestAnimationFrame: raf = (fn) => requestAnimationFrame(fn),
  cancelAnimationFrame: caf = (id) => cancelAnimationFrame(id),
} = {}) {
  let timers = [];
  let rafId = 0;
  let sequences = 0;   // diagnostics: how many ladders were started
  let applies = 0;     // diagnostics: how many apply() calls actually ran

  const cancel = () => {
    for (const t of timers) ct(t);
    timers = [];
    if (rafId) { caf(rafId); rafId = 0; }
  };

  const run = () => { applies++; try { apply(); } catch (_) {} };

  const schedule = (ladder = steps) => {
    cancel();
    sequences++;
    if (useRaf) rafId = raf(() => { rafId = 0; run(); });
    for (const ms of ladder) {
      const id = st(() => { timers = timers.filter(t => t !== id); run(); }, ms);
      timers.push(id);
    }
  };

  return {
    schedule,
    cancel,
    /** True while a ladder still has steps to run — "rotation in flight". */
    pending: () => timers.length > 0 || rafId !== 0,
    stats: () => ({ sequences, applies, pending: timers.length + (rafId ? 1 : 0) }),
  };
}
