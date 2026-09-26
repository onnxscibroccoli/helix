CREATE TABLE IF NOT EXISTS omnikali_tasks (
  task_id uuid PRIMARY KEY,
  target text NOT NULL,
  workspace_id text REFERENCES workspaces(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL UNIQUE,
  state text NOT NULL CHECK (state IN ('PENDING','RUNNING','COMPLETED','FAILED')),
  owner_id text,
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  result jsonb,
  error jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS omnikali_tasks_claim_idx
  ON omnikali_tasks (state, lease_expires_at, created_at);

CREATE TABLE IF NOT EXISTS omnikali_task_events (
  event_id bigserial PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES omnikali_tasks(task_id) ON DELETE CASCADE,
  from_state text,
  to_state text NOT NULL,
  owner_id text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS omnikali_task_events_task_idx
  ON omnikali_task_events (task_id, created_at DESC);