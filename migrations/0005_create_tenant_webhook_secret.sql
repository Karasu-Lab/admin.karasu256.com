CREATE TABLE IF NOT EXISTS tenant_webhook_secret (
  organization_id TEXT PRIMARY KEY,
  encrypted_secret TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
