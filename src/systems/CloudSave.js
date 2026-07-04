// Cloud-save client (talks to the Pages Function at /api/save).
//
// Always uses an ABSOLUTE URL so it works in every shell:
//   • web build   — could be same-origin, but absolute is fine
//   • iOS app     — Capacitor loads from capacitor://localhost, so a relative
//                   path would 404; it MUST hit the deployed origin
//   • local dev   — LAN origin, cross-origin to prod (CORS is enabled server-side)
//
// All calls are BEST-EFFORT: short timeout, never throw, return false/null on
// any failure so the game keeps working offline / before the API is deployed
// (local play just falls back to the on-device save + manual code).

// The cloud API is a standalone Cloudflare Worker (deployed via the dashboard,
// since wrangler hangs on this setup).  Set this to the Worker's URL after you
// create it (e.g. https://dui-api.<your-subdomain>.workers.dev).  A runtime
// override (window.__DUI_API_BASE) lets you point at it for testing without a
// rebuild.  Until it's set, all calls fail fast and the game falls back to the
// on-device save + manual code (no errors).
const _w = (typeof window !== 'undefined') ? window : null;
const _explicit = !!(_w && _w.__DUI_API_BASE);
const API_BASE = _explicit ? _w.__DUI_API_BASE
  : 'https://dui-api.brendanbaughn.workers.dev';
const TIMEOUT_MS = 6000;

// Local-dev guard — don't let localhost/LAN playtests write REAL cloud saves
// and leaderboard entries.  The iOS app also loads from "capacitor://localhost",
// but that's production, so we key off the PROTOCOL (http/https = a browser dev
// server) and a private host, never bare "localhost".  Setting
// window.__DUI_API_BASE is an explicit opt-in that re-enables cloud anywhere.
function _isDevOrigin() {
  const loc = _w?.location;
  if (!loc) return false;
  if (_w.Capacitor || loc.protocol === 'capacitor:' || loc.protocol === 'ionic:') return false;
  if (loc.protocol !== 'http:' && loc.protocol !== 'https:') return false;
  const h = loc.hostname || '';
  return h === 'localhost' || h === '::1' || h === '[::1]' || h.endsWith('.local')
      || /^(127\.|0\.0\.0\.0$|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h);
}
const _CLOUD_ENABLED = _explicit || !_isDevOrigin();
if (_w && !_CLOUD_ENABLED) {
  console.info('[CloudSave] local dev origin — cloud writes DISABLED (set window.__DUI_API_BASE to override).');
}

async function _fetch(path, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(API_BASE + path, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export const CloudSave = {
  enabled: _CLOUD_ENABLED,

  /** Upsert a run to the cloud, keyed by playerId.  Returns true on success. */
  async put({ playerId, plate, code, snapshot, score, position } = {}) {
    if (!this.enabled || !playerId) return false;
    try {
      const res = await _fetch('/api/save', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ playerId, plate, code, snapshot, score, position }),
      });
      return !!res?.ok;
    } catch (_) {
      return false;
    }
  },

  /** Fetch the latest cloud save for a playerId, or null if none / offline. */
  async get(playerId) {
    if (!this.enabled || !playerId) return null;
    try {
      const res = await _fetch('/api/save?playerId=' + encodeURIComponent(playerId));
      if (!res?.ok) return null;
      const data = await res.json().catch(() => null);
      return (data && data.ok) ? data.save : null;
    } catch (_) {
      return null;
    }
  },

  // ── Username (plate) uniqueness — Phase 2 ──────────────────────────────
  /** Is `plate` free to claim (or already yours)?  Returns
   *  { reachable, available, mine }.  reachable:false → server unavailable
   *  (offline / pre-deploy) so the caller can fall back to local-only rules. */
  async checkPlate(plate, playerId) {
    if (!this.enabled || !plate) return { reachable: false, available: true, mine: false };
    try {
      const q = '/api/plate?plate=' + encodeURIComponent(plate)
              + (playerId ? '&playerId=' + encodeURIComponent(playerId) : '');
      const res = await _fetch(q);
      if (!res) return { reachable: false, available: true, mine: false };
      const data = await res.json().catch(() => null);
      if (!data || data.ok !== true) return { reachable: false, available: true, mine: false };
      return { reachable: true, available: !!data.available, mine: !!data.mine };
    } catch (_) {
      return { reachable: false, available: true, mine: false };
    }
  },

  /** Claim `plate` for `playerId`.  Returns { reachable, ok, taken, plate }.
   *  reachable:false → couldn't reach the server (claim not enforced; the
   *  caller keeps the local name and can re-sync later). */
  async claimPlate(playerId, plate) {
    if (!this.enabled || !playerId || !plate) return { reachable: false, ok: false };
    try {
      const res = await _fetch('/api/plate', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ playerId, plate }),
      });
      if (!res) return { reachable: false, ok: false };
      const data = await res.json().catch(() => null);
      if (!data) return { reachable: false, ok: false };
      if (data.ok) return { reachable: true, ok: true, plate: data.plate };
      return { reachable: true, ok: false, taken: data.error === 'taken' };
    } catch (_) {
      return { reachable: false, ok: false };
    }
  },

  // ── World leaderboard — Phase 3 ────────────────────────────────────────
  /** Submit a finished run to the world board (best-effort, fire-and-forget). */
  async submitScore({ playerId, plate, score, miles, timeSec, completed } = {}) {
    if (!this.enabled || !playerId) return false;
    try {
      const res = await _fetch('/api/leaderboard', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ playerId, plate, score, miles, timeSec, completed }),
      });
      return !!res?.ok;
    } catch (_) {
      return false;
    }
  },

  /** Top entries for a metric ('score'|'miles'|'time').  Returns [] on failure
   *  so the UI can fall back to the local board. */
  async leaderboard(metric = 'score', limit = 20) {
    if (!this.enabled) return [];
    try {
      const res = await _fetch('/api/leaderboard?metric=' + encodeURIComponent(metric)
        + '&limit=' + encodeURIComponent(limit));
      if (!res?.ok) return [];
      const data = await res.json().catch(() => null);
      return (data && data.ok && Array.isArray(data.entries)) ? data.entries : [];
    } catch (_) {
      return [];
    }
  },
};
