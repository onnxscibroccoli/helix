CREATE TABLE IF NOT EXISTS desktop_capabilities (
  capability_hash TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  workspace TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS desktop_capabilities_expires_at_idx
  ON desktop_capabilities (expires_at);
