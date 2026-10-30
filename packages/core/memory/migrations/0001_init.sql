-- Phantom memory store — initial schema (0001).
-- objects: latest committed state per object (the KV head).
-- history: append-only lineage of locations over time (newest = highest id).

CREATE TABLE IF NOT EXISTS objects (
    key        TEXT PRIMARY KEY,
    location   TEXT,
    relations  TEXT NOT NULL DEFAULT '[]',   -- JSON array
    last_seen  TEXT NOT NULL,                -- ISO-8601
    confidence REAL NOT NULL,
    frame_ref  TEXT,
    bbox       TEXT,                         -- JSON {x,y,w,h} normalized 0..1, nullable
    status     TEXT NOT NULL DEFAULT 'fresh' -- fresh | stale | ambiguous | removed
);

CREATE TABLE IF NOT EXISTS history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    key        TEXT NOT NULL,
    location   TEXT NOT NULL,
    at         TEXT NOT NULL,                -- ISO-8601
    confidence REAL NOT NULL,
    FOREIGN KEY (key) REFERENCES objects (key) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_history_key ON history (key);
