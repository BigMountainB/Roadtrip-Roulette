const STORAGE_KEY    = 'rtr.save.v3';
// Legacy key from the DUI-branded builds — same v3 schema, just the old name.
// Read once and promoted to STORAGE_KEY on the next save so progress migrates.
const LEGACY_DUI_V3  = 'dui.save.v3';
const LEGACY_V2_KEY  = 'dui.save.v2';
const LEGACY_V1_KEY  = 'dui.save.v1';
const SCHEMA_VERSION = 3;

// Number of player profile slots shown on the title screen.  Each slot is a
// FULLY independent save (its own plate, stats, leaderboard, money, cars,
// vices, checkpoints, achievements) — switching plate = switching players.
const SLOT_COUNT = 3;

// Keys whose first segment routes to the cross-mode GLOBAL section of the
// ACTIVE SLOT (not the per-steering-mode profile).  Per user direction:
// achievements (incl. "beat the others" cross-mode badges) are global;
// audio/mute settings travel with the user, not the mode.  Checkpoint
// tiers (highest-difficulty reached per rest stop, for the route-map
// tier colors) are also global so the map shows lifetime progress.
// Everything else (money, restStopSaves, lastRestStop, missionProgress,
// vice inventory, owned cars) lives in the per-mode profile.
// stats + leaderboard are lifetime/cross-mode, so they live in GLOBAL too:
// a per-mode "start over" must NOT wipe career totals or the high-score
// board.  StatsTracker owns the canonical `stats` shape and deep-merges
// its defaults on load, so the bucket here can start empty.
// NOTE: "global" is now per-SLOT — each player keeps their own lifetime
// stats / achievements; only progress is duplicated per steering mode.
const GLOBAL_KEYS = new Set(['achievements', 'settings', 'checkpointTiers', 'stats', 'leaderboard', 'radarDetector']);

// Storage-key names for each profile bucket.  Kept as-is for backward
// compatibility with on-disk saves.  The GameScene UI uses 'flappy' and
// 'lr' as user-facing labels; we alias those into 'tap' and 'classic'
// via MODE_ALIASES below so the wrong-vocabulary call doesn't silently
// fall through to a no-op (which was the old behavior — a TAP-mode
// player's setMode('flappy') was rejected and the profile stayed on
// whatever was previously active).
const VALID_MODES = ['tap', 'classic', 'tilt'];
const MODE_ALIASES = {
  flappy: 'tap',       // newer UI name for the tap-to-steer scheme
  lr:     'classic',   // newer UI name for the left/right-thumb scheme
};
function normalizeMode(mode) {
  return MODE_ALIASES[mode] ?? mode;
}

