-- Road Trip Roulette — D1 schema.
-- Init once (after `wrangler d1 create rtr`):
--   wrangler d1 execute rtr --remote --file=schema.sql

-- One row per player (playerId is the game's immutable per-slot id).
-- plate_norm is the UNIQUE username key: uppercase, alphanumeric-only.
-- (SQLite treats NULLs as distinct, so players without a claimed plate
--  don't collide.)
CREATE TABLE IF NOT EXISTS players (
  player_id   TEXT PRIMARY KEY,
  plate       TEXT,
  plate_norm  TEXT UNIQUE,
  save_json   TEXT,
  score       INTEGER DEFAULT 0,
  position    REAL    DEFAULT 0,
  updated_at  INTEGER
);

-- World leaderboard — best entry per player.
CREATE TABLE IF NOT EXISTS leaderboard (
  player_id   TEXT PRIMARY KEY,
  plate       TEXT,
  score       INTEGER DEFAULT 0,
  miles       REAL    DEFAULT 0,
  time_sec    REAL    DEFAULT 0,
  completed   INTEGER DEFAULT 0,
  updated_at  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_lb_score ON leaderboard(score DESC);
CREATE INDEX IF NOT EXISTS idx_lb_miles ON leaderboard(miles DESC);
CREATE INDEX IF NOT EXISTS idx_lb_time  ON leaderboard(time_sec ASC);

-- Paid entitlements (beta à-la-carte model, 2026-07-26). One row per
-- (player, sku). Bundles are EXPANDED to atomic skus at grant time so the
-- game client only ever checks atomic ones:
--   route_full     — lifts the GUEST North Bend cap ($1 custom-plate purchase)
--   plate_custom   — may claim a custom plate name ($1, same purchase)
--   plates_states  — WA/OR/ID plate designs ($3 pack)
--   genre_<key>    — one soundtrack culture, e.g. genre_metal ($3 each;
--                    $1 purchase includes the buyer's 1 starter genre)
-- ($10 all-in = route_full + plate_custom + plates_states + all 10 genres.)
-- source: 'dev-grant' | payment provider id (e.g. 'stripe:<session_id>').
CREATE TABLE IF NOT EXISTS entitlements (
  player_id   TEXT NOT NULL,
  sku         TEXT NOT NULL,
  source      TEXT,
  granted_at  INTEGER,
  PRIMARY KEY (player_id, sku)
);
