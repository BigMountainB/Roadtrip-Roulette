-- Cloud-save D1 schema for the DUI game (Cloudflare Pages Functions).
-- Apply with:  npx wrangler d1 execute dui_saves --remote --file=server/schema.sql
-- One row per player slot (keyed by the unguessable per-slot playerId).

CREATE TABLE IF NOT EXISTS saves (
  player_id   TEXT PRIMARY KEY,   -- per-slot UUID (SaveSystem.genPlayerId)
  plate       TEXT,               -- current display name (denormalized)
  code        TEXT,               -- portable save code (cross-device paste fallback)
  snapshot    TEXT NOT NULL,      -- full run snapshot, JSON-encoded
  score       INTEGER DEFAULT 0,
  position    REAL    DEFAULT 0,
  updated_at  TEXT    NOT NULL    -- ISO timestamp of last write
);

CREATE INDEX IF NOT EXISTS idx_saves_updated ON saves (updated_at);
