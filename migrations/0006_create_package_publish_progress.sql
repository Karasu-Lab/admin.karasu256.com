CREATE TABLE IF NOT EXISTS package_publish_progress (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  package_id TEXT NOT NULL,
  repository_full_name TEXT NOT NULL,
  sha TEXT NOT NULL,
  source_pull_request_number INTEGER NOT NULL,
  bump_pull_request_url TEXT NOT NULL,
  created_at TEXT NOT NULL
);
