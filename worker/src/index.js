// Road Trip Roulette — backend Worker (Cloudflare Workers + D1).
//
// Enforces PLATE (username) UNIQUENESS, plus cloud saves and the world
// leaderboard.  The game (src/systems/CloudSave.js) expects this deployed at
// https://roadtrip-api.<your-subdomain>.workers.dev — that URL is the API_BASE.
//
// Endpoints (exact shapes CloudSave.js sends/expects):
//   PUT /api/save          {playerId, plate, snapshot, score, position} -> {ok}
//   GET /api/save?playerId=                                             -> {ok, save}
//   GET /api/plate?plate=&playerId=                                     -> {ok, available, mine}
//   PUT /api/plate         {playerId, plate}         -> {ok, plate} | {ok:false, error:'taken'}
//   PUT /api/leaderboard   {playerId, plate, score, miles, timeSec, completed} -> {ok}
//   GET /api/leaderboard?metric=score|miles|time&limit=                -> {ok, entries}
//
// Deploy: see ../README.md.  Requires a D1 binding named `DB`.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  });

// Normalize a plate for collision checks: uppercase, alphanumeric-only, ≤8.
// So "B-ob", "BOB", and "bob" all collide (owner spec: alphanumeric-only).
const normPlate = (p) => String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

// ── Entitlement skus (must match the game's culture keys / schema.sql) ──
const GENRE_KEYS = [
  'hiphop_phonk', 'country', 'reggaeton', 'k_pop', 'metal',
  'classic_rock', 'edm_rave', 'reggae', 'pop_punk_emo', 'norteno',
];
const ATOMIC_SKUS = new Set([
  'route_full', 'plate_custom', 'plates_states',
  ...GENRE_KEYS.map(k => `genre_${k}`),
]);

// Expand a purchase sku to the atomic skus it grants (null = unknown sku).
// 'starter' needs `genre` (the buyer's 1 chosen starter genre).
function expandSku(sku, genre) {
  if (ATOMIC_SKUS.has(sku)) return [sku];
  if (sku === 'starter') {
    if (!GENRE_KEYS.includes(genre)) return null;
    return ['route_full', 'plate_custom', `genre_${genre}`];
  }
  if (sku === 'all_access') {
    return ['route_full', 'plate_custom', 'plates_states', ...GENRE_KEYS.map(k => `genre_${k}`)];
  }
  return null;
}

