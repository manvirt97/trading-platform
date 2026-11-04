-- Rangeform v34: metadata-only audit for owner-invoked OpenAI research council.
-- No API keys, prompts, market bars, model text, or bearer tokens are stored.
CREATE TABLE IF NOT EXISTS rangeform_ai_council_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL,
  created_at TEXT NOT NULL,
  symbol TEXT NOT NULL,
  mode TEXT NOT NULL CHECK(mode IN ('focused','full')),
  status TEXT NOT NULL CHECK(status IN ('STARTED','COMPLETED','PARTIAL','MODEL_UNAVAILABLE')),
  model_input_tokens INTEGER NOT NULL DEFAULT 0,
  model_output_tokens INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS rangeform_ai_council_owner_time
ON rangeform_ai_council_audit(uid, created_at DESC);
