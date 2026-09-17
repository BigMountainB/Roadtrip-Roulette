// ── ImageStreamer — the ONE dynamic image-loading path ─────────────────────
// iPhone stability pass (owner + Chat/Codex, 2026-09-15), items 5/6/7/8.
//
// Before this module there were four ad-hoc runtime loaders with four
// different failure modes:
//   • scenery bands  — scene LoaderPlugin (documented to sit stuck in LOADING
//                      after a scene.restart(); files never hit the network)
//   • police art     — bare Image() + textures.addImage, per-key retry states
//                      kept on the reused GameScene instance
//   • story panels   — scene LoaderPlugin with a shared once('complete')
//   • rest-stop art  — scene LoaderPlugin with a shared once('loaderror'):
//                      ONE failed file consumed the error listener belonging
//                      to every other in-flight request and left their keys
//                      marked "loading" for the rest of the visit
//
// This service owns all of it, at GAME level (textures live on the game-level
// TextureManager and survive scene restarts, so the cache bookkeeping must
// too).  Scenes talk to it through a HANDLE (see handle()); releasing the
// handle at scene shutdown is what makes a late completion from an old scene
// generation unable to touch the new one.
//
// Guarantees:
//   • one in-flight request per key; duplicate requests join the waiter list
//   • at most `maxInFlight` images decoding at once (large PNGs decode at
//     w×h×4 — three 1672×941s landing together is an 18 MiB transient)
//   • per-key state machine: queued → loading → (loaded | failed → retry with
//     backoff | gone after maxTries).  Nothing stays "loading" forever: every
//     path clears the in-flight marker.
//   • a cooldown after eviction so a just-evicted key can't be reloaded next
//     tick (load/evict oscillation on a boundary)
//   • a byte budget with hysteresis (high-water → evict LRU down to low-water)
//     over the textures THIS streamer put in the manager; pinned keys (what a
//     consumer says it is displaying) are never evicted
//   • textures are removed through TextureManager.remove(), which reaches
//     TextureSource.destroy() → renderer.deleteTexture() — the real GL delete
//
// Deliberately NOT using HTMLImageElement.decode(): it materialises the
// decoded bitmap as an EXTRA step before Phaser's own upload, which is more
// transient overlap, not less.  onload → addImage is the shortest path.
//
// Pure JS with injectable Image / timers / clock, so the whole state machine
// is covered by tests/stability.test.mjs without a browser.

const MiB = 1048576;

export const STREAM_DEFAULTS = Object.freeze({
  maxInFlight:   2,
  // Backstop ABOVE the measured route working set, not a competitor to it:
  // the consumers pin everything inside their windows, so this only trims
  // stragglers and leaks.  Measured 2026-09-16 (sharp, decoded w×h×4):
  // police window (WSP + 2 agencies + the 90 MB generic/SWAT/heli extras)
  // 130.5 MB worst mile; scenery ±14 mi windows ~45 MB; a rest stop's
  // portraits + story panels ~50 MB → ~225 MB.  A 96 MiB budget (first cut)
  // evicted in-window police frames on the first device boot and the sweep
  // re-requested them: exactly the oscillation this module exists to stop.
  budgetBytes:   256 * MiB,  // high-water for streamed textures (NOT the boot set)
  lowWaterBytes: 208 * MiB,  // evict down to this once over budget
  cooldownMs:    20000,      // no reload of a key evicted more recently than this
  maxTries:      3,
  retryBaseMs:   3000,       // failed → retry after base·2^(tries−1)
  recentKeep:    12,         // diagnostics ring sizes
});

export class ImageStreamer {
  /**
   * @param {object} textures  Phaser TextureManager (or a test double with
   *   exists(key) / addImage(key, img) / remove(key) / get(key).source[0]).
   * @param {object} [opts]    STREAM_DEFAULTS overrides + injectables:
   *   now(), setTimeout(fn, ms), clearTimeout(id), makeImage() → {onload,onerror,src,naturalWidth,naturalHeight}
   */
  constructor(textures, opts = {}) {
    this.tex = textures;
    this.o = { ...STREAM_DEFAULTS, ...opts };
    this.now = opts.now ?? (() => Date.now());
    this.setTimeout = opts.setTimeout ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimeout = opts.clearTimeout ?? ((id) => clearTimeout(id));
    this.makeImage = opts.makeImage ?? (() => new Image());

    this.entries = new Map();     // key → { key, path, state, tries, nextAt, waiters:[], img }
    this.queue = [];              // keys in 'queued' / 'failed' (awaiting nextAt)
    this.inFlight = 0;
    this.resident = new Map();    // key → { bytes, lastUsed, loadedAt }  (what we manage)
    this.evictedAt = new Map();   // key → time of last eviction (cooldown)
    this.gone = new Set();        // keys that failed maxTries this session
    this.handles = new Map();     // id → handle
    this._nextHandle = 1;
    this._retryTimer = null;

    this.stats = {
      loaded: 0, reloaded: 0, failed: 0, gone: 0, evicted: 0, dedup: 0,
      stale: 0, cancelled: 0, cooled: 0,
      peakBytes: 0, peakInFlight: 0,
      recentLoaded: [], recentEvicted: [],
    };
  }

