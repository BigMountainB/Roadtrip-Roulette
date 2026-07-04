// DUI cloud server — single Cloudflare Worker (paste into the dashboard).
//
// Combines all three APIs into ONE Worker so it can be deployed entirely from
// the Cloudflare dashboard (Quick Edit) — no wrangler, which hangs on this
// setup.  Bind the D1 database `dui_saves` to this Worker as the variable DB
// (Worker → Settings → Bindings → D1 database → Variable name: DB).
//
// Routes (the client calls these against the Worker's URL):
//   GET  /api/save?playerId=ID                          → { ok, save }
//   PUT  /api/save           {playerId,plate,code,snapshot,score,position}
//   GET  /api/plate?plate=NAME[&playerId=ID]            → { ok, available, mine }
//   PUT  /api/plate          {playerId,plate}           → claim (409 if taken)
//   GET  /api/leaderboard?metric=score|miles|time&limit=N
//   PUT  /api/leaderboard    {playerId,plate,score,miles,timeSec,completed}
//   GET  /api/health                                    → { ok:true }
//
// Tables (run server/schema.sql, schema_players.sql, schema_scores.sql in the
// dui_saves D1 Console): saves, players, scores.
//
// Optional hardening (all inert until the env var is set — Worker → Settings →
// Variables):
//   TURNSTILE_SECRET   — enable Cloudflare Turnstile bot-check on plate-claim
//                        and score-submit (client must send a `token` field).
//   RENAME_COOLDOWN_SEC— min seconds between plate renames (0/unset = off).
//   SUBMIT_COOLDOWN_SEC— min seconds between score submits per player
//                        (defaults to 8; set 0 to disable).

const CORS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, PUT, OPTIONS',
  'access-control-allow-headers': 'content-type',
};
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: CORS });

const validId = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{6,80}$/.test(id);
const sanitizePlate = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim().slice(0, 8);
const normPlate = (v) => sanitizePlate(v).replace(/\s+/g, '');
const clampInt = (v, lo, hi, dflt) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt;
};
const MAX_SNAPSHOT_BYTES = 64 * 1024;

// Seattle→Pullman route length (game constant).  Used for structural
// anti-cheat: you can't bank more miles than the route, and you can't be
// "completed" without nearly reaching the finish.
const ROUTE_MILES = 293;
const MILES_MARGIN = 12;                 // tolerance for odometer rounding/overshoot
const FINISH_MILES = ROUTE_MILES - 8;    // must be this close to count as completed

