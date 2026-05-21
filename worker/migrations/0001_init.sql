CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  page_path TEXT NOT NULL,
  parent_id TEXT,
  nickname TEXT NOT NULL,
  email TEXT,
  email_hash TEXT,
  website TEXT,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  user_agent TEXT,
  ip TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES comments(id)
);

CREATE INDEX IF NOT EXISTS idx_comments_page_status_created
  ON comments (page_path, status, created_at);

CREATE INDEX IF NOT EXISTS idx_comments_parent_id
  ON comments (parent_id);
