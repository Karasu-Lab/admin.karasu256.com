CREATE TABLE IF NOT EXISTS package_update_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  package_id TEXT NOT NULL,
  repository_full_name TEXT NOT NULL,
  status TEXT NOT NULL,
  from_sha TEXT,
  to_sha TEXT NOT NULL,
  reason TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT
);