  // ── Handles (scene generations) ──────────────────────────────────────────
  /**
   * A consumer identity.  Every request made through it carries its callbacks;
   * release() at scene shutdown drops those callbacks (a completion that lands
   * afterwards still caches the texture — it is shared state — but calls
   * nothing) and its pins.
   */
  handle(label = '') {
    const self = this;
    const h = {
      id: this._nextHandle++, label, alive: true, pins: [],
      /** `extra.force` bypasses the post-eviction cooldown (and retries a
       *  'gone' key once more).  For ON-DEMAND UI art — a story panel, a
       *  portrait card, a storefront the player just opened — where "wait
       *  20 s because a sweep evicted this a moment ago" is wrong; route
       *  sweeps (scenery, police) leave it off so a boundary can't thrash. */
      request(key, path, onDone, onFail, extra = {}) {
        return self.request(key, path, { handle: h, onDone, onFail, force: !!extra.force });
      },
      pin(fn) { if (typeof fn === 'function') h.pins.push(fn); return h; },
      /** Dispose THIS handle (scene shutdown).  Takes no keys — texture
       *  release is releaseKeys / releaseUnpinned below. */
      release() { self.cancel(h); },
      /** Explicit texture release (ignores pins). */
      releaseKeys(keys) { return self.release(keys); },
      /** Route-window sweep: drop only what no live handle pins. */
      releaseUnpinned(keys) { return self.releaseUnpinned(keys); },
      touch(key) { self.touch(key); },
    };
    this.handles.set(h.id, h);
    return h;
  }

  /** True when any live handle says it is displaying `key`. */
  isPinned(key) {
    for (const h of this.handles.values()) {
      if (!h.alive) continue;
      for (const fn of h.pins) { try { if (fn(key)) return true; } catch (_) {} }
    }
    return false;
  }

  /** Drop a handle: its waiters go stale, its pins vanish. */
  cancel(h) {
    if (!h || !h.alive) return;
    h.alive = false;
    h.pins.length = 0;
    this.handles.delete(h.id);
    for (const e of this.entries.values()) {
      const before = e.waiters.length;
      e.waiters = e.waiters.filter(w => w.handle !== h);
      this.stats.cancelled += before - e.waiters.length;
      // Nobody left wanting a queued (not yet started) file → don't fetch it.
      if (!e.waiters.length && e.state !== 'loading') this._drop(e.key);
    }
  }

  // ── Requests ─────────────────────────────────────────────────────────────
  /**
   * Ask for `key` from `path`.  Returns the key's state right now:
   *   'loaded'   already resident — onDone is NOT called (avoids a synchronous
   *              callback before the caller has finished setting up; check the
   *              return value instead)
   *   'queued' | 'loading' | 'failed' | 'cooling'   in progress; onDone(key) /
   *              onFail(key, reason) fire later, only while the handle is alive
   *   'gone'     failed maxTries this session — onFail is NOT called
   */
  request(key, path, { handle = null, onDone = null, onFail = null, force = false } = {}) {
    if (!key) return 'gone';
    if (this.tex.exists(key)) { this.touch(key); return 'loaded'; }
    if (this.gone.has(key) && !force) return 'gone';

    let e = this.entries.get(key);
    if (e) {
      this.stats.dedup++;
      if (onDone || onFail) e.waiters.push({ handle, onDone, onFail });
      return e.state;
    }
    if (!path) return 'gone';

    e = { key, path, state: 'queued', tries: 0, nextAt: 0, waiters: [], img: null };
    if (onDone || onFail) e.waiters.push({ handle, onDone, onFail });
    // Cooldown: evicted a moment ago → hold it back so a boundary can't thrash.
    const ev = this.evictedAt.get(key);
    if (!force && ev != null && this.now() - ev < this.o.cooldownMs) {
      e.state = 'cooling';
      e.nextAt = ev + this.o.cooldownMs;
      this.stats.cooled++;
    }
    if (force) this.gone.delete(key);
    this.entries.set(key, e);
    this.queue.push(key);
    this._pump();
    return e.state;
  }

