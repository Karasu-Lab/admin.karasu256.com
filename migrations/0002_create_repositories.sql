CREATE TABLE IF NOT EXISTS repositories (
  repository_id INTEGER PRIMARY KEY,
  remote TEXT NOT NULL,
  is_private INTEGER NOT NULL
);
