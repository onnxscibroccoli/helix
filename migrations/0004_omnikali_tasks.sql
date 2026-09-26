-- OmniKali task state is part of the existing Helix control-plane database.
-- workspace_id links an orchestration task to the durable workspace ownership
-- boundary without constraining non-workspace targets (for example AWS nodes).
create table if not exists omnikali_tasks (
  task_id uuid primary key,
  target text not null,
  workspace_id text references workspaces(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  state text not null check (state in ('PENDING','RUNNING','COMPLETED','FAILED')),
  owner_id text,
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  attempts integer not null default 0,
  result jsonb,
  error jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table omnikali_tasks
  add column if not exists workspace_id text;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'omnikali_tasks_workspace_id_fkey'
       and conrelid = 'omnikali_tasks'::regclass
  ) then
    alter table omnikali_tasks
      add constraint omnikali_tasks_workspace_id_fkey
      foreign key (workspace_id) references workspaces(id) on delete set null;
  end if;
end $$;

create index if not exists omnikali_tasks_claim_idx
  on omnikali_tasks (state, lease_expires_at, created_at);

create index if not exists omnikali_tasks_workspace_idx
  on omnikali_tasks (workspace_id, created_at desc);

create table if not exists omnikali_task_events (
  event_id bigserial primary key,
  task_id uuid not null references omnikali_tasks(task_id) on delete cascade,
  from_state text,
  to_state text not null,
  owner_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists omnikali_task_events_task_idx
  on omnikali_task_events (task_id, created_at desc);