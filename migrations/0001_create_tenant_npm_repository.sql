CREATE TABLE IF NOT EXISTS tenant_npm_repository (
  organization_id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  npm_repository_name TEXT NOT NULL,
  workflow_template_repository_name TEXT NOT NULL,
  npm_repository_id INTEGER,
  npm_repository_full_name TEXT,
  workflow_template_repository_id INTEGER,
  workflow_template_repository_full_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
