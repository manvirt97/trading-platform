-- Dedicated trading-platform D1 database only. Never reuse EquityClimb's database.
CREATE TABLE IF NOT EXISTS profiles (
 uid TEXT PRIMARY KEY NOT NULL,
 nickname TEXT NOT NULL DEFAULT '',
 region TEXT NOT NULL DEFAULT 'CA',
 timezone TEXT NOT NULL DEFAULT 'America/Toronto',
 risk_profile TEXT NOT NULL DEFAULT 'learning',
 watchlist_json TEXT NOT NULL DEFAULT '[]',
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS research_history (
 uid TEXT NOT NULL,
 id TEXT NOT NULL,
 symbol TEXT NOT NULL,
 kind TEXT NOT NULL,
 note TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 PRIMARY KEY(uid,id)
);
CREATE INDEX IF NOT EXISTS history_user_sort ON research_history(uid, created_at DESC);
CREATE TABLE IF NOT EXISTS ai_allowance (
 uid TEXT NOT NULL,
 day TEXT NOT NULL,
 calls INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(uid,day)
);
