ALTER TABLE comments ADD COLUMN device_fingerprint TEXT;

CREATE TABLE IF NOT EXISTS comment_bans (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('ip', 'device')),
  value_hash TEXT NOT NULL,
  reason TEXT,
  source_comment_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT,
  FOREIGN KEY (source_comment_id) REFERENCES comments(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_comment_bans_type_value_hash
  ON comment_bans (type, value_hash);

CREATE INDEX IF NOT EXISTS idx_comment_bans_source_comment_id
  ON comment_bans (source_comment_id);

CREATE INDEX IF NOT EXISTS idx_comment_bans_created_at
  ON comment_bans (created_at);
