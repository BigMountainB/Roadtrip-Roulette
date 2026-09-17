// ── GpuRecovery — bounded, fail-closed background-return recovery ──────────
// iPhone stability pass (2026-09-15), item 3.
//
// Safari can evict a backgrounded tab's GPU textures WITHOUT firing
// webglcontextlost: the context stays "valid" but every texture handle is
// dead, so on return each sprite samples whatever binds ("every image became
// the car").  Phaser only rebuilds on contextrestored, which never fires in
// that path, so main.js probes on return and rebuilds when handles are dead.
//
// The old code's probe returned `true` (= rebuild everything) when it THREW.
// A full rebuild allocates every GL resource anew before the old handles are
// collected — a transient spike that can itself be the kill.  So:
//   • an inconclusive or throwing probe → NO rebuild (fail closed), logged
//   • a real context loss → nothing; Phaser's own handler owns it
//   • a rebuild runs at most once per real restoration, with a cooldown, and
//     never while a rotation settle or an asset load is in flight (it is
//     DEFERRED once, then re-evaluated)
//
// Pure decision functions + a small controller with injected clock/timers.

/**
 * Probe a sample of live texture wrappers.
 * @returns {{verdict:'lost'|'healthy'|'evicted'|'inconclusive', checked:number, dead:number, error?:string}}
 */
export function probeGpu({ gl, wrappers, sample = 8 } = {}) {
  try {
    if (!gl) return { verdict: 'inconclusive', checked: 0, dead: 0, error: 'no-gl' };
    if (gl.isContextLost?.()) return { verdict: 'lost', checked: 0, dead: 0 };
    let checked = 0, dead = 0;
    for (const w of (wrappers ?? [])) {
      if (!w?.webGLTexture) continue;
      checked++;
      if (!gl.isTexture(w.webGLTexture)) dead++;
      if (checked >= sample) break;
    }
    if (checked === 0) return { verdict: 'inconclusive', checked, dead, error: 'no-wrappers' };
    return { verdict: dead > 0 ? 'evicted' : 'healthy', checked, dead };
  } catch (e) {
    return { verdict: 'inconclusive', checked: 0, dead: 0, error: String(e?.message ?? e) };
  }
}

/**
 * Decide what a visibility return should do.
 * @returns {{action:'skip'|'defer'|'rebuild', reason:string}}
 */
export function decideRecovery({
  awayMs, minAwayMs = 30000, contextLost = false, busy = false, inFlight = false,
  sinceLastRebuildMs = Infinity, cooldownMs = 60000, probe,
} = {}) {
  if (awayMs < minAwayMs)               return { action: 'skip', reason: 'brief' };
  if (contextLost)                      return { action: 'skip', reason: 'context-lost' };
  if (inFlight)                         return { action: 'skip', reason: 'in-flight' };
  if (sinceLastRebuildMs < cooldownMs)  return { action: 'skip', reason: 'cooldown' };
  if (busy)                             return { action: 'defer', reason: 'busy' };
  if (!probe)                           return { action: 'skip', reason: 'no-probe' };
  switch (probe.verdict) {
    case 'evicted':  return { action: 'rebuild', reason: `dead ${probe.dead}/${probe.checked}` };
    case 'healthy':  return { action: 'skip', reason: 'healthy' };
    case 'lost':     return { action: 'skip', reason: 'context-lost' };
    default:         return { action: 'skip', reason: `inconclusive:${probe.error ?? '?'}` };
  }
}

/**
 * Controller: feed it visibility states; it probes/decides/rebuilds under the
 * guards above.
 * @param {object} deps
 * @param {() => ({gl, wrappers, contextLost}|null)} deps.getGpu
 * @param {() => boolean} deps.isBusy        rotation settle pending / scene loading / streamer in flight
 * @param {() => void} deps.rebuild          the actual resource rebuild
 * @param {(ev:string, info:object) => void} [deps.onEvent]   diagnostics hook
 */
export function createVisibilityRecovery({
  getGpu, isBusy = () => false, rebuild, onEvent = () => {},
  now = () => Date.now(), setTimeout: st = (fn, ms) => setTimeout(fn, ms),
  minAwayMs = 30000, cooldownMs = 60000, deferMs = 1200, maxDefers = 3,
} = {}) {
  let hiddenAt = 0;
  let lastRebuildAt = -Infinity;
  let inFlight = false;
  let deferTimer = null;
  let defers = 0;
  const history = [];

  const note = (ev, info) => {
    history.push({ t: now(), ev, ...info });
    while (history.length > 16) history.shift();
    try { onEvent(ev, info); } catch (_) {}
  };

  const evaluate = (awayMs) => {
    const gpu = getGpu?.() ?? null;
    const probeNeeded = awayMs >= minAwayMs && !gpu?.contextLost && !inFlight
      && (now() - lastRebuildAt) >= cooldownMs && !isBusy();
    const probe = probeNeeded ? probeGpu(gpu ?? {}) : null;
    const d = decideRecovery({
      awayMs, minAwayMs, contextLost: !!gpu?.contextLost, busy: isBusy(), inFlight,
      sinceLastRebuildMs: now() - lastRebuildAt, cooldownMs, probe,
    });
    note('decide', { awayMs, ...d, probe });
    if (d.action === 'defer') {
      if (defers >= maxDefers) { note('give-up', { awayMs }); defers = 0; return; }
      defers++;
      if (deferTimer) return;
      deferTimer = st(() => { deferTimer = null; evaluate(awayMs); }, deferMs);
      return;
    }
    defers = 0;
    if (d.action !== 'rebuild') return;
    inFlight = true;
    lastRebuildAt = now();
    note('rebuild-start', { awayMs });
    try { rebuild(); note('rebuild-done', {}); }
    catch (e) { note('rebuild-failed', { error: String(e?.message ?? e) }); }
    finally { inFlight = false; }
  };

  return {
    onVisibility(state) {
      if (state === 'hidden') { hiddenAt = now(); note('hidden', {}); return; }
      const away = hiddenAt ? now() - hiddenAt : 0;
      hiddenAt = 0;
      note('visible', { awayMs: away });
      evaluate(away);
    },
    state: () => ({ inFlight, lastRebuildAt, defers, history: [...history] }),
  };
}