function isObj(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

// Stable per-slot player identity — generated ONCE when a slot is created and
// preserved across loads.  This is the anchor a future online leaderboard
// keys runs to (so a plate rename doesn't reassign run history); the plate is
// the mutable public display name, playerId is the immutable owner.
function genPlayerId() {
  try { if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID(); } catch (_) {}
  // Fallback for environments without crypto.randomUUID.
  return 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function finiteNum(v, fallback = 0, min = -Infinity, max = Infinity) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function finiteInt(v, fallback = 0, min = -Infinity, max = Infinity) {
  return Math.round(finiteNum(v, fallback, min, max));
}

function cleanString(v, fallback = '') {
  return typeof v === 'string' ? v : fallback;
}

function cleanJson(v, fallback, depth = 0) {
  if (depth > 8) return fallback;
  if (v == null || typeof v === 'string' || typeof v === 'boolean') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  if (Array.isArray(v)) return v.slice(0, 250).map(x => cleanJson(x, null, depth + 1));
  if (!isObj(v)) return fallback;
  const out = {};
  for (const [k, val] of Object.entries(v)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    out[k] = cleanJson(val, null, depth + 1);
  }
  return out;
}

const DEFAULT_PROFILE = {
  money:           0,
  ownedCars:       ['beater'],
  currentCar:      'beater',
  viceInventory:   {},
  missionProgress: 0,
  lastRestStop:    null,
  restStopSaves:   {},
  // Mid-drive autosave so an unexpected reload (iOS discards a backgrounded
  // WebGL tab under memory pressure) resumes the LIVE run instead of losing
  // all money/progress.  Shape: { snap: <full _collectSaveSnapshot>, ts }.
  // Cleared on a clean trip-end / Start Over / Main Menu / death.
  liveRun:         null,
  // One-time $15k retainer (phone → Messages → The Lawyer).  Halves every
  // future "busted" fine.  Per-profile progress, so Reset Progress clears it.
  lawyerRetained:  false,
  // Pre-paid Dealer orders (phone → Messages → The Dealer): a list of vice
  // ids paid for up front, redeemed FREE at the next rest stop's vice menu.
  dealerOrders:    [],
  // Per-vehicle accessory state.  Shape:
  //   accessories: { [vehicleId]: { bumper: bool, traction: bool, nos: 0|1|2|3 } }
  // Bumper / traction are one-shot purchases (boolean).  NOS is a tier
  // counter — 0 (none) → 3 (max).  Each tier adds +5 mph to cruise + boost.
  accessories:     {},
};

const DEFAULT_GLOBAL = {
  achievements:    {},
  checkpointTiers: {},          // { [stopId]: 'bronze' | 'silver' | 'gold' }
  settings:        { muted: false, radio: 0, backgroundRadio: true },
  // Career stats — full canonical shape is owned by StatsTracker, which
  // deep-merges its defaults over whatever is here on boot.  Empty is fine.
  stats:           {},
  // Leaderboard run-record history.  Local-only for now; a future remote
  // provider posts the same record shape, so flipping the backend flag
  // doesn't touch this bucket.  Capped by the Leaderboard layer.
  leaderboard:     { runs: [] },
  // Radar detector — a buy-once gadget (global, works in every car) that
  // beeps + flashes a dashboard light approaching a speed trap.  Persists
  // across runs once bought.
  radarDetector:   false,
};

// A single player profile slot — its license-plate handle plus a complete,
// self-contained save (global bucket + one profile per steering mode).
function emptySlot() {
  return {
    plate:    '',
    playerId: genPlayerId(),    // immutable owner id (online leaderboard anchor)
    global:   structuredClone(DEFAULT_GLOBAL),
    profiles: Object.fromEntries(VALID_MODES.map(m => [m, structuredClone(DEFAULT_PROFILE)])),
  };
}

function emptyData() {
  return {
    version:    SCHEMA_VERSION,
    activeSlot: 0,
    slots:      Array.from({ length: SLOT_COUNT }, emptySlot),
  };
}

// Money used to live in each per-mode profile, so a player's cash changed when
// they switched steering mode.  It now belongs to the PLATE (the slot's GLOBAL
// bucket), shared across tap/classic/tilt.  This lifts the largest per-mode
// balance up ONCE per save — `global.money` still being undefined marks a save
// that hasn't migrated yet (DEFAULT_GLOBAL deliberately omits `money` so the
// undefined check works; the per-slot wallet getter backfills it to 0).
function liftMoneyToGlobal(slot) {
  if (!slot || typeof slot.global !== 'object') return;
  if (Number.isFinite(slot.global.money)) {
    slot.global.money = finiteInt(slot.global.money, 0, 0);
    return;   // already migrated
  }
  let m = 0;
  for (const mode of VALID_MODES) {
    const v = slot.profiles?.[mode]?.money;
    if (Number.isFinite(v) && v > m) m = v;
  }
  slot.global.money = finiteInt(m, 0, 0);
}

export class SaveSystem {
  constructor() {
    this._mode = 'tap';                  // default; GameScene re-sets after _steeringMode() loads
    this._loadRepaired = false;
    this.data  = this._load();
    if (this._loadRepaired) this.save();
  }

  /** Switch the active profile.  Call this whenever the player's
   *  steering mode changes.  Accepts both legacy ('tap'/'classic') and
   *  newer UI ('flappy'/'lr') mode names — both resolve to the same
   *  underlying storage bucket via normalizeMode.  Subsequent save/load
   *  operations read & write that profile's slot. */
  setMode(mode) {
    const m = normalizeMode(mode);
    if (!VALID_MODES.includes(m)) return;
    this._mode = m;
  }

  // ── Player slots ────────────────────────────────────────────────────
  // Each slot is a full independent save.  The title screen surfaces the
  // three slots as license plates; the active slot is the live player.

  get slotCount() { return SLOT_COUNT; }

  /** The active player slot's container.  Guards a corrupt/out-of-range
   *  activeSlot back to a valid index so reads never blow up. */
  get _slot() {
    let i = this.data.activeSlot | 0;
    if (i < 0 || i >= this.data.slots.length) { i = 0; this.data.activeSlot = 0; }
    if (!this.data.slots[i]) this.data.slots[i] = emptySlot();
    if (!isObj(this.data.slots[i].global)) this.data.slots[i].global = structuredClone(DEFAULT_GLOBAL);
    if (!isObj(this.data.slots[i].profiles)) this.data.slots[i].profiles = {};
    return this.data.slots[i];
  }

  get activeSlot() { return this.data.activeSlot | 0; }

  /** Switch the live player slot.  Returns true if the index was valid. */
  selectSlot(i) {
    i = i | 0;
    if (i < 0 || i >= this.data.slots.length) return false;
    this.data.activeSlot = i;
    this.save();
    return true;
  }

  /** The plate (handle) of a given slot, or the active slot if omitted. */
  plateOf(i) {
    const slot = (i == null) ? this._slot : this.data.slots[i | 0];
    return (slot?.plate ?? '').toString();
  }

  /** True when a slot has a non-empty plate (i.e. it's a created player). */
  slotUsed(i) {
    return !!this.plateOf(i).trim();
  }

  /** Lightweight summary for the title-screen plate widgets. */
  slotInfo() {
    return this.data.slots.map((s, i) => ({
      index: i,
      plate: (s?.plate ?? '').toString(),
      used:  !!(s?.plate ?? '').trim(),
    }));
  }

  /** Set a slot's plate handle.  Does NOT switch the active slot. */
  setSlotPlate(i, plate) {
    i = i | 0;
    if (i < 0 || i >= this.data.slots.length) return;
    if (!this.data.slots[i]) this.data.slots[i] = emptySlot();
    this.data.slots[i].plate = (plate ?? '').toString();
    this.save();
  }

  /** Immutable owner id for a slot (active slot if omitted).  Lazily mints +
   *  persists one if a legacy slot somehow still lacks it. */
  playerIdOf(i) {
    const slot = (i == null) ? this._slot : this.data.slots[i | 0];
    if (!slot) return '';
    if (typeof slot.playerId !== 'string' || !slot.playerId.trim()) {
      slot.playerId = genPlayerId();
      this.save();
    }
    return slot.playerId;
  }

  /** The active player's immutable owner id. */
  get activePlayerId() { return this.playerIdOf(null); }

  /** The active player's plate handle. */
  get activePlate() { return (this._slot.plate ?? '').toString(); }
  setActivePlate(plate) {
    this._slot.plate = (plate ?? '').toString();
    this.save();
  }

  /** Fully blank a slot (plate + stats + all progress) — used by the
   *  Settings reset, the only path that clears a plate name. */
  resetSlot(i) {
    i = i | 0;
    if (i < 0 || i >= this.data.slots.length) return;
    this.data.slots[i] = emptySlot();
    this.save();
  }

  /** The active per-mode profile within the active slot.  Wallet
   *  reads/writes `.money` on this object directly, so it has to stay a
   *  live reference, not a copy. */
  get profile() {
    const slot = this._slot;
    if (!isObj(slot.profiles[this._mode])) {
      slot.profiles[this._mode] = structuredClone(DEFAULT_PROFILE);
    }
    return slot.profiles[this._mode];
  }

  /** The active PLATE's wallet store.  Money follows the license plate (the
   *  slot's GLOBAL bucket), NOT the steering mode, so it's shared across
   *  tap / classic / tilt.  Live reference — Wallet mutates `.money` directly,
   *  so this must return the real object (not a copy).  Backfills `.money` to
   *  an integer in case a slot predates the migration. */
  get walletStore() {
    const g = this._slot.global;
    if (!Number.isFinite(g.money) || !Number.isInteger(g.money) || g.money < 0) g.money = 0;
    return g;
  }

  _load() {
    try {
      const rawV3 = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_DUI_V3);
      if (rawV3) return this._migrate(JSON.parse(rawV3));
      // v2 (mode-split, single player) — promote it to slot 0.
      const rawV2 = localStorage.getItem(LEGACY_V2_KEY);
      if (rawV2) return this._fromV2(JSON.parse(rawV2));
      // v1 (pre-mode-split, single profile) — promote to slot 0 / tap.
      const rawV1 = localStorage.getItem(LEGACY_V1_KEY);
      if (rawV1) return this._fromV1(JSON.parse(rawV1));
      return emptyData();
    } catch (e) {
      console.warn('[SaveSystem] load failed, using defaults:', e);
      this._loadRepaired = true;
      return emptyData();
    }
  }

  _migrate(data) {
    if (!isObj(data)) { this._loadRepaired = true; return emptyData(); }
    if (data.version !== SCHEMA_VERSION) { this._loadRepaired = true; return emptyData(); }
    // Backfill any missing slots / global keys / profile slots against the
    // current defaults so additive future changes don't crash on load.
    const out = emptyData();
    out.activeSlot = Number.isInteger(data.activeSlot) ? data.activeSlot : 0;
    if (out.activeSlot < 0 || out.activeSlot >= SLOT_COUNT) out.activeSlot = 0;
    if (out.activeSlot !== data.activeSlot) this._loadRepaired = true;
    if (!Array.isArray(data.slots) || data.slots.length !== SLOT_COUNT) this._loadRepaired = true;
    for (let i = 0; i < SLOT_COUNT; i++) {
      const src = Array.isArray(data.slots) ? data.slots[i] : null;
      out.slots[i] = this._fillSlot(src);
    }
    try {
      if (JSON.stringify(out) !== JSON.stringify(data)) this._loadRepaired = true;
    } catch (_) {
      this._loadRepaired = true;
    }
    return out;
  }

  /** Merge a stored slot over the default slot shape (defensive backfill). */
  _fillSlot(src) {
    const slot = emptySlot();
    if (!isObj(src)) { if (src != null) this._loadRepaired = true; return slot; }
    slot.plate  = (src.plate ?? '').toString();
    // Keep the existing owner id; only mint a new one if the slot predates the
    // playerId field (emptySlot() already seeded one above as the fallback).
    if (typeof src.playerId === 'string' && src.playerId.trim()) {
      slot.playerId = src.playerId.trim();
    } else {
      this._loadRepaired = true;   // persist the freshly-minted id on next save
    }
    slot.global = this._sanitizeGlobal(src.global);
    for (const m of VALID_MODES) {
      slot.profiles[m] = this._sanitizeProfile(src.profiles?.[m]);
    }
    liftMoneyToGlobal(slot);   // money belongs to the plate (global), not per-mode
    return slot;
  }

  _sanitizeGlobal(src) {
    const g = structuredClone(DEFAULT_GLOBAL);
    if (!isObj(src)) { if (src != null) this._loadRepaired = true; return g; }
    const achievements = cleanJson(src.achievements, {});
    const stats        = cleanJson(src.stats, {});
    g.achievements    = isObj(achievements) ? achievements : {};
    g.checkpointTiers = this._sanitizeCheckpointTiers(src.checkpointTiers);
    g.settings        = this._sanitizeSettings(src.settings);
    g.stats           = isObj(stats) ? stats : {};
    g.leaderboard     = this._sanitizeLeaderboard(src.leaderboard);
    g.radarDetector   = src.radarDetector === true;
    if (src.money !== undefined) g.money = finiteInt(src.money, 0, 0);
    return g;
  }

  _sanitizeProfile(src) {
    const p = structuredClone(DEFAULT_PROFILE);
    if (!isObj(src)) { if (src != null) this._loadRepaired = true; return p; }

    p.money = finiteInt(src.money, 0, 0);
    const owned = Array.isArray(src.ownedCars)
      ? [...new Set(src.ownedCars.filter(v => typeof v === 'string' && v.trim()).map(v => v.trim()))]
      : [];
    p.ownedCars = owned.length ? owned : ['beater'];
    p.currentCar = (typeof src.currentCar === 'string' && p.ownedCars.includes(src.currentCar))
      ? src.currentCar
      : p.ownedCars[0];
    p.viceInventory = this._sanitizeNumberMap(src.viceInventory, 0, 999);
    p.missionProgress = finiteNum(src.missionProgress, 0, 0);
    p.lastRestStop = this._sanitizeRestStopSnapshot(src.lastRestStop);
    p.restStopSaves = this._sanitizeRestStopSaves(src.restStopSaves);
    p.lawyerRetained = src.lawyerRetained === true;
    p.dealerOrders = Array.isArray(src.dealerOrders)
      ? src.dealerOrders.filter(v => typeof v === 'string' && v.trim()).slice(0, 50)
      : [];
    p.accessories = this._sanitizeAccessories(src.accessories);
    p.controlsLayout = this._sanitizeControlsLayout(src.controlsLayout);
    p.liveRun = this._sanitizeLiveRun(src.liveRun);
    return p;
  }

  /** Mid-drive autosave bucket.  Just a JSON-clean of the snapshot + a numeric
   *  timestamp — the GameScene owns the snapshot shape and re-validates fields
   *  on resume, so this only has to survive the load-time profile rebuild
   *  (which drops any key not explicitly copied here). */
  _sanitizeLiveRun(src) {
    if (!isObj(src)) return null;
    const snap = cleanJson(src.snap, null);
    if (!isObj(snap)) return null;
    return { snap, ts: finiteInt(src.ts, 0, 0), manual: src.manual === true };
  }

  _sanitizeSettings(src) {
    const s = { ...DEFAULT_GLOBAL.settings };
    if (!isObj(src)) return s;
    s.muted = src.muted === true;
    s.radio = finiteInt(src.radio, 0, 0, 9);
    if (src.backgroundRadio !== undefined) s.backgroundRadio = src.backgroundRadio !== false;
    if (src.haptics !== undefined) s.haptics = src.haptics !== false;
    if (src.units === 'kmh' || src.units === 'mph') s.units = src.units;
    if (src.shake !== undefined) s.shake = finiteNum(src.shake, 1, 0, 1);
    if (src.colorblind !== undefined) s.colorblind = src.colorblind === true;
    if (src.hud !== undefined) s.hud = src.hud !== false;
    if (src.handedness === 'left' || src.handedness === 'right') s.handedness = src.handedness;
    if (['easy', 'normal', 'hard'].includes(src.customSub)) s.customSub = src.customSub;
    return s;
  }

  _sanitizeCheckpointTiers(src) {
    const out = {};
    if (!isObj(src)) return out;
    for (const [k, v] of Object.entries(src)) {
      if (v === 'bronze' || v === 'silver' || v === 'gold') out[k] = v;
    }
    return out;
  }

  _sanitizeLeaderboard(src) {
    const out = { runs: [] };
    if (!isObj(src)) return out;
    if (Array.isArray(src.runs)) {
      out.runs = src.runs.slice(0, 200).map(r => cleanJson(r, null)).filter(isObj);
    }
    return out;
  }

  _sanitizeNumberMap(src, min = 0, max = Infinity) {
    const out = {};
    if (!isObj(src)) return out;
    for (const [k, v] of Object.entries(src)) {
      const n = finiteNum(v, NaN, min, max);
      if (Number.isFinite(n)) out[k] = n;
    }
    return out;
  }

  _sanitizeAccessories(src) {
    const out = {};
    if (!isObj(src)) return out;
    for (const [vehicleId, acc] of Object.entries(src)) {
      if (!isObj(acc)) continue;
      out[vehicleId] = {
        bumper:   acc.bumper === true,
        traction: acc.traction === true,
        nos:      finiteInt(acc.nos, 0, 0, 3),
      };
    }
    return out;
  }

  _sanitizeControlsLayout(src) {
    const out = {};
    if (!isObj(src)) return out;
    for (const [id, v] of Object.entries(src)) {
      if (!isObj(v)) continue;
      const dx = finiteInt(v.dx, 0, -5000, 5000);
      const dy = finiteInt(v.dy, 0, -5000, 5000);
      const scale = finiteNum(v.scale, 1, 0.3, 4);
      if (dx || dy || scale !== 1) out[id] = { dx, dy, scale };
    }
    return out;
  }

  _sanitizeRestStopSnapshot(src) {
    if (src == null) return null;
    if (!isObj(src)) return null;
    const out = cleanJson(src, {});
    if (!isObj(out)) return null;
    if (out.code !== undefined) out.code = cleanString(out.code).slice(0, 16);
    if (out.ts !== undefined) out.ts = finiteInt(out.ts, Date.now(), 0);
    if (out.mile !== undefined) out.mile = finiteNum(out.mile, 0, 0);
    if (out.vehicleId !== undefined) out.vehicleId = cleanString(out.vehicleId, 'beater') || 'beater';
    if (out.accessories !== undefined) {
      out.accessories = {
        bumper:   out.accessories?.bumper === true,
        traction: out.accessories?.traction === true,
        nos:      finiteInt(out.accessories?.nos, 0, 0, 3),
      };
    }
    return out;
  }

  _sanitizeRestStopSaves(src) {
    const out = {};
    if (!isObj(src)) return out;
    for (const [code, snap] of Object.entries(src)) {
      const clean = this._sanitizeRestStopSnapshot(snap);
      if (clean) out[code] = clean;
    }
    return out;
  }

  /** Promote a v2 ({ global, profiles }) save into slot 0 of a v3 store.
   *  A v2 license plate lived inside a mode profile (it wasn't a GLOBAL_KEY),
   *  so pull the first one we find up to the new per-slot `plate` field. */
  _fromV2(v2) {
    const out = emptyData();
    const slot = out.slots[0];
    if (isObj(v2)) {
      this._loadRepaired = true;
      slot.global = this._sanitizeGlobal(v2.global);
      for (const m of VALID_MODES) {
        const rawProfile = v2.profiles?.[m];
        const p = this._sanitizeProfile(rawProfile);
        // Lift any legacy per-profile plate up to the slot, then drop it.
        if (!slot.plate && typeof rawProfile?.licensePlate === 'string' && rawProfile.licensePlate.trim()) {
          slot.plate = rawProfile.licensePlate.trim();
        }
        slot.profiles[m] = p;
      }
    } else {
      this._loadRepaired = true;
    }
    liftMoneyToGlobal(slot);
    return out;
  }

  _fromV1(v1) {
    const out = emptyData();
    const slot = out.slots[0];
    if (!isObj(v1)) { this._loadRepaired = true; return out; }
    this._loadRepaired = true;
    if (v1?.achievements) {
      const achievements = cleanJson(v1.achievements, {});
      slot.global.achievements = isObj(achievements) ? achievements : {};
    }
    if (v1?.settings)     slot.global.settings     = this._sanitizeSettings(v1.settings);
    slot.profiles.tap = {
      ...slot.profiles.tap,
      money:           finiteInt(v1?.money, 0, 0),
      ownedCars:       Array.isArray(v1?.ownedCars) ? v1.ownedCars.filter(v => typeof v === 'string') : ['beater'],
      currentCar:      typeof v1?.currentCar === 'string' ? v1.currentCar : 'beater',
      viceInventory:   this._sanitizeNumberMap(v1?.viceInventory, 0, 999),
      missionProgress: finiteNum(v1?.missionProgress, 0, 0),
      lastRestStop:    this._sanitizeRestStopSnapshot(v1?.lastRestStop),
      restStopSaves:   this._sanitizeRestStopSaves(v1?.restStopSaves),
    };
    slot.profiles.tap = this._sanitizeProfile(slot.profiles.tap);
    liftMoneyToGlobal(slot);
    return out;
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('[SaveSystem] save failed:', e);
    }
  }

  /** Clear ALL players + state (every slot).  Used by debug "wipe save". */
  reset() {
    this.data = emptyData();
    this.save();
  }

  /** Clear ONLY the active steering-mode profile in the active slot (keep
   *  the plate, the slot's global state, and the other modes' progress).
   *  Used by per-mode "start over". */
  resetProfile() {
    this._slot.profiles[this._mode] = structuredClone(DEFAULT_PROFILE);
    this.save();
  }

  /** Settings → "Reset Progress".  Fully blanks the ACTIVE player slot —
   *  plate, lifetime stats, leaderboard, achievements, and every mode's
   *  progress — leaving the other two players untouched.  This is the only
   *  path that clears a plate name (per design). */
  resetProgress() {
    this.resetSlot(this.data.activeSlot | 0);
  }

  hasSave() {
    return localStorage.getItem(STORAGE_KEY)   !== null
        || localStorage.getItem(LEGACY_DUI_V3) !== null
        || localStorage.getItem(LEGACY_V2_KEY) !== null
        || localStorage.getItem(LEGACY_V1_KEY) !== null;
  }

  _rootFor(firstSeg) {
    return GLOBAL_KEYS.has(firstSeg) ? this._slot.global : this.profile;
  }

  get(path, fallback = undefined) {
    const parts = path.split('.');
    let cur = this._rootFor(parts[0]);
    for (const p of parts) {
      if (cur == null) return fallback;
      cur = cur[p];
    }
    return cur === undefined ? fallback : cur;
  }

  set(path, value) {
    const parts = path.split('.');
    let cur = this._rootFor(parts[0]);
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (cur[p] == null || typeof cur[p] !== 'object') cur[p] = {};
      cur = cur[p];
    }
    cur[parts[parts.length - 1]] = value;
    this.save();
  }
}
