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