  /** LRU bump — a consumer drew `key` this frame. */
  touch(key) {
    const r = this.resident.get(key);
    if (r) r.lastUsed = this.now();
  }

  /** Register a texture someone else loaded (e.g. a scene preload) so the
   *  budget and release() account for it. */
  adopt(key) {
    if (this.resident.has(key) || !this.tex.exists(key)) return false;
    const s = this.tex.get(key)?.source?.[0];
    const bytes = ((s?.width ?? 0) * (s?.height ?? 0) * 4) || 0;
    this.resident.set(key, { bytes, lastUsed: this.now(), loadedAt: this.now() });
    this._notePeak();
    return true;
  }

  // ── Eviction ─────────────────────────────────────────────────────────────
  /**
   * Remove textures (and cancel their pending loads).  Ignores pins — this is
   * the consumer's explicit "I am done with these"; use releaseUnpinned() for
   * route-window sweeps.  Returns bytes freed.
   */
  release(keys) {
    let freed = 0;
    for (const key of (Array.isArray(keys) ? keys : [keys])) {
      if (this.entries.has(key)) this._drop(key);
      if (!this.tex.exists(key)) { this.resident.delete(key); continue; }
      const r = this.resident.get(key);
      const s = this.tex.get(key)?.source?.[0];
      const bytes = r?.bytes ?? (((s?.width ?? 0) * (s?.height ?? 0) * 4) || 0);
      try { this.tex.remove(key); } catch (_) { continue; }
      this.resident.delete(key);
      this.evictedAt.set(key, this.now());
      freed += bytes;
      this.stats.evicted++;
      this._ring(this.stats.recentEvicted, key);
    }
    return freed;
  }

  /** Route-window sweep: release every key in `keys` no live handle pins. */
  releaseUnpinned(keys) {
    return this.release(keys.filter(k => !this.isPinned(k)));
  }

  /** Total bytes of what this streamer manages. */
  residentBytes() {
    let b = 0;
    for (const r of this.resident.values()) b += r.bytes;
    return b;
  }