// Cloudflare Turnstile verification — a no-op (returns true) unless
// TURNSTILE_SECRET is configured, so the API works before keys are wired and
// becomes enforced the moment they are.
async function turnstileOk(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return true;       // not enabled yet
  if (!token || typeof token !== 'string') return false;
  try {
    const form = new URLSearchParams();
    form.set('secret', env.TURNSTILE_SECRET);
    form.set('response', token);
    if (ip) form.set('remoteip', ip);
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body: form,
    });
    const out = await r.json().catch(() => ({}));
    return !!out.success;
  } catch (_) { return false; }                 // fail closed when enforcement is on
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');   // trim trailing slash
    const method = request.method;
    const ip = request.headers.get('cf-connecting-ip') || '';
    try {
      if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
      if (path === '/api/health') return json({ ok: true });
      if (!env.DB) return json({ ok: false, error: 'no-db' }, 503);

      // ── /api/save ──────────────────────────────────────────────────────
      if (path === '/api/save') {
        if (method === 'GET') {
          const playerId = url.searchParams.get('playerId') || '';
          if (!validId(playerId)) return json({ ok: false, error: 'bad-id' }, 400);
          const row = await env.DB
            .prepare('SELECT player_id, plate, code, snapshot, score, position, updated_at FROM saves WHERE player_id = ?')
            .bind(playerId).first();
          if (!row) return json({ ok: false, error: 'not-found' }, 404);
          let snapshot = null;
          try { snapshot = JSON.parse(row.snapshot); } catch (_) {}
          return json({ ok: true, save: {
            playerId: row.player_id, plate: row.plate, code: row.code,
            snapshot, score: row.score, position: row.position, updatedAt: row.updated_at,
          } });
        }
        if (method === 'PUT') {
          const b = await request.json().catch(() => null);
          if (!b || !validId(b.playerId)) return json({ ok: false, error: 'bad-id' }, 400);
          const snapStr = JSON.stringify(b.snapshot ?? null);
          if (snapStr.length > MAX_SNAPSHOT_BYTES) return json({ ok: false, error: 'too-big' }, 413);
          const now = new Date().toISOString();
          await env.DB.prepare(
            `INSERT INTO saves (player_id, plate, code, snapshot, score, position, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(player_id) DO UPDATE SET
               plate=excluded.plate, code=excluded.code, snapshot=excluded.snapshot,
               score=excluded.score, position=excluded.position, updated_at=excluded.updated_at`,
          ).bind(
            b.playerId, typeof b.plate === 'string' ? b.plate.slice(0, 16) : '',
            typeof b.code === 'string' ? b.code.slice(0, 128) : '', snapStr,
            clampInt(b.score, 0, 1e9, 0), Number.isFinite(b.position) ? b.position : 0, now,
          ).run();
          return json({ ok: true, updatedAt: now });
        }
      }

      // ── /api/plate ─────────────────────────────────────────────────────
      if (path === '/api/plate') {
        if (method === 'GET') {
          const norm = normPlate(url.searchParams.get('plate') || '');
          const playerId = url.searchParams.get('playerId') || '';
          if (norm.length < 2) return json({ ok: false, error: 'too-short' }, 400);
          const row = await env.DB.prepare('SELECT player_id FROM players WHERE plate_norm = ?').bind(norm).first();
          const mine = !!row && validId(playerId) && row.player_id === playerId;
          return json({ ok: true, available: !row || mine, mine });
        }
        if (method === 'PUT') {
          const b = await request.json().catch(() => null);
          if (!b || !validId(b.playerId)) return json({ ok: false, error: 'bad-id' }, 400);
          if (!(await turnstileOk(env, b.token, ip))) return json({ ok: false, error: 'bot-check' }, 403);
          const plate = sanitizePlate(b.plate), norm = normPlate(b.plate);
          if (norm.length < 2) return json({ ok: false, error: 'too-short' }, 400);
          const holder = await env.DB.prepare('SELECT player_id FROM players WHERE plate_norm = ?').bind(norm).first();
          if (holder && holder.player_id !== b.playerId) return json({ ok: false, error: 'taken' }, 409);
          // Rename cooldown — only when changing an EXISTING plate to a
          // different name (first claim is always free).  Off unless
          // RENAME_COOLDOWN_SEC is set, so it can't surprise early players.
          const cdSec = Number(env.RENAME_COOLDOWN_SEC || 0);
          const mine = await env.DB.prepare('SELECT plate_norm, updated_at FROM players WHERE player_id = ?').bind(b.playerId).first();
          if (cdSec > 0 && mine && mine.plate_norm !== norm) {
            const age = (Date.now() - Date.parse(mine.updated_at)) / 1000;
            if (age < cdSec) return json({ ok: false, error: 'rename-cooldown', retryAfterSec: Math.ceil(cdSec - age) }, 429);
          }
          const now = new Date().toISOString();
          try {
            await env.DB.prepare(
              `INSERT INTO players (player_id, plate, plate_norm, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(player_id) DO UPDATE SET
                 plate=excluded.plate, plate_norm=excluded.plate_norm, updated_at=excluded.updated_at`,
            ).bind(b.playerId, plate, norm, now, now).run();
          } catch (e) {
            if (String(e?.message || e).includes('UNIQUE')) return json({ ok: false, error: 'taken' }, 409);
            throw e;
          }
          // Propagate the new name to this player's existing rows so the
          // leaderboard + save record show the rename globally.  (The board
          // GET already COALESCEs players.plate first, so this mainly keeps
          // direct/legacy reads consistent.)
          try {
            await env.DB.prepare('UPDATE scores SET plate = ? WHERE player_id = ?').bind(plate, b.playerId).run();
            await env.DB.prepare('UPDATE saves  SET plate = ? WHERE player_id = ?').bind(plate, b.playerId).run();
          } catch (_) { /* best-effort propagation */ }
          return json({ ok: true, plate });
        }
      }

      // ── /api/leaderboard ───────────────────────────────────────────────
      if (path === '/api/leaderboard') {
        if (method === 'GET') {
          const metric = ['score', 'miles', 'time'].includes(url.searchParams.get('metric'))
            ? url.searchParams.get('metric') : 'score';
          const limit = clampInt(url.searchParams.get('limit'), 1, 100, 20);
          // Pick the SINGLE best row per player with a window function, then
          // rank those.  This keeps score/miles/time consistent — they all come
          // from that one winning row — instead of mixing the best metric with
          // bare columns from an arbitrary row (the old GROUP BY relied on a
          // fragile SQLite min/max quirk).  Tie-break on created_at so the
          // earliest equal run wins deterministically.
          let where = '', innerOrder, outerOrder;
          if (metric === 'score') {
            innerOrder = 's.score DESC, s.miles DESC, s.created_at ASC';
            outerOrder = 'score DESC';
          } else if (metric === 'miles') {
            innerOrder = 's.miles DESC, s.score DESC, s.created_at ASC';
            outerOrder = 'miles DESC';
          } else {
            where = 'WHERE s.completed = 1 AND s.time_sec > 0';
            innerOrder = 's.time_sec ASC, s.created_at ASC';
            outerOrder = 'timeSec ASC';
          }
          const sql = `SELECT playerId, plate, score, miles, timeSec FROM (
                         SELECT s.player_id AS playerId, COALESCE(p.plate, s.plate) AS plate,
                                s.score AS score, s.miles AS miles, s.time_sec AS timeSec,
                                ROW_NUMBER() OVER (PARTITION BY s.player_id ORDER BY ${innerOrder}) AS rn
                         FROM scores s LEFT JOIN players p ON p.player_id = s.player_id
                         ${where}
                       ) WHERE rn = 1 ORDER BY ${outerOrder} LIMIT ?`;
          const { results } = await env.DB.prepare(sql).bind(limit).all();
          return json({ ok: true, metric, entries: (results || []).map((r, i) => ({ rank: i + 1, ...r })) });
        }
        if (method === 'PUT') {
          const b = await request.json().catch(() => null);
          if (!b || !validId(b.playerId)) return json({ ok: false, error: 'bad-id' }, 400);
          if (!(await turnstileOk(env, b.token, ip))) return json({ ok: false, error: 'bot-check' }, 403);
          const score = clampInt(b.score, 0, 1e9, 0);
          const rawMiles = Number.isFinite(Number(b.miles)) ? Math.max(0, Number(b.miles)) : 0;
          // Structural anti-cheat (no balance assumptions): miles can't exceed
          // the route, and "completed" requires actually reaching the finish.
          if (rawMiles > ROUTE_MILES + MILES_MARGIN) return json({ ok: false, error: 'bad-miles' }, 400);
          const miles = Math.min(rawMiles, ROUTE_MILES);
          const timeSec = clampInt(b.timeSec, 0, 1e7, 0);
          const completed = (b.completed && miles >= FINISH_MILES) ? 1 : 0;
          if (score <= 0 && miles <= 0) return json({ ok: false, error: 'empty-run' }, 400);
          // Per-player submit rate limit — finished runs are infrequent, so a
          // few seconds between submits blocks scripted flooding without
          // affecting real play.
          const subCd = Number(env.SUBMIT_COOLDOWN_SEC ?? 8);
          if (subCd > 0) {
            const last = await env.DB
              .prepare('SELECT created_at FROM scores WHERE player_id = ? ORDER BY created_at DESC LIMIT 1')
              .bind(b.playerId).first();
            if (last && (Date.now() - Date.parse(last.created_at)) < subCd * 1000) {
              return json({ ok: false, error: 'rate' }, 429);
            }
          }
          await env.DB.prepare(
            `INSERT INTO scores (player_id, plate, score, miles, time_sec, completed, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          ).bind(
            b.playerId, typeof b.plate === 'string' ? b.plate.slice(0, 16) : '',
            score, miles, timeSec, completed, new Date().toISOString(),
          ).run();
          return json({ ok: true });
        }
      }

      return json({ ok: false, error: 'not-found' }, 404);
    } catch (e) {
      return json({ ok: false, error: 'server', detail: String(e?.message || e) }, 500);
    }
  },
};
