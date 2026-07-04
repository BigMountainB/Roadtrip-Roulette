-- World leaderboard — Phase 3 of plate-as-username.
-- Run in the dui_saves D1 Console (Execute).
--
-- One row per submitted run (history).  The GET query collapses to best-per-
-- player per metric, and joins `players` so a renamed plate shows its CURRENT
-- name globally (per design).  Anti-cheat (server-side score validation /
-- Turnstile) is Phase 4 — v1 trusts the client.

CREATE TABLE IF NOT EXISTS scores (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id   TEXT NOT NULL,
  plate       TEXT NOT NULL,          -- name at submit time (fallback)
  score       INTEGER DEFAULT 0,
  miles       REAL    DEFAULT 0,
  time_sec    INTEGER DEFAULT 0,
  completed   INTEGER DEFAULT 0,      -- 1 = reached Pullman
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scores_player ON scores (player_id);
CREATE INDEX IF NOT EXISTS idx_scores_score  ON scores (score DESC);
CREATE INDEX IF NOT EXISTS idx_scores_miles  ON scores (miles DESC);
CREATE INDEX IF NOT EXISTS idx_scores_time   ON scores (time_sec ASC);
