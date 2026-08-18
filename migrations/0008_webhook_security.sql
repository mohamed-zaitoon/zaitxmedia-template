-- Local preparation only. Do not apply to remote D1 without approval.
CREATE TABLE IF NOT EXISTS webhook_events (
  event_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  request_timestamp INTEGER NOT NULL,
  body_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('verified', 'processed', 'failed')),
  error_code TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_source_body
  ON webhook_events(source, body_hash);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at
  ON webhook_events(created_at);
