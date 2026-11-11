DROP TABLE IF EXISTS repositories;

CREATE TABLE IF NOT EXISTS dedupe_keys (
  key TEXT PRIMARY KEY,
  received_at TEXT NOT NULL
);

ALTER TABLE package_update_events ADD COLUMN source_pull_request_number INTEGER;
ALTER TABLE package_update_events ADD COLUMN source_head_sha TEXT;
ALTER TABLE package_update_events ADD COLUMN pointer_comment_id INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_npm_repository_npm_repository_id
  ON tenant_npm_repository (npm_repository_id) WHERE npm_repository_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_npm_repository_npm_repository_full_name
  ON tenant_npm_repository (npm_repository_full_name) WHERE npm_repository_full_name IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_npm_repository_workflow_template_repository_id
  ON tenant_npm_repository (workflow_template_repository_id) WHERE workflow_template_repository_id IS NOT NULL;
