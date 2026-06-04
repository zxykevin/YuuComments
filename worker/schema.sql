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

CREATE TABLE IF NOT EXISTS comment_likes (
  comment_id TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (comment_id, visitor_hash),
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id
  ON comment_likes (comment_id);

CREATE TABLE IF NOT EXISTS comment_reports (
  id TEXT PRIMARY KEY,
  comment_id TEXT NOT NULL,
  reporter_hash TEXT NOT NULL,
  reporter_email TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'abuse', 'harassment', 'privacy', 'illegal', 'other')),
  message TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  resolved_by TEXT,
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_comment_reports_comment_reporter_hash
  ON comment_reports (comment_id, reporter_hash);

CREATE UNIQUE INDEX IF NOT EXISTS idx_comment_reports_comment_reporter_email
  ON comment_reports (comment_id, reporter_email);

CREATE INDEX IF NOT EXISTS idx_comment_reports_comment_id
  ON comment_reports (comment_id);

CREATE INDEX IF NOT EXISTS idx_comment_reports_reporter_email
  ON comment_reports (reporter_email);

CREATE INDEX IF NOT EXISTS idx_comment_reports_status
  ON comment_reports (status);

CREATE INDEX IF NOT EXISTS idx_comment_reports_created_at
  ON comment_reports (created_at);