  /**
   * Byte budget with hysteresis: above budgetBytes, evict least-recently-used
   * unpinned keys until at or below lowWaterBytes.  Returns the keys evicted.
   * Runs after every load; cheap when under budget.
   */
  enforceBudget() {
    let total = this.residentBytes();
    if (total <= this.o.budgetBytes) return [];
    const lru = [...this.resident.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    const out = [];
    for (const [key, r] of lru) {
      if (total <= this.o.lowWaterBytes) break;
      if (this.isPinned(key)) continue;
      const freed = this.release([key]);
      if (freed || !this.tex.exists(key)) { total -= r.bytes; out.push(key); }
    }
    // Still over with nothing evictable = the pinned working set itself is
    // bigger than the budget.  That is a transient-overlap / sizing fact the
    // owner needs to see, not something to "fix" by evicting what's on screen.
    if (total > this.o.budgetBytes) {
      this.stats.overBudget = (this.stats.overBudget ?? 0) + 1;
      const t = this.now();
      if (t - (this._overWarnT ?? -1e9) > 10000) {
        this._overWarnT = t;
        try { console.warn(`[stream] pinned working set ${r1(total / MiB)} MB exceeds the ${r1(this.o.budgetBytes / MiB)} MB streamed budget (${out.length} evicted this pass)`); } catch (_) {}
      }
    }
    return out;
  }

  // ── Diagnostics ──────────────────────────────────────────────────────────
  snapshot() {
    let queued = 0, failed = 0, cooling = 0;
    for (const e of this.entries.values()) {
      if (e.state === 'queued') queued++;
      else if (e.state === 'failed') failed++;
      else if (e.state === 'cooling') cooling++;
    }
    const bytes = this.residentBytes();
    return {
      inFlight: this.inFlight, queued, failed, cooling, gone: this.gone.size,
      resident: this.resident.size, residentMb: r1(bytes / MiB),
      peakMb: r1(this.stats.peakBytes / MiB), peakInFlight: this.stats.peakInFlight,
      loaded: this.stats.loaded, reloaded: this.stats.reloaded, evicted: this.stats.evicted,
      dedup: this.stats.dedup, stale: this.stats.stale, cancelled: this.stats.cancelled,
      recentLoaded: [...this.stats.recentLoaded], recentEvicted: [...this.stats.recentEvicted],
      handles: [...this.handles.values()].filter(h => h.alive).map(h => h.label),
    };
  }

  // ── Internals ────────────────────────────────────────────────────────────
  _drop(key) {
    const e = this.entries.get(key);
    if (!e) return;
    if (e.state === 'loading' && e.img) {
      // Abort the fetch/decode: detach handlers first so the abort can't be
      // reported as a failure, then blank the source.
      try { e.img.onload = null; e.img.onerror = null; e.img.src = ''; } catch (_) {}
      this.inFlight = Math.max(0, this.inFlight - 1);
    }
    this.entries.delete(key);
    const i = this.queue.indexOf(key);
    if (i >= 0) this.queue.splice(i, 1);
  }

  _pump() {
    const now = this.now();
    let earliest = Infinity;
    for (let i = 0; i < this.queue.length && this.inFlight < this.o.maxInFlight;) {
      const e = this.entries.get(this.queue[i]);
      if (!e) { this.queue.splice(i, 1); continue; }
      if (e.nextAt > now) { earliest = Math.min(earliest, e.nextAt); i++; continue; }
      this.queue.splice(i, 1);
      this._start(e);
    }
    // Something is waiting on a backoff/cooldown: wake exactly when it's due.
    if (earliest < Infinity && !this._retryTimer) {
      this._retryTimer = this.setTimeout(() => { this._retryTimer = null; this._pump(); },
        Math.max(1, earliest - now));
    }
  }

  _start(e) {
    e.state = 'loading';
    e.tries++;
    this.inFlight++;
    this.stats.peakInFlight = Math.max(this.stats.peakInFlight, this.inFlight);
    const img = this.makeImage();
    e.img = img;
    img.onload = () => this._onLoad(e, img);
    img.onerror = () => this._onError(e);
    try { img.src = e.path; } catch (_) { this._onError(e); }
  }

  _onLoad(e, img) {
    if (this.entries.get(e.key) !== e) return;      // dropped while loading
    this.inFlight = Math.max(0, this.inFlight - 1);
    this.entries.delete(e.key);
    e.img = null;
    try { if (!this.tex.exists(e.key)) this.tex.addImage(e.key, img); } catch (_) {
      // TextureManager refused it (destroyed game?) — treat as failed, no retry.
      this._finish(e, false, 'addImage');
      this._pump();
      return;
    }
    const bytes = ((img.naturalWidth ?? img.width ?? 0) * (img.naturalHeight ?? img.height ?? 0) * 4) || 0;
    const t = this.now();
    this.resident.set(e.key, { bytes, lastUsed: t, loadedAt: t });
    this.stats.loaded++;
    if (this.evictedAt.has(e.key)) this.stats.reloaded++;
    this._ring(this.stats.recentLoaded, e.key);
    this._notePeak();
    this._finish(e, true);
    this.enforceBudget();
    this._pump();
  }

  _onError(e) {
    if (this.entries.get(e.key) !== e) return;
    this.inFlight = Math.max(0, this.inFlight - 1);
    e.img = null;
    this.stats.failed++;
    if (e.tries >= this.o.maxTries) {
      this.entries.delete(e.key);
      this.gone.add(e.key);
      this.stats.gone++;
      this._finish(e, false, 'gone');
    } else {
      e.state = 'failed';
      e.nextAt = this.now() + this.o.retryBaseMs * Math.pow(2, e.tries - 1);
      this.queue.push(e.key);
    }
    this._pump();
  }

  _finish(e, ok, reason) {
    const waiters = e.waiters; e.waiters = [];
    for (const w of waiters) {
      if (w.handle && !w.handle.alive) { this.stats.stale++; continue; }
      try { ok ? w.onDone?.(e.key) : w.onFail?.(e.key, reason); } catch (_) {}
    }
  }

  _notePeak() {
    this.stats.peakBytes = Math.max(this.stats.peakBytes, this.residentBytes());
  }

  _ring(arr, key) {
    arr.push(key);
    while (arr.length > this.o.recentKeep) arr.shift();
  }
}

const r1 = (n) => Math.round(n * 10) / 10;
