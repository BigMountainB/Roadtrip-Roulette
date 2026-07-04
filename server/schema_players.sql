-- Username (license-plate) uniqueness — Phase 2 of plate-as-username.
-- Run in the dui_saves D1 Console (Execute):
--
-- plate_norm is the normalized form (uppercased, spaces stripped) so
-- "DUI4LYF", "dui4lyf" and "D U I 4 L Y F" all collide as one name.  The
-- UNIQUE constraint is what makes simultaneous claims safe at the DB layer.

CREATE TABLE IF NOT EXISTS players (
  player_id   TEXT PRIMARY KEY,        -- per-slot UUID (SaveSystem.genPlayerId)
  plate       TEXT NOT NULL,           -- display form (as the player typed it)
  plate_norm  TEXT NOT NULL UNIQUE,    -- collision key (uppercase, no spaces)
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_players_norm ON players (plate_norm);
