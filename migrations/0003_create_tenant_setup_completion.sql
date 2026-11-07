CREATE TABLE IF NOT EXISTS tenant_setup_completion (
  organization_id TEXT PRIMARY KEY,
  completed_at TEXT NOT NULL
);