async function grantSkus(db, playerId, skus, source) {
  const now = Date.now();
  const stmt = db.prepare(
    `INSERT INTO entitlements (player_id, sku, source, granted_at)
       VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(player_id, sku) DO NOTHING`
  );
  await db.batch(skus.map(s => stmt.bind(playerId, s, source, now)));
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const db = env.DB;
    if (!db) return json({ ok: false, error: 'no-db-binding' }, 500);

    try {
      // ── Cloud save ────────────────────────────────────────────────────
      if (path === '/api/save' && method === 'PUT') {
        const b = await request.json();
        if (!b || !b.playerId) return json({ ok: false, error: 'no-player' }, 400);
        await db.prepare(
          `INSERT INTO players (player_id, plate, save_json, score, position, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
           ON CONFLICT(player_id) DO UPDATE SET
             plate=COALESCE(?2, plate), save_json=?3, score=?4, position=?5, updated_at=?6`
        ).bind(
          b.playerId, b.plate ?? null, JSON.stringify(b.snapshot ?? null),
          b.score | 0, Number(b.position) || 0, Date.now()
        ).run();
        return json({ ok: true });
      }

      if (path === '/api/save' && method === 'GET') {
        const pid = url.searchParams.get('playerId');
        if (!pid) return json({ ok: false }, 400);
        const row = await db.prepare(
          'SELECT save_json, score, position FROM players WHERE player_id=?1'
        ).bind(pid).first();
        if (!row || !row.save_json) return json({ ok: false });
        return json({
          ok: true,
          save: { snapshot: JSON.parse(row.save_json), score: row.score, position: row.position },
        });
      }

      // ── Plate uniqueness ──────────────────────────────────────────────
      if (path === '/api/plate' && method === 'GET') {
        const norm = normPlate(url.searchParams.get('plate'));
        const pid  = url.searchParams.get('playerId') || '';
        if (!norm) return json({ ok: true, available: false, mine: false });
        const row = await db.prepare('SELECT player_id FROM players WHERE plate_norm=?1').bind(norm).first();
        return json({ ok: true, available: !row || row.player_id === pid, mine: !!row && row.player_id === pid });
      }

      if (path === '/api/plate' && method === 'PUT') {
        const b = await request.json();
        const norm = normPlate(b && b.plate);
        if (!b || !b.playerId || !norm) return json({ ok: false, error: 'invalid' }, 400);
        // Held by someone else? -> taken.
        const row = await db.prepare('SELECT player_id FROM players WHERE plate_norm=?1').bind(norm).first();
        if (row && row.player_id !== b.playerId) return json({ ok: false, error: 'taken' });
        // Claim: upsert this player's plate + normalized key (UNIQUE index enforces it).
        await db.prepare(
          `INSERT INTO players (player_id, plate, plate_norm, updated_at)
             VALUES (?1, ?2, ?3, ?4)
           ON CONFLICT(player_id) DO UPDATE SET plate=?2, plate_norm=?3, updated_at=?4`
        ).bind(b.playerId, b.plate, norm, Date.now()).run();
        return json({ ok: true, plate: b.plate });
      }

      // ── World leaderboard ─────────────────────────────────────────────
      if (path === '/api/leaderboard' && method === 'PUT') {
        const b = await request.json();
        if (!b || !b.playerId) return json({ ok: false }, 400);
        // Keep each player's BEST: max score/miles, fastest completed time.
        await db.prepare(
          `INSERT INTO leaderboard (player_id, plate, score, miles, time_sec, completed, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
           ON CONFLICT(player_id) DO UPDATE SET
             plate=?2,
             score=MAX(score, ?3),
             miles=MAX(miles, ?4),
             time_sec=CASE WHEN ?6=1 AND (time_sec=0 OR ?5<time_sec) THEN ?5 ELSE time_sec END,
             completed=MAX(completed, ?6),
             updated_at=?7`
        ).bind(
          b.playerId, b.plate ?? null, b.score | 0,
          Number(b.miles) || 0, Number(b.timeSec) || 0, b.completed ? 1 : 0, Date.now()
        ).run();
        return json({ ok: true });
      }

      if (path === '/api/leaderboard' && method === 'GET') {
        const metric = url.searchParams.get('metric') || 'score';
        const limit  = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
        let orderBy = 'score DESC', where = '';
        if (metric === 'miles')      { orderBy = 'miles DESC'; }
        else if (metric === 'time')  { orderBy = 'time_sec ASC'; where = 'WHERE completed=1 AND time_sec>0'; }
        const rows = await db.prepare(
          `SELECT plate, score, miles, time_sec AS timeSec, completed
             FROM leaderboard ${where} ORDER BY ${orderBy} LIMIT ?1`
        ).bind(limit).all();
        return json({ ok: true, entries: rows.results || [] });
      }

      // ── Entitlements (beta à-la-carte purchases; see schema.sql) ──────
      if (path === '/api/entitlements' && method === 'GET') {
        const pid = url.searchParams.get('playerId');
        if (!pid) return json({ ok: false, error: 'no-player' }, 400);
        const rows = await db.prepare(
          'SELECT sku FROM entitlements WHERE player_id=?1'
        ).bind(pid).all();
        return json({ ok: true, skus: (rows.results || []).map(r => r.sku) });
      }

      // Dev/admin grant — gated by the GRANT_SECRET env secret
      // (`wrangler secret put GRANT_SECRET`). Accepts atomic skus or the
      // bundles 'starter' ($1: route_full + plate_custom + 1 genre via
      // `genre`) and 'all_access' ($10: everything). A payment provider
      // webhook will call the same _grant() once payments are wired.
      if (path === '/api/grant' && method === 'POST') {
        const b = await request.json();
        if (!env.GRANT_SECRET || !b || b.secret !== env.GRANT_SECRET) {
          return json({ ok: false, error: 'forbidden' }, 403);
        }
        if (!b.playerId || !b.sku) return json({ ok: false, error: 'invalid' }, 400);
        const skus = expandSku(b.sku, b.genre);
        if (!skus) return json({ ok: false, error: 'bad-sku' }, 400);
        await grantSkus(db, b.playerId, skus, b.source || 'dev-grant');
        return json({ ok: true, granted: skus });
      }

      return json({ ok: false, error: 'not-found' }, 404);
    } catch (e) {
      return json({ ok: false, error: 'server', detail: String((e && e.message) || e) }, 500);
    }
  },
};
